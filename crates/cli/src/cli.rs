use crate::commands;
use crate::output::{print_error, print_error_json, CliDiagnostic};
use crate::parsing::{parse_command, Command};

pub fn run(args: &[String]) -> i32 {
    if let [command, flag] = args {
        if matches!(flag.as_str(), "--help" | "-h") {
            if let Some(usage) = command_usage(command) {
                println!("Usage: boundra {usage}");
                return 0;
            }
        }
    }
    let command = match parse_command(args) {
        Ok(command) => command,
        Err(err) => {
            let command = args.first().map(String::as_str).unwrap_or("boundra");
            let diagnostic = CliDiagnostic::new(
                "CLI-001",
                err,
                "run 'boundra --help' to see valid commands and options",
            )
            .with_context("command", command);
            if requests_json(args) {
                print_error_json(command, &diagnostic);
            } else {
                print_error(&diagnostic);
            }
            return 2;
        }
    };

    match command {
        Command::AddDependency(options) => commands::add_dependency::run(&options),
        Command::CheckBoundaries(options) => commands::check_boundaries::run(&options),
        Command::CreateDomain(options) => commands::create_domain::run(&options),
        Command::GraphDomains(options) => commands::graph_domains::run(&options),
        Command::Generate(options) => commands::generate::run(&options),
        Command::Init(options) => commands::init::run(&options),
        Command::Impact(options) => commands::impact::run(&options),
        Command::Help => {
            print_help();
            0
        }
        Command::Version => {
            println!("boundra {}", env!("CARGO_PKG_VERSION"));
            0
        }
    }
}

fn requests_json(args: &[String]) -> bool {
    args.windows(2)
        .any(|pair| pair[0] == "--format" && pair[1] == "json")
        || args.iter().any(|arg| arg == "--format=json")
}

fn print_help() {
    println!("Boundra CLI");
    println!();
    println!("Usage:");
    for command in [
        "add-dependency",
        "check-boundaries",
        "create-domain",
        "init",
        "impact",
        "graph-domains",
        "generate",
    ] {
        println!(
            "  boundra {}",
            command_usage(command).expect("known command")
        );
    }
}

fn command_usage(command: &str) -> Option<&'static str> {
    match command {
        "add-dependency" => Some("add-dependency <domain>/<dependency> [--root <path>]"),
        "check-boundaries" => {
            Some("check-boundaries [--root <path>] [--format text|json] [--min-domains <n>]")
        }
        "create-domain" => Some("create-domain <name> [--path <parent-path>] [--root <path>]"),
        "init" => Some("init [--root <path>] [--name <kebab-case>]"),
        "impact" => Some("impact <domain> [--root <path>] [--format text|json]"),
        "graph-domains" => {
            Some("graph-domains [--root <path>] [--format mermaid|dot|json] [--output <path>]")
        }
        "generate" => {
            Some("generate route|query|mutation|resource <domain>/<name> [--root <path>]")
        }
        _ => None,
    }
}
