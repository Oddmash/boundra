use std::collections::BTreeSet;
use std::fs;
use std::path::{Component, Path, PathBuf};

use boundra_parser::{collect_imports_with_report, ScanOptions};
use serde::Serialize;

use crate::output::{print_error, print_error_json, CliDiagnostic, OutputFormat};
use crate::util::is_kebab_case;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct MigrateOptions {
    pub(crate) root: PathBuf,
    pub(crate) from: Option<PathBuf>,
    pub(crate) format: OutputFormat,
}

#[derive(Serialize)]
struct Candidate {
    name: String,
    source: String,
    layers: Vec<String>,
    manifest_present: bool,
    source_file_count: usize,
    import_specifiers: BTreeSet<String>,
}

#[derive(Serialize)]
struct Plan {
    status: &'static str,
    source: String,
    existing_config: bool,
    candidates: Vec<Candidate>,
    warnings: Vec<String>,
    next_steps: Vec<&'static str>,
}

fn relative(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn safe_source(root: &Path, path: &Path) -> Result<PathBuf, String> {
    if path.as_os_str().is_empty()
        || path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err("--from must be a workspace-relative directory without traversal".into());
    }
    let canonical = root
        .join(path)
        .canonicalize()
        .map_err(|error| error.to_string())?;
    if !canonical.starts_with(root) || !canonical.is_dir() {
        return Err("source directory is outside the workspace or not a directory".into());
    }
    Ok(canonical)
}

fn has_symlink(path: &Path) -> std::io::Result<bool> {
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        if matches!(
            entry.file_name().to_str(),
            Some("node_modules" | ".next" | ".turbo" | "dist" | "build" | "coverage" | "target")
        ) {
            continue;
        }
        let kind = entry.file_type()?;
        if kind.is_symlink() || (kind.is_dir() && has_symlink(&entry.path())?) {
            return Ok(true);
        }
    }
    Ok(false)
}

fn plan(options: &MigrateOptions) -> Result<Plan, String> {
    let root = options
        .root
        .canonicalize()
        .map_err(|error| error.to_string())?;
    let source = match &options.from {
        Some(path) => safe_source(&root, path)?,
        None => {
            let candidates = ["domains", "src/domains", "features", "src/features"]
                .iter()
                .filter_map(|path| safe_source(&root, Path::new(path)).ok())
                .collect::<BTreeSet<_>>();
            if candidates.len() != 1 {
                return Err("no unique conventional source directory; pass --from <relative-path> explicitly".into());
            }
            candidates.into_iter().next().unwrap()
        }
    };
    let mut directories = fs::read_dir(&source)
        .map_err(|error| error.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| error.to_string())?;
    directories.sort_by_key(|entry| entry.file_name());
    let mut candidates = Vec::new();
    let mut warnings = Vec::new();
    for entry in directories {
        let kind = entry.file_type().map_err(|error| error.to_string())?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if kind.is_symlink() {
            warnings.push(format!("Skipped symbolic link {name}"));
            continue;
        }
        if !kind.is_dir() {
            continue;
        }
        if !is_kebab_case(&name) {
            warnings.push(format!("Review non-kebab-case directory {name} manually"));
            continue;
        }
        let path = entry.path();
        if has_symlink(&path).map_err(|error| error.to_string())? {
            warnings.push(format!(
                "Skipped {name}: symbolic links require manual review"
            ));
            continue;
        }
        let scan = collect_imports_with_report(&path, &ScanOptions::default())
            .map_err(|error| error.to_string())?;
        if scan.scanned_file_count == 0 {
            warnings.push(format!("Skipped {name}: no supported source files"));
            continue;
        }
        candidates.push(Candidate {
            name,
            source: relative(
                path.strip_prefix(&root)
                    .map_err(|error| error.to_string())?,
            ),
            layers: ["client", "server", "shared", "mcp", "tests", "test"]
                .into_iter()
                .filter(|layer| path.join(layer).is_dir())
                .map(str::to_owned)
                .collect(),
            manifest_present: path.join("domain.json").is_file(),
            source_file_count: scan.scanned_file_count,
            import_specifiers: scan
                .imports
                .into_iter()
                .map(|record| record.import_path)
                .collect(),
        });
    }
    if candidates.is_empty() {
        warnings.push(
            "No eligible domain candidates were found; inspect the source layout manually".into(),
        );
    }
    Ok(Plan {
        status: "plan",
        source: relative(
            source
                .strip_prefix(&root)
                .map_err(|error| error.to_string())?,
        ),
        existing_config: root.join("boundra.config.json").is_file(),
        candidates,
        warnings,
        next_steps: vec![
            "Review candidate domains and classify source files into layers.",
            "Initialize Boundra only if no configuration exists; preserve current files.",
            "Define manifest public APIs and dependencies explicitly.",
            "Run check-boundaries and optionally establish an explicit baseline.",
        ],
    })
}

pub(crate) fn run(options: &MigrateOptions) -> i32 {
    let plan = match plan(options) {
        Ok(plan) => plan,
        Err(error) => {
            let diagnostic = CliDiagnostic::new(
                "MIGRATE-001",
                error,
                "select a unique workspace-relative source directory and inspect it manually",
            );
            match options.format {
                OutputFormat::Text => print_error(&diagnostic),
                OutputFormat::Json => print_error_json("migrate", &diagnostic),
            }
            return 2;
        }
    };
    match options.format {
        OutputFormat::Json => println!(
            "{}",
            serde_json::to_string_pretty(&plan).expect("serialize migration plan")
        ),
        OutputFormat::Text => {
            println!("Migration plan for {} (read-only)", plan.source);
            for candidate in plan.candidates {
                println!(
                    "{}: {} source files, {} unique import specifiers, manifest={}",
                    candidate.source,
                    candidate.source_file_count,
                    candidate.import_specifiers.len(),
                    candidate.manifest_present
                );
            }
            for warning in plan.warnings {
                println!("[WARNING] {warning}");
            }
            for step in plan.next_steps {
                println!("- {step}");
            }
        }
    }
    0
}
