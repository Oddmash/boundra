use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::path::PathBuf;

use boundra_core::{load_project_model, DomainManifest};
use serde::Serialize;

use crate::output::{print_error, print_error_json, CliDiagnostic, OutputFormat};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ImpactOptions {
    pub(crate) domain: String,
    pub(crate) root: PathBuf,
    pub(crate) format: OutputFormat,
}

#[derive(Serialize)]
struct ImpactReport<'a> {
    domain: &'a str,
    direct_dependents: BTreeSet<&'a str>,
    transitive_dependents: BTreeSet<&'a str>,
    meta: ImpactMeta,
}

#[derive(Serialize)]
struct ImpactMeta {
    command: &'static str,
    affected_domain_count: usize,
}

fn analyze<'a>(domain: &'a str, domains: &'a BTreeMap<String, DomainManifest>) -> ImpactReport<'a> {
    let mut reverse = BTreeMap::<&str, BTreeSet<&str>>::new();
    for (name, manifest) in domains {
        for dependency in &manifest.depends_on {
            reverse.entry(dependency).or_default().insert(name);
        }
    }
    let direct = reverse.get(domain).cloned().unwrap_or_default();
    let mut visited = BTreeSet::from([domain]);
    let mut queue = VecDeque::from([domain]);
    while let Some(current) = queue.pop_front() {
        if let Some(consumers) = reverse.get(current) {
            for &consumer in consumers {
                if visited.insert(consumer) {
                    queue.push_back(consumer);
                }
            }
        }
    }
    visited.remove(domain);
    let transitive = visited.difference(&direct).copied().collect();
    ImpactReport {
        domain,
        direct_dependents: direct,
        transitive_dependents: transitive,
        meta: ImpactMeta {
            command: "impact",
            affected_domain_count: visited.len(),
        },
    }
}

pub(crate) fn run(options: &ImpactOptions) -> i32 {
    let project = match load_project_model(&options.root) {
        Ok(project) => project,
        Err(err) => {
            return report_error(
                options,
                CliDiagnostic::new(
                    "PROJECT-001",
                    format!("failed to load project: {err}"),
                    "fix the reported config or domain manifest and retry",
                )
                .with_context("root", options.root.display().to_string()),
            )
        }
    };
    if !project.domains.contains_key(&options.domain) {
        return report_error(
            options,
            CliDiagnostic::new(
                "DOMAIN-004",
                format!("unknown domain '{}'", options.domain),
                "run 'boundra graph-domains' to list declared domains",
            )
            .with_context("domain", &options.domain),
        );
    }
    let report = analyze(&options.domain, &project.domains);
    match options.format {
        OutputFormat::Json => println!(
            "{}",
            serde_json::to_string_pretty(&report).expect("failed to serialize impact report")
        ),
        OutputFormat::Text => {
            println!(
                "Potential impact of '{}': {} domain(s)",
                report.domain, report.meta.affected_domain_count
            );
            println!("Direct consumers:");
            if report.direct_dependents.is_empty() {
                println!("  (none)");
            }
            for name in report.direct_dependents {
                println!("  {name}");
            }
            println!("Indirect consumers:");
            if report.transitive_dependents.is_empty() {
                println!("  (none)");
            }
            for name in report.transitive_dependents {
                println!("  {name}");
            }
        }
    }
    0
}

fn report_error(options: &ImpactOptions, diagnostic: CliDiagnostic) -> i32 {
    match options.format {
        OutputFormat::Json => print_error_json("impact", &diagnostic),
        OutputFormat::Text => print_error(&diagnostic),
    }
    2
}
