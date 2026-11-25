use serde_json::{json, Value};
use std::{
    fs,
    io::Write,
    path::PathBuf,
    process::{Command, Stdio},
    time::{SystemTime, UNIX_EPOCH},
};

struct Fixture(PathBuf);
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
impl Fixture {
    fn command(&self) -> Command {
        let mut cmd = Command::new(env!("CARGO_BIN_EXE_boundra"));
        cmd.current_dir(&self.0);
        cmd
    }
    fn start(&self) -> Command {
        let mut cmd = self.command();
        cmd.args(["mcp", "--root", "."]);
        cmd
    }
}

#[test]
fn reads_explicit_snapshots_without_mutating_workspace() {
    let fixture = Fixture(std::env::temp_dir().join(format!(
            "boundra-mcp-{}-{}",
            std::process::id(),
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        )));
    fs::create_dir(&fixture.0).unwrap();
    for args in [
        &["init", "--name", "mcp-test"][..],
        &["create-domain", "billing"],
        &["create-domain", "shipping"],
        &["add-dependency", "billing/shipping"],
    ] {
        assert!(fixture
            .command()
            .args(args)
            .output()
            .unwrap()
            .status
            .success());
    }
    let graph = fixture
        .command()
        .args(["graph-domains", "--format", "json"])
        .output()
        .unwrap()
        .stdout;
    fs::write(fixture.0.join(".boundra-graph.json"), &graph).unwrap();
    fs::write(
        fixture.0.join("domains/billing/client/a.ts"),
        "import '../server/public';\n",
    )
    .unwrap();
    let diagnostics = fixture
        .command()
        .args(["check-boundaries", "--format", "json"])
        .output()
        .unwrap()
        .stdout;
    fs::write(fixture.0.join(".boundra-diagnostics.json"), &diagnostics).unwrap();
    let mut child = fixture
        .start()
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .spawn()
        .unwrap();
    let requests = [
        json!({"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25"}}),
        json!({"jsonrpc":"2.0","method":"notifications/initialized"}),
        json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}),
        json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"impact","arguments":{"domain":"shipping"}}}),
        json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"diagnostics"}}),
        json!({"jsonrpc":"2.0","id":5,"method":"resources/read","params":{"uri":"file:///etc/passwd"}}),
        json!({"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"domains","arguments":{"root":"/"}}}),
    ];
    let mut stdin = child.stdin.take().unwrap();
    for request in requests {
        writeln!(stdin, "{request}").unwrap();
    }
    writeln!(stdin, "invalid-json").unwrap();
    drop(stdin);
    let output = child.wait_with_output().unwrap();
    assert!(output.status.success());
    let responses: Vec<Value> = String::from_utf8(output.stdout)
        .unwrap()
        .lines()
        .map(|line| serde_json::from_str(line).unwrap())
        .collect();
    assert_eq!(responses.len(), 7);
    assert_eq!(responses[0]["result"]["protocolVersion"], "2025-11-25");
    assert_eq!(responses[1]["result"]["tools"].as_array().unwrap().len(), 3);
    assert_eq!(
        responses[2]["result"]["structuredContent"]["dependents"],
        json!(["billing"])
    );
    assert_eq!(
        responses[3]["result"]["structuredContent"]["violations"][0]["rule"],
        "BR-001"
    );
    assert_eq!(responses[4]["error"]["code"], -32602);
    assert_eq!(responses[5]["error"]["code"], -32602);
    assert_eq!(responses[6]["error"]["code"], -32700);
    assert_eq!(
        fs::read(fixture.0.join(".boundra-graph.json")).unwrap(),
        graph
    );
    assert_eq!(
        fs::read(fixture.0.join(".boundra-diagnostics.json")).unwrap(),
        diagnostics
    );
    #[cfg(unix)]
    {
        let path = fixture.0.join(".boundra-graph.json");
        fs::remove_file(&path).unwrap();
        std::os::unix::fs::symlink(fixture.0.join(".boundra-diagnostics.json"), path).unwrap();
        assert_eq!(fixture.start().output().unwrap().status.code(), Some(2));
    }
}
