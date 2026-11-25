use std::collections::BTreeMap;

use boundra_core::Violation;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum OutputFormat {
    Text,
    Json,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BoundaryFormat {
    Text,
    Json,
    Github,
    Sarif,
}

fn escape_command(value: &str) -> String {
    value
        .replace('%', "%25")
        .replace('\r', "%0D")
        .replace('\n', "%0A")
}

fn escape_property(value: &str) -> String {
    escape_command(value)
        .replace(':', "%3A")
        .replace(',', "%2C")
}

#[cfg(test)]
mod report_tests {
    use super::*;

    #[test]
    fn escapes_annotation_delimiters_and_uri_paths() {
        assert_eq!(escape_command("x%\r\ny"), "x%25%0D%0Ay");
        assert_eq!(escape_property("x:y,z\n"), "x%3Ay%2Cz%0A");
        assert_eq!(
            artifact_uri("domains/a b/한글.ts"),
            "domains/a%20b/%ED%95%9C%EA%B8%80.ts"
        );
    }
}

pub(crate) fn print_github(violations: &[Violation], coverage: BoundaryScanCoverage) {
    if violations.is_empty() {
        print_text(violations, coverage);
        return;
    }
    for violation in violations {
        println!(
            "::error file={},line={},title={}::{}",
            escape_property(&violation.file),
            violation.line,
            violation.rule,
            escape_command(&format!("{}; {}", violation.message, violation.suggestion))
        );
    }
}

pub(crate) fn print_github_error(diagnostic: &CliDiagnostic) {
    println!(
        "::error title={}::{}",
        escape_property(&diagnostic.code),
        escape_command(&format!(
            "{}; {}",
            diagnostic.message, diagnostic.suggestion
        ))
    );
}

fn artifact_uri(path: &str) -> String {
    let mut uri = String::new();
    for byte in path.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'/' | b'-' | b'_' | b'.' | b'~') {
            uri.push(char::from(byte));
        } else {
            uri.push_str(&format!("%{byte:02X}"));
        }
    }
    uri
}

pub(crate) fn print_sarif(violations: &[Violation]) {
    let rules = violations
        .iter()
        .map(|v| v.rule.to_string())
        .collect::<std::collections::BTreeSet<_>>();
    let rule_list = rules
        .iter()
        .map(|rule| serde_json::json!({"id":rule,"name":rule}))
        .collect::<Vec<_>>();
    let results = violations.iter().map(|v| serde_json::json!({
        "ruleId":v.rule.to_string(), "level":"error", "message":{"text":format!("{}; {}",v.message,v.suggestion)},
        "locations":[{"physicalLocation":{"artifactLocation":{"uri":artifact_uri(&v.file)},"region":{"startLine":v.line.max(1)}}}]
    })).collect::<Vec<_>>();
    print_sarif_run(
        serde_json::json!({"tool":{"driver":{"name":"Boundra","version":env!("CARGO_PKG_VERSION"),"rules":rule_list}},"invocations":[{"executionSuccessful":true}],"results":results}),
    );
}

pub(crate) fn print_sarif_error(diagnostic: &CliDiagnostic) {
    print_sarif_run(
        serde_json::json!({"tool":{"driver":{"name":"Boundra","version":env!("CARGO_PKG_VERSION")}},"invocations":[{"executionSuccessful":false,"toolExecutionNotifications":[{"level":"error","message":{"text":format!("{}: {}; {}",diagnostic.code,diagnostic.message,diagnostic.suggestion)}}]}],"results":[]}),
    );
}

fn print_sarif_run(run: serde_json::Value) {
    println!("{}",serde_json::to_string_pretty(&serde_json::json!({"$schema":"https://json.schemastore.org/sarif-2.1.0.json","version":"2.1.0","runs":[run]})).expect("serialize SARIF"));
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct CliDiagnostic {
    pub(crate) code: String,
    pub(crate) message: String,
    pub(crate) context: BTreeMap<String, String>,
    pub(crate) suggestion: String,
}

impl CliDiagnostic {
    pub(crate) fn new(
        code: impl Into<String>,
        message: impl Into<String>,
        suggestion: impl Into<String>,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            context: BTreeMap::new(),
            suggestion: suggestion.into(),
        }
    }

    pub(crate) fn with_context(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.context.insert(key.into(), value.into());
        self
    }
}

#[derive(Debug, Serialize)]
struct CheckBoundariesOutput<'a> {
    status: &'a str,
    violations: Vec<ViolationOutput<'a>>,
    meta: OutputMeta<'a>,
}

#[derive(Debug, Serialize)]
struct ViolationOutput<'a> {
    rule: String,
    file: &'a str,
    line: usize,
    import: &'a str,
    message: &'a str,
    suggestion: &'a str,
}

#[derive(Debug, Serialize)]
struct OutputMeta<'a> {
    command: &'a str,
    violation_count: usize,
    scanned_file_count: usize,
    analyzed_domain_count: usize,
}

/// Coverage metadata emitted with boundary-check results.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct BoundaryScanCoverage {
    /// Total source files included by the scanner.
    pub(crate) scanned_file_count: usize,
    /// Unique domains with at least one included source file.
    pub(crate) analyzed_domain_count: usize,
}

#[derive(Debug, Serialize)]
struct ErrorOutput<'a> {
    status: &'static str,
    errors: [&'a CliDiagnostic; 1],
    meta: ErrorMeta<'a>,
}

#[derive(Debug, Serialize)]
struct ErrorMeta<'a> {
    command: &'a str,
}

pub(crate) fn print_error(diagnostic: &CliDiagnostic) {
    eprintln!("[ERROR] {}", diagnostic.code);
    eprintln!("message: {}", diagnostic.message);
    for (key, value) in &diagnostic.context {
        eprintln!("{key}: {value}");
    }
    eprintln!("suggestion: {}", diagnostic.suggestion);
}

pub(crate) fn print_error_json(command: &str, diagnostic: &CliDiagnostic) {
    let output = ErrorOutput {
        status: "error",
        errors: [diagnostic],
        meta: ErrorMeta { command },
    };
    println!(
        "{}",
        serde_json::to_string_pretty(&output).expect("failed to serialize error output")
    );
}

pub(crate) fn print_text(violations: &[Violation], coverage: BoundaryScanCoverage) {
    println!(
        "Scanned {} source file(s) across {} analyzed domain(s)",
        coverage.scanned_file_count, coverage.analyzed_domain_count
    );
    if coverage.scanned_file_count == 0 {
        println!("[WARNING] check-boundaries scanned no source files");
    }
    if coverage.analyzed_domain_count == 0 {
        println!("[WARNING] check-boundaries analyzed no domains");
    }

    if violations.is_empty() {
        println!("check-boundaries: OK (no violations)");
        return;
    }

    for violation in violations {
        println!("[BOUNDARY_VIOLATION] {}", violation.rule);
        println!("file: {}", violation.file);
        println!("import: {}", violation.import_path);
        println!("line: {}", violation.line);
        println!("message: {}", violation.message);
        println!("suggestion: {}", violation.suggestion);
        println!();
    }

    println!(
        "check-boundaries: FAILED ({} violation(s))",
        violations.len()
    );
}

pub(crate) fn print_json(violations: &[Violation], coverage: BoundaryScanCoverage) {
    let status = if violations.is_empty() {
        "passed"
    } else {
        "failed"
    };
    let output = CheckBoundariesOutput {
        status,
        violations: violations
            .iter()
            .map(|violation| ViolationOutput {
                rule: violation.rule.to_string(),
                file: &violation.file,
                line: violation.line,
                import: &violation.import_path,
                message: &violation.message,
                suggestion: &violation.suggestion,
            })
            .collect(),
        meta: OutputMeta {
            command: "check-boundaries",
            violation_count: violations.len(),
            scanned_file_count: coverage.scanned_file_count,
            analyzed_domain_count: coverage.analyzed_domain_count,
        },
    };

    println!(
        "{}",
        serde_json::to_string_pretty(&output).expect("failed to serialize JSON output")
    );
}
