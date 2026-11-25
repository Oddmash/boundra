use std::path::PathBuf;

use boundra_core::load_project_model;
use boundra_parser::{collect_imports_with_report, ScanOptions};
use serde::Serialize;

use crate::commands::check_boundaries::count_analyzed_domains;
use crate::output::{print_error, print_error_json, CliDiagnostic, OutputFormat};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct DoctorOptions {
    pub(crate) root: Option<PathBuf>,
    pub(crate) format: OutputFormat,
}

#[derive(Serialize)]
struct DoctorReport {
    status: &'static str,
    root: String,
    domain_count: usize,
    scanned_file_count: usize,
    analyzed_domain_count: usize,
    meta: DoctorMeta,
}

#[derive(Serialize)]
struct DoctorMeta {
    command: &'static str,
}

pub(crate) fn run(options: &DoctorOptions) -> i32 {
    let root = match &options.root {
        Some(path) => path.clone(),
        None => match std::env::current_dir() {
            Ok(cwd) => cwd
                .ancestors()
                .find(|path| path.join("boundra.config.json").is_file())
                .map(PathBuf::from)
                .unwrap_or(cwd),
            Err(err) => {
                return report_error(
                    options,
                    CliDiagnostic::new(
                        "PROJECT-001",
                        format!("failed to determine working directory: {err}"),
                        "pass --root with an accessible workspace path",
                    ),
                    2,
                )
            }
        },
    };
    let config = root.join("boundra.config.json");
    if !config.is_file() {
        return report_error(
            options,
            CliDiagnostic::new(
                "DOCTOR-001",
                "workspace config not found",
                "run 'boundra init' in the intended workspace or pass --root",
            )
            .with_context("root", root.display().to_string()),
            2,
        );
    }
    let project = match load_project_model(&root) {
        Ok(project) => project,
        Err(err) => {
            return report_error(
                options,
                CliDiagnostic::new(
                    "PROJECT-001",
                    format!("failed to load project: {err}"),
                    "fix the reported config or domain manifest and retry",
                )
                .with_context("root", root.display().to_string()),
                2,
            )
        }
    };
    let scan = match collect_imports_with_report(
        &root,
        &ScanOptions {
            include_extensions: project.config.check_boundaries.include_extensions.clone(),
            ignore: project.config.check_boundaries.ignore.clone(),
        },
    ) {
        Ok(scan) => scan,
        Err(err) => {
            return report_error(
                options,
                CliDiagnostic::new(
                    "PROJECT-002",
                    format!("failed to scan project: {err}"),
                    "check file permissions and configured scan paths, then retry",
                )
                .with_context("root", root.display().to_string()),
                3,
            )
        }
    };
    let analyzed = count_analyzed_domains(&scan.scanned_files, &project.domain_roots);
    let ready = scan.scanned_file_count > 0 && analyzed > 0;
    let report = DoctorReport {
        status: if ready { "ready" } else { "empty" },
        root: root.display().to_string(),
        domain_count: project.domains.len(),
        scanned_file_count: scan.scanned_file_count,
        analyzed_domain_count: analyzed,
        meta: DoctorMeta { command: "doctor" },
    };
    match options.format {
        OutputFormat::Json => println!(
            "{}",
            serde_json::to_string_pretty(&report).expect("failed to serialize doctor report")
        ),
        OutputFormat::Text => {
            println!("Workspace: {}", report.root);
            println!(
                "Domains: {} declared, {} analyzed",
                report.domain_count, report.analyzed_domain_count
            );
            println!("Scanned source files: {}", report.scanned_file_count);
            if ready {
                println!("doctor: READY (run 'boundra check-boundaries' to verify rules)");
            } else {
                println!("doctor: EMPTY (create a domain or check scan paths and ignore patterns)");
            }
        }
    }
    if ready {
        0
    } else {
        1
    }
}

fn report_error(options: &DoctorOptions, diagnostic: CliDiagnostic, status: i32) -> i32 {
    match options.format {
        OutputFormat::Json => print_error_json("doctor", &diagnostic),
        OutputFormat::Text => print_error(&diagnostic),
    }
    status
}
