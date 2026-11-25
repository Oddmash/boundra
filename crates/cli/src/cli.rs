use crate::commands;
use crate::output::{print_error, print_error_json, CliDiagnostic};
use crate::parsing::{parse_command, Command};

pub fn run(args: &[String]) -> i32 {
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
        Command::Baseline(options) => commands::baseline::run(&options),
        Command::Changed(options) => commands::changed::run(&options),
        Command::Completions(shell) => commands::completions::run(shell),
        Command::CheckBoundaries(options) => commands::check_boundaries::run(&options),
        Command::CreateDomain(options) => commands::create_domain::run(&options),
        Command::GraphDomains(options) => commands::graph_domains::run(&options),
        Command::Generate(options) => commands::generate::run(&options),
        Command::Init(options) => commands::init::run(&options),
        Command::Migrate(options) => commands::migrate::run(&options),
        Command::Mcp(root) => commands::mcp::run(&root),
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

pub(crate) const HELP_COMMANDS: &[&str] = &[
    "add-dependency <domain>/<dependency> [--root <path>]",
    "check-changed --base <ref> [--root <path>] [--format text|json]",
    "baseline create|check [--root <path>] [--baseline <path>] [--format text|json]",
    "check-boundaries [--root <path>] [--format text|json] [--min-domains <n>]",
    "create-domain <name> [--path <parent-path>] [--root <path>]",
    "init [--root <path>] [--name <kebab-case>]",
    "migrate [--root <path>] [--from <relative-path>] [--format text|json]",
    "graph-domains [--root <path>] [--format mermaid|dot|json|html] [--output <path>]",
    "generate route|query|mutation|resource <domain>/<name> [--root <path>]",
    "completions bash|zsh|fish",
    "mcp --root <path>",
    "help",
    "--help",
    "--version",
];

fn print_help() {
    println!("Boundra CLI\n\nUsage:");
    for command in HELP_COMMANDS {
        println!("  boundra {command}");
    }
}
