use std::fs;
use std::path::PathBuf;
use std::process::{Command, Output};
use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;

struct Workspace(PathBuf);

impl Workspace {
    fn new() -> Self {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "boundra-coverage-{}-{nonce}",
            std::process::id()
        ));
        fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn run(&self, args: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_boundra"))
            .args(args)
            .arg("--root")
            .arg(&self.0)
            .output()
            .unwrap()
    }
}

impl Drop for Workspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn json(output: &Output) -> Value {
    serde_json::from_slice(&output.stdout).unwrap()
}

#[test]
fn minimum_domain_coverage_preserves_default_and_violation_behavior() {
    let workspace = Workspace::new();
    assert!(workspace.run(&["init", "--name", "coverage-test"]).status.success());

    let default_scan = workspace.run(&["check-boundaries", "--format", "json"]);
    assert_eq!(default_scan.status.code(), Some(0));
    assert_eq!(json(&default_scan)["meta"]["analyzed_domain_count"], 0);

    let empty = workspace.run(&["check-boundaries", "--format=json", "--min-domains", "1"]);
    assert_eq!(empty.status.code(), Some(2));
    let report = json(&empty);
    assert_eq!(report["status"], "error");
    assert_eq!(report["errors"][0]["code"], "COVERAGE-001");
    assert_eq!(report["errors"][0]["context"]["minimum_domain_count"], "1");
    assert_eq!(report["errors"][0]["context"]["analyzed_domain_count"], "0");

    assert!(workspace.run(&["create-domain", "order"]).status.success());
    let one = workspace.run(&["check-boundaries", "--format=json", "--min-domains=1"]);
    assert_eq!(one.status.code(), Some(0));
    assert_eq!(json(&one)["meta"]["analyzed_domain_count"], 1);

    let insufficient = workspace.run(&["check-boundaries", "--format=json", "--min-domains=2"]);
    assert_eq!(insufficient.status.code(), Some(2));
    assert_eq!(json(&insufficient)["errors"][0]["code"], "COVERAGE-001");

    let text = workspace.run(&["check-boundaries", "--min-domains=2"]);
    assert_eq!(text.status.code(), Some(2));
    assert!(String::from_utf8_lossy(&text.stderr).contains("COVERAGE-001"));

    fs::write(
        workspace.0.join("domains/order/client/invalid-import.ts"),
        "import '../server/public';",
    )
    .unwrap();
    let violation = workspace.run(&["check-boundaries", "--format=json", "--min-domains=2"]);
    assert_eq!(violation.status.code(), Some(1));
    assert_eq!(json(&violation)["violations"][0]["rule"], "BR-001");
}

#[test]
fn minimum_domain_coverage_rejects_invalid_flags() {
    let workspace = Workspace::new();
    for flag in ["--min-domains=0", "--min-domains=-1", "--min-domains=invalid"] {
        let output = workspace.run(&["check-boundaries", "--format=json", flag]);
        assert_eq!(output.status.code(), Some(2));
        assert_eq!(json(&output)["errors"][0]["code"], "CLI-001");
    }
}
