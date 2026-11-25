use std::process::Command;

use serde_json::Value;

fn run(args: &[&str]) -> std::process::Output {
    Command::new(env!("CARGO_BIN_EXE_boundra"))
        .args(args)
        .output()
        .unwrap()
}

#[test]
fn explains_all_builtin_rules_without_workspace() {
    for number in 1..=6 {
        let rule = format!("BR-{number:03}");
        let output = run(&["explain", &rule, "--format=json"]);
        assert!(output.status.success(), "{rule}");
        let report: Value = serde_json::from_slice(&output.stdout).unwrap();
        assert_eq!(report["rule"], rule);
        assert_eq!(report["meta"]["command"], "explain");
        for field in [
            "title",
            "description",
            "reason",
            "invalid_example",
            "valid_example",
            "suggestion",
        ] {
            assert!(report[field]
                .as_str()
                .is_some_and(|value| !value.is_empty()));
        }
    }
    let text = run(&["explain", "br-001"]);
    assert!(text.status.success());
    let stdout = String::from_utf8_lossy(&text.stdout);
    assert!(stdout.contains("BR-001") && stdout.contains("Invalid:") && stdout.contains("Valid:"));
}

#[test]
fn unknown_rule_and_invalid_options_are_actionable() {
    let result = run(&["explain", "BR-999", "--format", "json"]);
    assert_eq!(result.status.code(), Some(2));
    let error: Value = serde_json::from_slice(&result.stdout).unwrap();
    assert_eq!(error["errors"][0]["code"], "RULE-001");
    let invalid = run(&["explain", "BR-001", "--format=json", "--unknown"]);
    assert_eq!(invalid.status.code(), Some(2));
    assert_eq!(
        serde_json::from_slice::<Value>(&invalid.stdout).unwrap()["errors"][0]["code"],
        "CLI-001"
    );
    assert!(run(&["explain", "--help"]).status.success());
}
