use boundra_core::RuleCode;
use serde::Serialize;

use crate::output::{print_error, print_error_json, CliDiagnostic, OutputFormat};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ExplainOptions {
    pub(crate) rule: String,
    pub(crate) format: OutputFormat,
}

#[derive(Serialize)]
struct Explanation {
    rule: &'static str,
    title: &'static str,
    description: &'static str,
    reason: &'static str,
    invalid_example: &'static str,
    valid_example: &'static str,
    suggestion: &'static str,
    meta: Meta,
}

#[derive(Serialize)]
struct Meta {
    command: &'static str,
}

fn explanation(rule: RuleCode) -> Explanation {
    let (title, description, reason, invalid_example, valid_example, suggestion) = match rule {
        RuleCode::Br001 => ("Client-to-server import ban", "Client-layer files cannot import server-layer files.", "Client and server execute in different deployment environments.", "domains/order/client/view.ts imports ../server/service", "domains/order/client/view.ts imports ../shared/contracts/get-order", "Move shared contracts to the shared layer or call the server through an API boundary."),
        RuleCode::Br002 => ("Server-to-client import ban", "Server-layer files cannot import client-layer files.", "Reverse dependencies couple server logic to client implementations.", "domains/order/server/service.ts imports ../client/view", "domains/order/server/service.ts imports ../shared/contracts/get-order", "Move reusable pure logic into the shared layer."),
        RuleCode::Br003 => ("Shared purity", "Shared-layer files cannot import capabilities denied by the configured shared policy; defaults include UI, database and runtime.", "Shared contracts must be usable across execution environments.", "domains/order/shared/types.ts imports react under the default policy", "domains/order/shared/types.ts imports zod for a pure schema", "Move environment-specific logic into its owning layer; inspect configured capabilities and shared policy."),
        RuleCode::Br004 => ("Cross-domain access policy", "A domain cannot import another domain's internal paths; only its declared public API is allowed.", "Encapsulation protects callers from changes to another domain's internals.", "domains/order/server/checkout.ts imports domains/billing/server/internal/invoice", "domains/order/server/checkout.ts imports domains/billing/server/public when exposed and declared as a dependency", "Import from a manifest-declared public API and declare the dependency where required."),
        RuleCode::Br005 => ("App-to-domain public API policy", "Application files can only import a domain's manifest-declared public API.", "Application composition should not depend on private domain implementation details.", "apps/web/src/checkout.ts imports domains/order/server/internal/checkout", "apps/web/src/checkout.ts imports domains/order/server/public when exposed", "Import from the domain's declared public API instead."),
        RuleCode::Br006 => ("Declared domain dependency policy", "Cross-domain public API imports require the target domain in the source domain's dependsOn declaration.", "Declared dependencies must match code dependencies to avoid hidden coupling.", "order imports billing/server/public while order.dependsOn omits billing", "order imports billing/server/public with billing declared in order.dependsOn", "Use boundra add-dependency order/billing when the dependency is intentional, or remove the import."),
        RuleCode::Br007 => ("Declarative domain restriction", "A source domain cannot import another domain explicitly denied by checkBoundaries.denyDomainDependencies.", "Projects can impose additional domain restrictions without weakening the built-in rules.", "billing imports shipping/shared/public while billing denies shipping", "billing imports its own shared contracts", "Remove the prohibited import or revise the approved domain restriction."),
    };
    Explanation {
        rule: rule.as_str(),
        title,
        description,
        reason,
        invalid_example,
        valid_example,
        suggestion,
        meta: Meta { command: "explain" },
    }
}

pub(crate) fn run(options: &ExplainOptions) -> i32 {
    let rule = match options.rule.to_ascii_uppercase().as_str() {
        "BR-001" => RuleCode::Br001,
        "BR-002" => RuleCode::Br002,
        "BR-003" => RuleCode::Br003,
        "BR-004" => RuleCode::Br004,
        "BR-005" => RuleCode::Br005,
        "BR-006" => RuleCode::Br006,
        "BR-007" => RuleCode::Br007,
        _ => {
            let diagnostic = CliDiagnostic::new(
                "RULE-001",
                format!("unknown boundary rule '{}'", options.rule),
                "choose a boundary rule from BR-001 through BR-007",
            )
            .with_context("rule", &options.rule);
            match options.format {
                OutputFormat::Text => print_error(&diagnostic),
                OutputFormat::Json => print_error_json("explain", &diagnostic),
            }
            return 2;
        }
    };
    let info = explanation(rule);
    match options.format {
        OutputFormat::Json => println!(
            "{}",
            serde_json::to_string_pretty(&info).expect("serialize rule explanation")
        ),
        OutputFormat::Text => {
            println!("{}: {}", info.rule, info.title);
            println!("Rule: {}", info.description);
            println!("Why: {}", info.reason);
            println!("Invalid: {}", info.invalid_example);
            println!("Valid: {}", info.valid_example);
            println!("Suggestion: {}", info.suggestion);
        }
    }
    0
}
