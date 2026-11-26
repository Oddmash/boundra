use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::{self, BufRead, Read, Write},
    path::Path,
};

const VERSION: &str = "2025-11-25";
const SCHEMA: &str = "boundra.architecture.v1";
const DOMAINS_URI: &str = "boundra://architecture/v1/domains";
const DIAGNOSTICS_URI: &str = "boundra://architecture/v1/diagnostics";

#[derive(Serialize, Deserialize)]
struct Domain {
    name: String,
    depends_on: Vec<String>,
}
#[derive(Serialize, Deserialize)]
struct Edge {
    from: String,
    to: String,
}
#[derive(Deserialize)]
struct Graph {
    domains: Vec<Domain>,
    edges: Vec<Edge>,
    meta: Value,
}
#[derive(Serialize, Deserialize)]
struct Diagnostic {
    rule: String,
    file: String,
    line: usize,
    import: String,
    message: String,
    suggestion: String,
}
#[derive(Deserialize)]
struct Diagnostics {
    status: String,
    violations: Vec<Diagnostic>,
    meta: Value,
}
struct Snapshot {
    graph: Graph,
    diagnostics: Diagnostics,
}

fn load<T: serde::de::DeserializeOwned>(root: &Path, name: &str) -> Result<T, String> {
    let path = root.join(name);
    let metadata = fs::symlink_metadata(&path).map_err(|e| e.to_string())?;
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 8 * 1024 * 1024
    {
        return Err(format!(
            "{name} must be a regular snapshot file of at most 8 MiB"
        ));
    }
    let mut buffer = Vec::new();
    fs::File::open(path)
        .map_err(|e| e.to_string())?
        .take(8 * 1024 * 1024 + 1)
        .read_to_end(&mut buffer)
        .map_err(|e| e.to_string())?;
    if buffer.len() > 8 * 1024 * 1024 {
        return Err("snapshot exceeds size limit".into());
    }
    serde_json::from_slice(&buffer).map_err(|e| format!("invalid snapshot JSON: {e}"))
}

impl Snapshot {
    fn load(root: &Path) -> Result<Self, String> {
        let root = root.canonicalize().map_err(|e| e.to_string())?;
        let graph: Graph = load(&root, ".boundra-graph.json")?;
        let diagnostics: Diagnostics = load(&root, ".boundra-diagnostics.json")?;
        let names: BTreeSet<_> = graph.domains.iter().map(|d| d.name.as_str()).collect();
        let declared: BTreeSet<_> = graph
            .domains
            .iter()
            .flat_map(|d| {
                d.depends_on
                    .iter()
                    .map(move |to| (d.name.as_str(), to.as_str()))
            })
            .collect();
        let edges: BTreeSet<_> = graph
            .edges
            .iter()
            .map(|e| (e.from.as_str(), e.to.as_str()))
            .collect();
        if graph.meta["command"] != "graph-domains"
            || graph.meta["format"] != "json"
            || graph.meta["domain_count"].as_u64() != Some(graph.domains.len() as u64)
            || graph.meta["edge_count"].as_u64() != Some(graph.edges.len() as u64)
            || names.len() != graph.domains.len()
            || edges.len() != graph.edges.len()
            || declared != edges
            || !names.iter().all(|name| crate::util::is_kebab_case(name))
            || edges
                .iter()
                .any(|(from, to)| from == to || !names.contains(to))
        {
            return Err("invalid declared domain graph".into());
        }
        if diagnostics.meta["command"] != "check-boundaries"
            || diagnostics.meta["scanned_file_count"].as_u64().is_none()
            || diagnostics.meta["analyzed_domain_count"].as_u64().is_none()
            || diagnostics.meta["violation_count"].as_u64()
                != Some(diagnostics.violations.len() as u64)
            || diagnostics.status
                != if diagnostics.violations.is_empty() {
                    "passed"
                } else {
                    "failed"
                }
            || diagnostics.violations.iter().any(|d| {
                d.line == 0
                    || d.file.is_empty()
                    || d.file.contains('\\')
                    || d.file.contains(':')
                    || Path::new(&d.file).is_absolute()
                    || d.file.split('/').any(|p| p == ".." || p.is_empty())
            })
        {
            return Err("invalid boundary diagnostic snapshot".into());
        }
        Ok(Self { graph, diagnostics })
    }
    fn domains(&self) -> Value {
        json!({"schema": SCHEMA, "kind": "declared", "domains": self.graph.domains, "edges": self.graph.edges})
    }
    fn diagnostics(&self) -> Value {
        json!({"schema": SCHEMA, "status": self.diagnostics.status, "coverage": {"scanned_file_count": self.diagnostics.meta["scanned_file_count"], "analyzed_domain_count": self.diagnostics.meta["analyzed_domain_count"]}, "violations": self.diagnostics.violations})
    }
    fn impact(&self, domain: &str) -> Option<Value> {
        if !self.graph.domains.iter().any(|d| d.name == domain) {
            return None;
        }
        let mut reverse: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
        for edge in &self.graph.edges {
            reverse.entry(&edge.to).or_default().push(&edge.from);
        }
        let mut visited = BTreeSet::from([domain]);
        let mut pending = vec![domain];
        while let Some(current) = pending.pop() {
            for next in reverse.get(current).into_iter().flatten() {
                if visited.insert(next) {
                    pending.push(next);
                }
            }
        }
        visited.remove(domain);
        Some(json!({"schema": SCHEMA, "kind": "declared", "domain":domain, "dependents":visited}))
    }
}

fn rpc_error(id: Value, code: i32, message: &str) -> Value {
    json!({"jsonrpc":"2.0","id":id,"error":{"code":code,"message":message}})
}
fn rpc_result(id: Value, result: Value) -> Value {
    json!({"jsonrpc":"2.0","id":id,"result":result})
}
fn tool_result(value: Value) -> Value {
    json!({"content":[{"type":"text","text":value.to_string()}],"structuredContent": value})
}
fn tools() -> Value {
    json!({"tools":[
        {"name":"domains","description":"Read declared domain graph","inputSchema":{"type":"object","properties":{},"additionalProperties":false},"annotations":{"readOnlyHint":true}},
        {"name":"impact","description":"Read transitive declared dependents","inputSchema":{"type":"object","properties":{"domain":{"type":"string"}},"required":["domain"],"additionalProperties":false},"annotations":{"readOnlyHint":true}},
        {"name":"diagnostics","description":"Read boundary diagnostics snapshot","inputSchema":{"type":"object","properties":{},"additionalProperties":false},"annotations":{"readOnlyHint":true}}
    ]})
}

fn handle(snapshot: &Snapshot, state: &mut u8, request: Value) -> Option<Value> {
    let id = request.get("id").cloned();
    if request["jsonrpc"] != "2.0"
        || !request["method"].is_string()
        || id
            .as_ref()
            .is_some_and(|id| !id.is_string() && !id.is_i64() && !id.is_u64())
    {
        return Some(rpc_error(Value::Null, -32600, "Invalid request"));
    }
    let method = request["method"].as_str().unwrap();
    if id.is_none() {
        if method == "notifications/initialized" && *state == 1 {
            *state = 2;
        }
        return None;
    }
    let id = id.unwrap();
    if method == "initialize" && *state == 0 && request["params"]["protocolVersion"].is_string() {
        *state = 1;
        return Some(rpc_result(
            id,
            json!({"protocolVersion": VERSION, "capabilities":{"tools":{},"resources":{}},"serverInfo":{"name":"boundra","version": env!("CARGO_PKG_VERSION")}}),
        ));
    }
    if method == "ping" {
        return Some(rpc_result(id, json!({})));
    }
    if *state != 2 {
        return Some(rpc_error(id, -32002, "Server not initialized"));
    }
    let result = match method {
        "tools/list" => tools(),
        "resources/list" => {
            json!({"resources":[{"uri":DOMAINS_URI,"name":"Declared domains","mimeType":"application/json"},{"uri":DIAGNOSTICS_URI,"name":"Boundary diagnostics","mimeType":"application/json"}]})
        }
        "resources/read" => {
            let Some(uri) = request["params"]["uri"].as_str() else {
                return Some(rpc_error(id, -32602, "Invalid resource URI"));
            };
            let value = match uri {
                DOMAINS_URI => snapshot.domains(),
                DIAGNOSTICS_URI => snapshot.diagnostics(),
                _ => return Some(rpc_error(id, -32602, "Unknown resource URI")),
            };
            json!({"contents":[{"uri":uri,"mimeType":"application/json","text":value.to_string()}]})
        }
        "tools/call" => {
            let args = request["params"]
                .get("arguments")
                .cloned()
                .unwrap_or_else(|| json!({}));
            let Some(args) = args.as_object() else {
                return Some(rpc_error(id, -32602, "Invalid arguments"));
            };
            let value = match request["params"]["name"].as_str() {
                Some("domains") if args.is_empty() => snapshot.domains(),
                Some("diagnostics") if args.is_empty() => snapshot.diagnostics(),
                Some("impact") if args.len() == 1 => match args
                    .get("domain")
                    .and_then(Value::as_str)
                    .and_then(|domain| snapshot.impact(domain))
                {
                    Some(value) => value,
                    None => return Some(rpc_error(id, -32602, "Unknown or missing domain")),
                },
                _ => return Some(rpc_error(id, -32602, "Unknown tool or invalid arguments")),
            };
            tool_result(value)
        }
        _ => return Some(rpc_error(id, -32601, "Method not found")),
    };
    Some(rpc_result(id, result))
}

pub(crate) fn run(root: &Path) -> i32 {
    let snapshot = match Snapshot::load(root) {
        Ok(value) => value,
        Err(e) => {
            eprintln!("MCP snapshot error: {e}");
            return 2;
        }
    };
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    let mut state = 0;
    loop {
        let mut line = Vec::new();
        match input
            .by_ref()
            .take(1024 * 1024 + 1)
            .read_until(b'\n', &mut line)
        {
            Ok(0) => return 0,
            Ok(n) if n <= 1024 * 1024 => {}
            _ => return 3,
        }
        let response = match serde_json::from_slice(&line) {
            Ok(request) => handle(&snapshot, &mut state, request),
            Err(_) => Some(rpc_error(Value::Null, -32700, "Parse error")),
        };
        if let Some(response) = response {
            if writeln!(output, "{response}")
                .and_then(|_| output.flush())
                .is_err()
            {
                return 3;
            }
        }
    }
}
