use std::collections::BTreeMap;
use std::fs;
use std::path::PathBuf;

use boundra_core::{load_project_model, DomainManifest};
use serde::Serialize;

use crate::output::{print_error, print_error_json, CliDiagnostic};
use crate::util::display_path;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct GraphDomainsOptions {
    pub(crate) format: GraphFormat,
    pub(crate) output: Option<PathBuf>,
    pub(crate) root: PathBuf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GraphFormat {
    Mermaid,
    Dot,
    Json,
    Html,
}

#[derive(Debug, Serialize)]
struct GraphDomainsOutput<'a> {
    domains: Vec<GraphDomainOutput<'a>>,
    edges: Vec<GraphEdgeOutput<'a>>,
    meta: GraphOutputMeta<'a>,
}

#[derive(Debug, Serialize)]
struct GraphDomainOutput<'a> {
    name: &'a str,
    depends_on: &'a [String],
}

#[derive(Debug, Serialize)]
struct GraphEdgeOutput<'a> {
    from: &'a str,
    to: &'a str,
}

#[derive(Debug, Serialize)]
struct GraphOutputMeta<'a> {
    command: &'a str,
    format: &'a str,
    domain_count: usize,
    edge_count: usize,
}

pub(crate) fn run(options: &GraphDomainsOptions) -> i32 {
    let project = match load_project_model(&options.root) {
        Ok(project) => project,
        Err(err) => {
            let diagnostic = CliDiagnostic::new(
                "PROJECT-001",
                format!("failed to load project: {err}"),
                "fix the reported config or domain manifest and retry",
            )
            .with_context("root", options.root.display().to_string());
            report_error(options, &diagnostic);
            return 2;
        }
    };

    // domain.json의 dependsOn만 사용해 도메인 의존 그래프를 만든다.
    // 코드 import를 다시 스캔하지 않기 때문에 "선언된 의존성"을 보여주는 명령이다.
    let output = match options.format {
        GraphFormat::Mermaid => render_mermaid_graph(&project.domains),
        GraphFormat::Dot => render_dot_graph(&project.domains),
        GraphFormat::Json => render_json_graph(&project.domains),
        GraphFormat::Html => render_html_graph(&project.domains),
    };

    if let Some(path) = &options.output {
        if let Some(parent) = path.parent() {
            if let Err(err) = fs::create_dir_all(parent) {
                report_error(
                    options,
                    &CliDiagnostic::new(
                        "PROJECT-003",
                        format!("failed to create graph output directory: {err}"),
                        "check output path permissions and retry",
                    )
                    .with_context("output", display_path(path)),
                );
                return 3;
            }
        }
        if let Err(err) = fs::write(path, output) {
            report_error(
                options,
                &CliDiagnostic::new(
                    "PROJECT-004",
                    format!("failed to write graph output: {err}"),
                    "check output path permissions and retry",
                )
                .with_context("output", display_path(path)),
            );
            return 3;
        }
        println!("graph-domains: OK ({})", display_path(path));
        return 0;
    }

    println!("{output}");
    0
}

fn report_error(options: &GraphDomainsOptions, diagnostic: &CliDiagnostic) {
    match options.format {
        GraphFormat::Json => print_error_json("graph-domains", diagnostic),
        GraphFormat::Mermaid | GraphFormat::Dot | GraphFormat::Html => print_error(diagnostic),
    }
}

fn render_mermaid_graph(domains: &BTreeMap<String, DomainManifest>) -> String {
    let mut lines = vec!["graph TD".to_string()];
    for (name, manifest) in domains {
        lines.push(format!("  {name}"));
        for dependency in &manifest.depends_on {
            lines.push(format!("  {name} --> {dependency}"));
        }
    }

    lines.join("\n")
}

fn render_dot_graph(domains: &BTreeMap<String, DomainManifest>) -> String {
    let mut lines = vec!["digraph domains {".to_string()];
    for (name, manifest) in domains {
        lines.push(format!("  \"{name}\";"));
        for dependency in &manifest.depends_on {
            lines.push(format!("  \"{name}\" -> \"{dependency}\";"));
        }
    }
    lines.push("}".to_string());

    lines.join("\n")
}

fn render_json_graph(domains: &BTreeMap<String, DomainManifest>) -> String {
    // JSON 출력은 CI/AI가 파싱하기 쉬우도록 nodes(domains), edges, meta를 분리한다.
    let edges = domains
        .values()
        .flat_map(|manifest| {
            manifest
                .depends_on
                .iter()
                .map(|dependency| GraphEdgeOutput {
                    from: manifest.name.as_str(),
                    to: dependency.as_str(),
                })
        })
        .collect::<Vec<_>>();
    let output = GraphDomainsOutput {
        domains: domains
            .values()
            .map(|manifest| GraphDomainOutput {
                name: &manifest.name,
                depends_on: &manifest.depends_on,
            })
            .collect(),
        meta: GraphOutputMeta {
            command: "graph-domains",
            format: graph_format_name(GraphFormat::Json),
            domain_count: domains.len(),
            edge_count: edges.len(),
        },
        edges,
    };

    serde_json::to_string_pretty(&output).expect("failed to serialize graph JSON")
}

pub(crate) fn graph_format_name(format: GraphFormat) -> &'static str {
    match format {
        GraphFormat::Mermaid => "mermaid",
        GraphFormat::Dot => "dot",
        GraphFormat::Json => "json",
        GraphFormat::Html => "html",
    }
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn render_html_graph(domains: &BTreeMap<String, DomainManifest>) -> String {
    use std::fmt::Write;
    let ids: BTreeMap<_, _> = domains
        .keys()
        .enumerate()
        .map(|(index, name)| (name.as_str(), index))
        .collect();
    let mut reverse: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    for (name, manifest) in domains {
        for dependency in &manifest.depends_on {
            reverse.entry(dependency).or_default().push(name);
        }
    }
    let mut output = String::from(include_str!("graph-view-start.html"));
    let _ = write!(
        output,
        "<p>{} domains</p><nav aria-label=\"Domain index\"><ul>",
        domains.len()
    );
    for (name, index) in &ids {
        let _ = write!(
            output,
            "<li><a href=\"#domain-{index}\">{}</a></li>",
            escape_html(name)
        );
    }
    output.push_str("</ul></nav><main id=\"domains\">");
    for (name, manifest) in domains {
        let index = ids[name.as_str()];
        let _ = write!(
            output,
            "<article id=\"domain-{index}\" data-domain=\"{}\"><h2>{}</h2>",
            escape_html(name),
            escape_html(name)
        );
        for (label, neighbors) in [
            (
                "Depends on",
                manifest
                    .depends_on
                    .iter()
                    .map(String::as_str)
                    .collect::<Vec<_>>(),
            ),
            (
                "Used by",
                reverse.get(name.as_str()).cloned().unwrap_or_default(),
            ),
        ] {
            let _ = write!(output, "<section><h3>{label}</h3><ul>");
            if neighbors.is_empty() {
                output.push_str("<li>None</li>");
            }
            for neighbor in neighbors {
                if let Some(id) = ids.get(neighbor) {
                    let _ = write!(
                        output,
                        "<li><a href=\"#domain-{id}\">{}</a></li>",
                        escape_html(neighbor)
                    );
                } else {
                    let _ = write!(
                        output,
                        "<li>{} (not discovered)</li>",
                        escape_html(neighbor)
                    );
                }
            }
            output.push_str("</ul></section>");
        }
        output.push_str("</article>");
    }
    output.push_str(include_str!("graph-view-end.html"));
    output
}

#[cfg(test)]
mod html_tests {
    use super::*;
    use boundra_core::PublicApi;

    #[test]
    fn renders_large_graph_deterministically_with_bidirectional_navigation() {
        let domains = (0..500)
            .map(|index| {
                let name = format!("domain-{index:03}");
                let depends_on = if index == 0 {
                    vec!["<unknown>".to_string()]
                } else {
                    vec![format!("domain-{:03}", index - 1)]
                };
                (
                    name.clone(),
                    DomainManifest {
                        name,
                        depends_on,
                        public_api: PublicApi {
                            client: vec![],
                            server: vec![],
                            shared: vec![],
                        },
                    },
                )
            })
            .collect();
        let html = render_html_graph(&domains);
        assert_eq!(html, render_html_graph(&domains));
        assert_eq!(html.matches("<article id=").count(), 500);
        assert!(html.contains("&lt;unknown&gt; (not discovered)"));
        assert!(!html.contains("<unknown>"));
        assert!(html.contains("href=\"#domain-499\""));
        assert!(html.contains("Used by"));
        assert!(html.contains("default-src 'none'"));
    }
}
