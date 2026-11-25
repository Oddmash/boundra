use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use boundra_core::load_project_model;
use boundra_parser::{
    collect_imports_with_report, incremental_experiment::ExperimentalImportCache, ScanOptions,
};
use boundra_rules::{check_boundaries_with_config, BoundaryContext};

struct Fixture(PathBuf);
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn cli(root: &Path, args: &[&str]) {
    let output = Command::new(env!("CARGO_BIN_EXE_boundra"))
        .current_dir(root)
        .args(args)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
}

fn compare(root: &Path, cache: &mut ExperimentalImportCache) -> (usize, f64, f64) {
    let project = load_project_model(root).unwrap();
    let options = ScanOptions {
        include_extensions: project.config.check_boundaries.include_extensions.clone(),
        ignore: project.config.check_boundaries.ignore.clone(),
    };
    let context = BoundaryContext {
        apps_path: project.config.paths.apps.clone(),
        domains_path: project.config.paths.domains.clone(),
        packages_path: project.config.paths.packages.clone(),
        domains: project.domains,
        domain_roots: project.domain_roots,
        path_aliases: project.path_aliases,
    };
    let start = Instant::now();
    let full = collect_imports_with_report(root, &options).unwrap();
    let expected =
        check_boundaries_with_config(&full.imports, &context, &project.config.check_boundaries);
    let full_ms = start.elapsed().as_secs_f64() * 1000.0;
    let start = Instant::now();
    let candidate = cache.scan(root, &options).unwrap();
    let actual = check_boundaries_with_config(
        &candidate.imports,
        &context,
        &project.config.check_boundaries,
    );
    let cached_ms = start.elapsed().as_secs_f64() * 1000.0;
    assert_eq!(candidate, full);
    assert_eq!(actual, expected);
    (expected.len(), full_ms, cached_ms)
}

#[test]
fn experimental_cache_matches_full_scan_after_workspace_edits() {
    let root = Fixture(
        std::env::temp_dir().join(format!(
            "boundra-incremental-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        )),
    );
    fs::create_dir(&root.0).unwrap();
    cli(&root.0, &["init", "--name", "incremental-experiment"]);
    cli(&root.0, &["create-domain", "order"]);
    cli(&root.0, &["create-domain", "billing"]);
    cli(&root.0, &["add-dependency", "billing/order"]);
    fs::write(
        root.0.join("tsconfig.json"),
        r#"{"compilerOptions":{"paths":{"@order/*":["domains/order/*"]}}}"#,
    )
    .unwrap();
    for index in 0..1000 {
        fs::write(
            root.0
                .join(format!("domains/billing/client/feature-{index}.ts")),
            "import '@order/shared/public';\n",
        )
        .unwrap();
    }
    let mut cache = ExperimentalImportCache::default();
    let cold = compare(&root.0, &mut cache);
    let warm = compare(&root.0, &mut cache);
    let edited = root.0.join("domains/billing/client/feature-0.ts");
    fs::write(&edited, "import '@order/server/public';\n").unwrap();
    let changed = compare(&root.0, &mut cache);
    assert!(changed.0 > cold.0);
    fs::remove_file(&edited).unwrap();
    assert_eq!(compare(&root.0, &mut cache).0, cold.0);
    fs::write(&edited, "import '@order/shared/public';\n").unwrap();
    assert_eq!(compare(&root.0, &mut cache).0, cold.0);
    fs::write(
        root.0.join("tsconfig.json"),
        r#"{"compilerOptions":{"paths":{"@order/*":["domains/billing/*"]}}}"#,
    )
    .unwrap();
    compare(&root.0, &mut cache);
    fs::write(
        root.0.join("tsconfig.json"),
        r#"{"compilerOptions":{"paths":{"@order/*":["domains/order/*"]}}}"#,
    )
    .unwrap();
    let manifest = root.0.join("domains/billing/domain.json");
    let mut value: serde_json::Value =
        serde_json::from_slice(&fs::read(&manifest).unwrap()).unwrap();
    value["dependsOn"] = serde_json::json!([]);
    fs::write(&manifest, serde_json::to_vec(&value).unwrap()).unwrap();
    assert!(compare(&root.0, &mut cache).0 > cold.0);
    let config = root.0.join("boundra.config.json");
    let mut value: serde_json::Value = serde_json::from_slice(&fs::read(&config).unwrap()).unwrap();
    value["checkBoundaries"]["ignore"] = serde_json::json!(["domains/billing/client/**"]);
    fs::write(&config, serde_json::to_vec(&value).unwrap()).unwrap();
    assert_eq!(compare(&root.0, &mut cache).0, 0);
    println!(
        "cold full/cached: {:.2}/{:.2} ms; warm: {:.2}/{:.2} ms; one edit: {:.2}/{:.2} ms",
        cold.1, cold.2, warm.1, warm.2, changed.1, changed.2
    );
}
