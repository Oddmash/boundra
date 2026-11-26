use serde_json::Value;
use std::sync::atomic::{AtomicUsize, Ordering};
static NEXT_ID: AtomicUsize = AtomicUsize::new(0);
use std::{
    fs,
    path::PathBuf,
    process::{Command, Output},
    time::{SystemTime, UNIX_EPOCH},
};

struct Workspace(PathBuf);
impl Workspace {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!(
            "boundra-baseline-{}-{}-{}",
            std::process::id(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&path).unwrap();
        let workspace = Self(path);
        assert!(workspace
            .run(&["init", "--name", "baseline-test"])
            .status
            .success());
        assert!(workspace.run(&["create-domain", "order"]).status.success());
        workspace
    }
    fn run(&self, args: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_boundra"))
            .current_dir(&self.0)
            .args(args)
            .output()
            .unwrap()
    }
    fn check(&self) -> (Option<i32>, Value) {
        let output = self.run(&[
            "baseline",
            "check",
            "--baseline",
            "baseline.json",
            "--format=json",
        ]);
        (
            output.status.code(),
            serde_json::from_slice(&output.stdout).unwrap(),
        )
    }
}
impl Drop for Workspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn baseline_accounts_for_duplicates_line_moves_and_renames() {
    let workspace = Workspace::new();
    let file = workspace.0.join("domains/order/client/view.ts");
    fs::write(&file, "import '../server/public';\n").unwrap();
    let create = workspace.run(&["baseline", "create"]);
    assert!(create.status.success());
    let baseline: Value = serde_json::from_slice(&create.stdout).unwrap();
    assert_eq!(baseline["version"], 1);
    assert_eq!(baseline["entries"][0]["count"], 1);
    fs::write(workspace.0.join("baseline.json"), &create.stdout).unwrap();
    fs::write(&file, "\nimport '../server/public';\n").unwrap();
    let (status, report) = workspace.check();
    assert_eq!(status, Some(0));
    assert_eq!(report["existing"].as_array().unwrap().len(), 1);
    fs::write(
        &file,
        "import '../server/public';\nimport '../server/public';\n",
    )
    .unwrap();
    let (status, report) = workspace.check();
    assert_eq!(status, Some(1));
    assert_eq!(report["new"].as_array().unwrap().len(), 1);
    fs::rename(&file, workspace.0.join("domains/order/client/renamed.ts")).unwrap();
    let (status, report) = workspace.check();
    assert_eq!(status, Some(1));
    assert_eq!(report["new"].as_array().unwrap().len(), 2);
    assert_eq!(report["resolved"][0]["count"], 1);
}

#[test]
fn baseline_rejects_invalid_documents_and_coverage_regression() {
    let workspace = Workspace::new();
    assert!(workspace
        .run(&["create-domain", "billing"])
        .status
        .success());
    let create = workspace.run(&["baseline", "create"]);
    assert!(create.status.success());
    fs::write(workspace.0.join("baseline.json"), &create.stdout).unwrap();
    fs::remove_dir_all(workspace.0.join("domains/billing")).unwrap();
    assert_eq!(workspace.check().0, Some(2));
    fs::write(workspace.0.join("baseline.json"), "{ invalid").unwrap();
    assert_eq!(workspace.check().1["errors"][0]["code"], "BASELINE-001");
}
