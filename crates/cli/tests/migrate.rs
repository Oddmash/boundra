use serde_json::Value;
use std::{
    fs,
    path::PathBuf,
    process::{Command, Output},
    sync::atomic::{AtomicUsize, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};
static NEXT_ID: AtomicUsize = AtomicUsize::new(0);

struct Workspace(PathBuf);
impl Workspace {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "boundra-migrate-{}-{}-{}",
            std::process::id(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        Self(root)
    }
    fn run(&self, args: &[&str]) -> Output {
        Command::new(env!("CARGO_BIN_EXE_boundra"))
            .current_dir(&self.0)
            .args(args)
            .output()
            .unwrap()
    }
}
impl Drop for Workspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn migration_plans_existing_features_without_writing() {
    let fixture = Workspace::new();
    let file = fixture.0.join("src/features/order/client/view.ts");
    fs::create_dir_all(file.parent().unwrap()).unwrap();
    fs::write(&file, "import 'react';\nimport '../shared/types';\n").unwrap();
    fs::create_dir_all(fixture.0.join("src/features/NotKebab")).unwrap();
    let output = fixture.run(&["migrate", "--format=json"]);
    assert!(output.status.success());
    let plan: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(plan["source"], "src/features");
    assert_eq!(plan["candidates"][0]["name"], "order");
    assert_eq!(plan["candidates"][0]["source_file_count"], 1);
    assert_eq!(
        plan["candidates"][0]["import_specifiers"],
        serde_json::json!(["../shared/types", "react"])
    );
    assert!(!plan["warnings"].as_array().unwrap().is_empty());
    assert!(!fixture.0.join("boundra.config.json").exists());
    assert_eq!(
        fs::read_to_string(&file).unwrap(),
        "import 'react';\nimport '../shared/types';\n"
    );
}

#[test]
fn ambiguous_and_outside_sources_require_explicit_safe_selection() {
    let fixture = Workspace::new();
    fs::create_dir(fixture.0.join("domains")).unwrap();
    fs::create_dir(fixture.0.join("features")).unwrap();
    assert_eq!(
        fixture.run(&["migrate", "--format=json"]).status.code(),
        Some(2)
    );
    assert!(fixture
        .run(&["migrate", "--from", "features", "--format=json"])
        .status
        .success());
    assert_eq!(
        fixture
            .run(&["migrate", "--from", "../outside", "--format=json"])
            .status
            .code(),
        Some(2)
    );
}
