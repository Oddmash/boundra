use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;

use serde::{Deserialize, Serialize};

use crate::output::{print_error, print_error_json, CliDiagnostic, OutputFormat};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BaselineAction {
    Create,
    Check,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BaselineOptions {
    pub(crate) action: BaselineAction,
    pub(crate) root: PathBuf,
    pub(crate) baseline: Option<PathBuf>,
    pub(crate) format: OutputFormat,
}

#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Fingerprint {
    rule: String,
    file: String,
    import: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Entry {
    fingerprint: Fingerprint,
    count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Baseline {
    version: u32,
    analyzed_domain_count: usize,
    entries: Vec<Entry>,
}

#[derive(Deserialize, Serialize)]
struct Diagnostic {
    rule: String,
    file: String,
    line: usize,
    import: String,
    message: String,
    suggestion: String,
}

impl Diagnostic {
    fn fingerprint(&self) -> Fingerprint {
        Fingerprint {
            rule: self.rule.clone(),
            file: self.file.clone(),
            import: self.import.clone(),
        }
    }
}

#[derive(Deserialize)]
struct Report {
    status: String,
    violations: Vec<Diagnostic>,
    meta: Coverage,
}

#[derive(Deserialize, Serialize)]
struct Coverage {
    analyzed_domain_count: usize,
    scanned_file_count: usize,
    violation_count: usize,
}

fn scan(options: &BaselineOptions) -> Result<Report, String> {
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let result = Command::new(executable)
        .arg("check-boundaries")
        .arg("--root")
        .arg(&options.root)
        .args(["--format", "json"])
        .output()
        .map_err(|error| error.to_string())?;
    if !matches!(result.status.code(), Some(0 | 1)) {
        return Err(format!(
            "boundary check failed: {}",
            String::from_utf8_lossy(&result.stdout)
        ));
    }
    let report: Report =
        serde_json::from_slice(&result.stdout).map_err(|error| error.to_string())?;
    if report.meta.analyzed_domain_count == 0 || report.meta.scanned_file_count == 0 {
        return Err("refusing to use an empty boundary scan".into());
    }
    if report.meta.violation_count != report.violations.len()
        || (report.status != "passed" && report.status != "failed")
        || (report.status == "passed") != report.violations.is_empty()
    {
        return Err("inconsistent boundary report".into());
    }
    Ok(report)
}

fn read_baseline(path: &PathBuf) -> Result<(usize, BTreeMap<Fingerprint, usize>), String> {
    let baseline: Baseline =
        serde_json::from_slice(&fs::read(path).map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
    if baseline.version != 1 || baseline.analyzed_domain_count == 0 {
        return Err("unsupported baseline version or missing domain coverage".into());
    }
    let mut entries = BTreeMap::new();
    for entry in baseline.entries {
        let key = entry.fingerprint;
        if entry.count == 0
            || !matches!(
                key.rule.as_str(),
                "BR-001" | "BR-002" | "BR-003" | "BR-004" | "BR-005" | "BR-006" | "BR-007"
            )
            || key.file.is_empty()
            || key.file.starts_with('/')
            || key.file.contains('\\')
            || key
                .file
                .split('/')
                .any(|part| part.is_empty() || matches!(part, "." | ".."))
            || key.import.is_empty()
            || entries.insert(key, entry.count).is_some()
        {
            return Err("invalid or duplicate baseline fingerprint".into());
        }
    }
    Ok((baseline.analyzed_domain_count, entries))
}

pub(crate) fn run(options: &BaselineOptions) -> i32 {
    let previous = if options.action == BaselineAction::Check {
        match read_baseline(
            options
                .baseline
                .as_ref()
                .expect("validated baseline option"),
        ) {
            Ok(previous) => Some(previous),
            Err(error) => return fail(options, error),
        }
    } else {
        None
    };
    let report = match scan(options) {
        Ok(report) => report,
        Err(error) => return fail(options, error),
    };
    if let Some((minimum, mut remaining)) = previous {
        if report.meta.analyzed_domain_count < minimum {
            return fail(
                options,
                format!(
                    "analyzed domain coverage decreased from {minimum} to {}",
                    report.meta.analyzed_domain_count
                ),
            );
        }
        let mut new = Vec::new();
        let mut existing = Vec::new();
        for diagnostic in report.violations {
            let matched = remaining
                .get_mut(&diagnostic.fingerprint())
                .filter(|count| **count > 0);
            if let Some(count) = matched {
                *count -= 1;
                existing.push(diagnostic);
            } else {
                new.push(diagnostic);
            }
        }
        let resolved: Vec<Entry> = remaining
            .into_iter()
            .filter(|(_, count)| *count > 0)
            .map(|(fingerprint, count)| Entry { fingerprint, count })
            .collect();
        let failed = !new.is_empty();
        match options.format {
            OutputFormat::Json => println!("{}", serde_json::to_string_pretty(&serde_json::json!({"status":if failed {"failed"} else {"passed"},"new":new,"existing":existing,"resolved":resolved,"meta":{"command":"baseline check","coverage":report.meta}})).expect("serialize baseline comparison")),
            OutputFormat::Text => {
                println!("baseline check: {} new, {} existing, {} resolved", new.len(), existing.len(), resolved.iter().map(|entry| entry.count).sum::<usize>());
                for (kind, diagnostics) in [("NEW", new), ("EXISTING", existing)] { for diagnostic in diagnostics { println!("[{kind}] {} {}:{} {}", diagnostic.rule, diagnostic.file, diagnostic.line, diagnostic.message); } }
                for entry in resolved { println!("[RESOLVED] {} {} {} ({} occurrence(s))", entry.fingerprint.rule, entry.fingerprint.file, entry.fingerprint.import, entry.count); }
            }
        }
        return if failed { 1 } else { 0 };
    }
    let mut counts = BTreeMap::new();
    for diagnostic in report.violations {
        *counts.entry(diagnostic.fingerprint()).or_insert(0usize) += 1;
    }
    let baseline = Baseline {
        version: 1,
        analyzed_domain_count: report.meta.analyzed_domain_count,
        entries: counts
            .into_iter()
            .map(|(fingerprint, count)| Entry { fingerprint, count })
            .collect(),
    };
    println!(
        "{}",
        serde_json::to_string_pretty(&baseline).expect("serialize baseline")
    );
    0
}

fn fail(options: &BaselineOptions, message: String) -> i32 {
    let diagnostic = CliDiagnostic::new(
        "BASELINE-001",
        message,
        "verify the baseline file, workspace configuration and scan coverage",
    );
    match options.format {
        OutputFormat::Text => print_error(&diagnostic),
        OutputFormat::Json => print_error_json("baseline", &diagnostic),
    }
    2
}
