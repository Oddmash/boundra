const { execFile } = require("node:child_process");
const { existsSync, realpathSync, statSync } = require("node:fs");
const { isAbsolute, join, resolve } = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { inside, decodeReport, createScheduler } = require("../vscode/diagnostics.cjs");

const maxBody = 8 * 1024 * 1024;
function encode(message) {
  const body = Buffer.from(JSON.stringify(message));
  return Buffer.concat([Buffer.from(`Content-Length: ${body.length}\r\n\r\n`), body]);
}

function createDecoder(receive) {
  let buffer = Buffer.alloc(0);
  return chunk => {
    buffer = Buffer.concat([buffer, chunk]);
    for (;;) {
      const split = buffer.indexOf("\r\n\r\n");
      if (split < 0) { if (buffer.length > 4096) throw new Error("LSP header too large"); return; }
      if (split > 4096) throw new Error("LSP header too large");
      const lengths = buffer.subarray(0, split).toString("ascii").split("\r\n").filter(line => /^content-length:/i.test(line));
      const match = lengths.length === 1 && /^content-length:\s*(\d+)\s*$/i.exec(lengths[0]);
      const length = match && Number(match[1]);
      if (!Number.isSafeInteger(length) || length < 1 || length > maxBody) throw new Error("Invalid LSP content length");
      const begin = split + 4;
      if (buffer.length < begin + length) return;
      const body = buffer.subarray(begin, begin + length);
      buffer = buffer.subarray(begin + length);
      receive(JSON.parse(body.toString("utf8")));
    }
  };
}

function runNative(root, cli, signal) {
  return new Promise((resolveResult, reject) => {
    execFile(cli, ["check-boundaries", "--root", root, "--format", "json"], { cwd: root, signal, encoding: "utf8", timeout: 30000, maxBuffer: maxBody }, (error, stdout, stderr) => {
      try { resolveResult(decodeReport(root, stdout, error ? error.code : 0)); }
      catch (decodeError) { reject(error && typeof error.code !== "number" ? error : new Error(stderr.trim() || decodeError.message)); }
    });
  });
}

function localPath(uri, root) {
  try {
    const lexical = resolve(fileURLToPath(uri));
    const path = existsSync(lexical) ? realpathSync(lexical) : lexical;
    if (!inside(root, path) || path === root) return;
    return path;
  } catch { return undefined; }
}

function createServer({ root, run, send, exit, debounce = 150 }) {
  let phase = "new";
  const opened = new Map();
  const respond = (id, result) => send({jsonrpc:"2.0",id,result});
  const fail = (id, code, message) => send({jsonrpc:"2.0",id,error:{code,message}});
  const notify = (method, params) => send({jsonrpc:"2.0",method,params});
  const publish = (uri, diagnostics) => notify("textDocument/publishDiagnostics", {uri,diagnostics});
  const scheduler = createScheduler(run, result => {
    const grouped = new Map();
    for (const item of result.diagnostics) {
      const path = localPath(pathToFileURL(item.file).href, root);
      if (!path || !opened.has(path)) continue;
      const line = item.line - 1;
      const position = {line,character:0};
      const list = grouped.get(path) ?? [];
      list.push({range:{start:position,end:position},severity:1,code:item.rule,source:"Boundra",message:`${item.message}\n${item.suggestion}`});
      grouped.set(path,list);
    }
    for (const [path, uri] of opened) publish(uri,grouped.get(path) ?? []);
    for (const error of result.errors) notify("window/logMessage",{type:1,message:error});
  },debounce);
  return {
    receive(message) {
      if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") return;
      const {id,method,params} = message;
      if (method === "exit") { scheduler.dispose(); exit(phase === "shutdown" ? 0 : 1); return; }
      if (method === "initialize" && phase === "new" && id !== undefined) {
        let candidate;
        let folder;
        try {
          candidate = realpathSync(fileURLToPath(params?.rootUri ?? params?.workspaceFolders?.[0]?.uri));
          if (params?.workspaceFolders?.length === 1) folder = realpathSync(fileURLToPath(params.workspaceFolders[0].uri));
        } catch {}
        if (candidate !== root || (Array.isArray(params?.workspaceFolders) && (params.workspaceFolders.length > 1 || (params.workspaceFolders.length === 1 && folder !== root)))) { fail(id,-32602,"Select the explicit single Boundra workspace"); return; }
        phase = "initializing";
        respond(id,{capabilities:{positionEncoding:"utf-16",textDocumentSync:{openClose:true,change:0,save:{includeText:false}}},serverInfo:{name:"boundra-lsp-preview"}});
        return;
      }
      if (method === "initialized" && phase === "initializing") { phase = "ready"; return; }
      if (method === "shutdown" && phase === "ready" && id !== undefined) { phase = "shutdown"; scheduler.dispose(); respond(id,null); return; }
      if (phase !== "ready") { if (id !== undefined) fail(id,-32002,"Server not initialized or shut down"); return; }
      const uri = params?.textDocument?.uri;
      const path = localPath(uri,root);
      if (method === "textDocument/didOpen" && path) { opened.set(path,uri); scheduler.schedule(); return; }
      if (method === "textDocument/didSave" && path && opened.has(path)) { scheduler.schedule(); return; }
      if (method === "textDocument/didClose" && path && opened.has(path)) { publish(opened.get(path),[]); opened.delete(path); return; }
      if (id !== undefined) fail(id,-32601,"Method not supported in preview");
    },
    dispose() { scheduler.dispose(); }
  };
}

function main(args) {
  if (args.length !== 4 || args[0] !== "--root" || args[2] !== "--cli" || !isAbsolute(args[1]) || !isAbsolute(args[3])) throw new Error("Use --root <absolute-workspace> --cli <absolute-native-cli>");
  const root = realpathSync(args[1]);
  const cli = realpathSync(args[3]);
  if (!statSync(root).isDirectory() || !existsSync(join(root,"boundra.config.json")) || !statSync(cli).isFile()) throw new Error("Invalid Boundra workspace or CLI path");
  const server = createServer({root,run:signal=>runNative(root,cli,signal),send:message=>process.stdout.write(encode(message)),exit:code=>{process.exitCode=code;process.stdin.destroy();}});
  const decode = createDecoder(message=>server.receive(message));
  process.stdin.on("data",chunk=>{try{decode(chunk);}catch(error){console.error(error.message);server.dispose();process.exitCode=1;process.stdin.destroy();}});
  process.stdin.on("end",()=>server.dispose());
}

if (require.main === module) { try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode=2; } }
module.exports = { encode, createDecoder, createServer };
