use serde_json::Value;
use std::{
    fs,
    path::PathBuf,
    process::{Command, Output},
    time::{SystemTime, UNIX_EPOCH},
};

struct Fixture(PathBuf);
impl Fixture {
    fn run(&self, args: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_boundra"))
            .current_dir(&self.0)
            .args(args)
            .output()
            .unwrap()
    }
    fn git(&self, args: &[&str]) {
        let result = Command::new("git")
            .current_dir(&self.0)
            .args([
                "-c",
                "user.name=Fixture",
                "-c",
                "user.email=fixture@example.invalid",
                "-c",
                "commit.gpgsign=false",
            ])
            .args(args)
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
    }
    fn check(&self) -> (Option<i32>, Value) {
        let output = self.run(&["check-changed", "--base", "HEAD", "--format=json"]);
        (
            output.status.code(),
            serde_json::from_slice(&output.stdout).unwrap(),
        )
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn changed_report_preserves_full_scan_and_fallbacks() {
    let fixture = Fixture(std::env::temp_dir().join(format!(
            "boundra-changed-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        )));
    fs::create_dir(&fixture.0).unwrap();
    fixture.git(&["init"]);
    assert!(fixture
        .run(&["init", "--name", "changed-test"])
        .status
        .success());
    assert!(fixture.run(&["create-domain", "order"]).status.success());
    let old = fixture.0.join("domains/order/client/old.ts");
    fs::write(&old, "import '../server/public';\n").unwrap();
    fixture.git(&["add", "."]);
    fixture.git(&["commit", "-m", "fixture"]);
    let new = fixture.0.join("domains/order/client/new.ts");
    fs::write(&new, "import '../server/public';\n").unwrap();
    let (status, report) = fixture.check();
    assert_eq!(status, Some(1));
    assert_eq!(report["scope"], "changed");
    assert_eq!(report["focused"].as_array().unwrap().len(), 1);
    assert_eq!(report["other"].as_array().unwrap().len(), 1);
    fixture.git(&["add", "domains/order/client/new.ts"]);
    assert_eq!(fixture.check().1["focused"].as_array().unwrap().len(), 1);
    fs::remove_file(&old).unwrap();
    let (_, report) = fixture.check();
    assert_eq!(report["scope"], "full");
    assert_eq!(report["other"].as_array().unwrap().len(), 0);
    assert_eq!(
        fixture
            .run(&["check-changed", "--base", "not-a-commit", "--format=json"])
            .status
            .code(),
        Some(2)
    );
}
