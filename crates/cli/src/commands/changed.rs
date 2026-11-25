use std::collections::BTreeSet;
use std::path::PathBuf;
use std::process::Command;

use serde_json::Value;

use crate::output::{print_error, print_error_json, CliDiagnostic, OutputFormat};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ChangedOptions {
    pub(crate) root: PathBuf,
    pub(crate) base: String,
    pub(crate) format: OutputFormat,
}

fn git(options: &ChangedOptions, args: &[&str]) -> Result<Vec<u8>, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(&options.root)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_owned());
    }
    Ok(output.stdout)
}

fn paths(bytes: &[u8]) -> Result<Vec<String>, String> {
    bytes
        .split(|byte| *byte == 0)
        .filter(|part| !part.is_empty())
        .map(|part| {
            std::str::from_utf8(part)
                .map(str::to_owned)
                .map_err(|_| "Git returned a non-UTF-8 path; run an ordinary full check".into())
        })
        .collect()
}

fn inspect(options: &ChangedOptions) -> Result<(Value, i32), String> {
    let reference = format!("{}^{{commit}}", options.base);
    let sha = String::from_utf8(git(
        options,
        &["rev-parse", "--verify", "--end-of-options", &reference],
    )?)
    .map_err(|error| error.to_string())?;
    let sha = sha.trim();
    if !matches!(sha.len(), 40 | 64) || !sha.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err("invalid resolved Git commit".into());
    }
    let mut changed = BTreeSet::new();
    let mut fallback = false;
    for suffix in [vec![sha, "--"], vec!["--cached", sha, "--"], vec!["--"]] {
        let mut args = vec![
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--relative",
            "--no-renames",
            "--name-status",
            "-z",
        ];
        args.extend(suffix);
        let tracked = paths(&git(options, &args)?)?;
        if tracked.len() % 2 != 0 {
            return Err("invalid Git name-status report".into());
        }
        for item in tracked.chunks_exact(2) {
            if !matches!(item[0].as_str(), "A" | "M" | "D" | "T" | "U" | "X" | "B") {
                return Err("unsupported Git changed-file status".into());
            }
            fallback |= !matches!(item[0].as_str(), "A" | "M");
            changed.insert(item[1].clone());
        }
    }
    changed.extend(paths(&git(
        options,
        &["ls-files", "--others", "--exclude-standard", "-z"],
    )?)?);
    fallback |= changed.iter().any(|path| {
        ![".ts", ".tsx", ".js", ".jsx", ".svelte"]
            .iter()
            .any(|ext| path.ends_with(ext))
    });
    let binary = std::env::current_exe().map_err(|error| error.to_string())?;
    let output = Command::new(binary)
        .arg("check-boundaries")
        .arg("--root")
        .arg(&options.root)
        .args(["--format", "json", "--min-domains", "1"])
        .output()
        .map_err(|error| error.to_string())?;
    let code = output.status.code().unwrap_or(3);
    if !matches!(code, 0 | 1) {
        return Err(format!(
            "full boundary check failed: {}",
            String::from_utf8_lossy(&output.stdout)
        ));
    }
    let report: Value =
        serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;
    if report["meta"]["analyzed_domain_count"]
        .as_u64()
        .unwrap_or(0)
        == 0
    {
        return Err("full scan analyzed no domains".into());
    }
    let diagnostics = report["violations"]
        .as_array()
        .ok_or("invalid full scan report")?;
    let mut focused = Vec::new();
    let mut other = Vec::new();
    for item in diagnostics {
        let file = item["file"].as_str().ok_or("diagnostic missing file")?;
        if fallback || changed.contains(file) {
            focused.push(item);
        } else {
            other.push(item);
        }
    }
    Ok((
        serde_json::json!({"status":if code == 0 {"passed"} else {"failed"},"base":sha,"scope":if fallback {"full"} else {"changed"},"changed_files":changed,"focused":focused,"other":other,"meta":report["meta"]}),
        code,
    ))
}

pub(crate) fn run(options: &ChangedOptions) -> i32 {
    let (report, code) = match inspect(options) {
        Ok(result) => result,
        Err(err) => {
            let diagnostic = CliDiagnostic::new(
                "CHANGED-001",
                err,
                "verify the Git base and workspace configuration, then run check-boundaries",
            );
            match options.format {
                OutputFormat::Text => print_error(&diagnostic),
                OutputFormat::Json => print_error_json("check-changed", &diagnostic),
            }
            return 2;
        }
    };
    match options.format {
        OutputFormat::Json => println!(
            "{}",
            serde_json::to_string_pretty(&report).expect("serialize changed report")
        ),
        OutputFormat::Text => {
            println!(
                "check-changed: {} (scope {})",
                report["status"], report["scope"]
            );
            for group in ["focused", "other"] {
                for item in report[group]
                    .as_array()
                    .expect("validated diagnostic group")
                {
                    println!(
                        "[{group}] {} {}:{} {}",
                        item["rule"], item["file"], item["line"], item["message"]
                    );
                }
            }
        }
    }
    code
}
