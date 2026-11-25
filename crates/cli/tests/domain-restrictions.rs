use serde_json::{json, Value};
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
    fn check(&self) -> (Option<i32>, Value) {
        let output = self.run(&["check-boundaries", "--format=json"]);
        (
            output.status.code(),
            serde_json::from_slice(&output.stdout).unwrap(),
        )
    }
    fn policy(&self, value: Value) {
        let file = self.0.join("boundra.config.json");
        let mut config: Value = serde_json::from_slice(&fs::read(&file).unwrap()).unwrap();
        config["checkBoundaries"]["denyDomainDependencies"] = value;
        fs::write(file, serde_json::to_vec(&config).unwrap()).unwrap();
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn additive_domain_restrictions_preserve_built_in_rules() {
    let fixture = Fixture(std::env::temp_dir().join(format!(
            "boundra-restrictions-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        )));
    fs::create_dir(&fixture.0).unwrap();
    for args in [
        &["init", "--name", "restrictions-test"][..],
        &["create-domain", "billing"],
        &["create-domain", "shipping"],
        &["add-dependency", "billing/shipping"],
    ] {
        assert!(fixture.run(args).status.success());
    }
    let file = fixture.0.join("domains/billing/client/view.ts");
    fs::write(&file, "import '../../shipping/shared/public';\n").unwrap();
    assert_eq!(fixture.check().0, Some(0));
    fixture.policy(json!({"billing": ["shipping"]}));
    let (status, report) = fixture.check();
    assert_eq!(status, Some(1));
    assert_eq!(report["violations"][0]["rule"], "BR-007");
    assert_eq!(report["violations"].as_array().unwrap().len(), 1);
    fs::write(
        &file,
        "import '../../shipping/shared/public';\nimport '../server/public';\n",
    )
    .unwrap();
    let (_, report) = fixture.check();
    assert!(report["violations"]
        .as_array()
        .unwrap()
        .iter()
        .any(|v| v["rule"] == "BR-001"));
    for invalid in [
        json!({"billing": ["missing"]}),
        json!({"missing": ["shipping"]}),
        json!({"billing": ["billing"]}),
        json!({"billing": ["shipping", "shipping"]}),
    ] {
        fixture.policy(invalid);
        assert_eq!(fixture.check().0, Some(2));
    }
}
