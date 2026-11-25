use std::fs;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::Value;

static NEXT_ID: AtomicUsize = AtomicUsize::new(0);

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!(
            "boundra-watch-{}-{}-{}",
            std::process::id(),
            NEXT_ID.fetch_add(1, Ordering::Relaxed),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir(&root).unwrap();
        let fixture = Self(root);
        assert!(fixture
            .run(&["init", "--name", "watch-test"])
            .status
            .success());
        assert!(fixture.run(&["create-domain", "order"]).status.success());
        fixture
    }
    fn command(&self, args: &[&str]) -> Command {
        let mut cmd = Command::new(env!("CARGO_BIN_EXE_boundra"));
        cmd.current_dir(&self.0).args(args);
        cmd
    }
    fn run(&self, args: &[&str]) -> std::process::Output {
        self.command(args).output().unwrap()
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
struct WatchProcess(Child);
impl Drop for WatchProcess {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

#[test]
fn watch_once_preserves_check_exit_and_json() {
    let fixture = Fixture::new();
    let output = fixture.run(&["watch", "--once", "--format=json", "--min-domains", "2"]);
    assert_eq!(output.status.code(), Some(2));
    let event: Value = serde_json::from_slice(&output.stdout).unwrap();
    assert_eq!(event["event"], "scan");
    assert_eq!(event["exit_code"], 2);
    assert_eq!(event["report"]["errors"][0]["code"], "COVERAGE-001");
    assert_eq!(
        fixture
            .run(&["watch", "--interval-ms=0", "--once"])
            .status
            .code(),
        Some(2)
    );
}

#[test]
fn watch_emits_changed_full_scan_snapshots() {
    let fixture = Fixture::new();
    let mut child = WatchProcess(
        fixture
            .command(&["watch", "--format=json", "--interval-ms=250"])
            .stdout(Stdio::piped())
            .spawn()
            .unwrap(),
    );
    let stdout = child.0.stdout.take().unwrap();
    let (send, receive) = mpsc::channel();
    let reader = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if send
                .send(serde_json::from_str::<Value>(&line).unwrap())
                .is_err()
            {
                break;
            }
        }
    });
    let next = || {
        receive
            .recv_timeout(Duration::from_secs(10))
            .expect("watch snapshot")
    };
    assert_eq!(next()["exit_code"], 0);
    assert!(receive.recv_timeout(Duration::from_millis(600)).is_err());
    let file = fixture.0.join("domains/order/client/view.ts");
    fs::write(&file, "import '../server/public';\n").unwrap();
    let violation = next();
    assert_eq!(violation["exit_code"], 1);
    assert_eq!(violation["report"]["violations"][0]["rule"], "BR-001");
    fs::remove_file(&file).unwrap();
    assert_eq!(next()["exit_code"], 0);
    let config = fixture.0.join("boundra.config.json");
    let original = fs::read(&config).unwrap();
    fs::write(&config, "{ invalid").unwrap();
    assert_eq!(next()["exit_code"], 2);
    fs::write(&config, original).unwrap();
    assert_eq!(next()["exit_code"], 0);
    assert!(fixture.run(&["create-domain", "billing"]).status.success());
    let next_matching = |predicate: &dyn Fn(&Value) -> bool| {
        let deadline = std::time::Instant::now() + Duration::from_secs(10);
        loop {
            let value = receive
                .recv_timeout(deadline.saturating_duration_since(std::time::Instant::now()))
                .expect("matching watch snapshot");
            if predicate(&value) {
                return value;
            }
        }
    };
    next_matching(&|event| event["report"]["meta"]["analyzed_domain_count"] == 2);
    fs::write(&file, "import '@billing/shared/public';\n").unwrap();
    next_matching(&|event| {
        event["exit_code"] == 0
            && event["report"]["meta"]["scanned_file_count"]
                .as_u64()
                .unwrap_or(0)
                > 0
    });
    fs::write(
        fixture.0.join("tsconfig.json"),
        r#"{"compilerOptions":{"paths":{"@billing/*":["domains/billing/*"]}}}"#,
    )
    .unwrap();
    let dependency = next_matching(&|event| event["exit_code"] == 1);
    assert_eq!(dependency["report"]["violations"][0]["rule"], "BR-006");
    assert!(fixture
        .run(&["add-dependency", "order/billing"])
        .status
        .success());
    assert_eq!(next()["exit_code"], 0);
    drop(child);
    reader.join().unwrap();
}
