const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawn, execFileSync } = require("node:child_process");
const { mkdtemp, realpath, writeFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { pathToFileURL } = require("node:url");
const { performance } = require("node:perf_hooks");
const { encode, createDecoder, createServer } = require("./server.cjs");

test("decodes fragmented multibyte content and rejects invalid framing", () => {
  const received=[];
  const decode=createDecoder(msg=>received.push(msg));
  const data=Buffer.concat([encode({text:"경계"}),encode({text:"next"})]);
  for(const byte of data) decode(Buffer.from([byte]));
  assert.deepEqual(received,[{text:"경계"},{text:"next"}]);
  assert.throws(()=>createDecoder(()=>{})(Buffer.from("Content-Length: 999999999\r\n\r\n")));
});

test("rejects a different initialization root",()=>{
  const messages=[];
  const root=resolve(__dirname);
  const server=createServer({root,run:()=>{throw new Error("must not scan")},send:msg=>messages.push(msg),exit() {}});
  server.receive({jsonrpc:"2.0",id:1,method:"initialize",params:{rootUri:pathToFileURL(resolve(root,"..")).href}});
  assert.equal(messages[0].error.code,-32602);
  server.dispose();
});

test("native CLI document lifecycle and real stdio latency",{skip:!process.env.BOUNDRA_CLI_PATH,timeout:30000},async t=>{
  const root=await realpath(await mkdtemp(join(tmpdir(),"boundra-lsp-")));
  const cli=resolve(process.env.BOUNDRA_CLI_PATH);
  const native=(...args)=>execFileSync(cli,args,{cwd:root,encoding:"utf8"});
  const messages=[];
  let child;
  try {
    native("init","--name","lsp-fixture"); native("create-domain","order");
    const path=join(root,"domains/order/client/a.ts");
    await writeFile(path,"import '../server/public';\n");
    const uri=pathToFileURL(path).href;
    child=spawn(process.execPath,[join(__dirname,"server.cjs"),"--root",root,"--cli",cli],{stdio:["pipe","pipe","pipe"]});
    child.stdout.on("data",createDecoder(msg=>messages.push(msg)));
    const send=(method,params,id)=>child.stdin.write(encode({jsonrpc:"2.0",method,params,...(id===undefined?{}:{id})}));
    const take=async predicate=>{
      const deadline=performance.now()+10000;
      while(performance.now()<deadline){const index=messages.findIndex(predicate);if(index>=0)return messages.splice(index,1)[0];await new Promise(resolve=>setTimeout(resolve,10));}
      throw new Error(`missing LSP response; received ${JSON.stringify(messages)}`);
    };
    send("initialize",{rootUri:pathToFileURL(root).href,capabilities:{}},1);
    assert.equal((await take(msg=>msg.id===1)).result.capabilities.textDocumentSync.change,0);
    send("initialized",{});
    const started=performance.now();
    send("textDocument/didOpen",{textDocument:{uri,languageId:"typescript",version:1,text:"import '../server/public';"}});
    const diagnostic=await take(msg=>msg.method==="textDocument/publishDiagnostics"&&msg.params.diagnostics.length>0);
    assert.equal(diagnostic.params.diagnostics[0].code,"BR-001");
    assert.equal(diagnostic.params.diagnostics[0].range.start.line,0);
    t.diagnostic(`initial diagnostic: ${Math.round(performance.now()-started)} ms`);
    await writeFile(path,"export {};\n");
    const saved=performance.now();
    send("textDocument/didSave",{textDocument:{uri}});
    await take(msg=>msg.method==="textDocument/publishDiagnostics"&&msg.params.diagnostics.length===0);
    t.diagnostic(`save-to-clear diagnostic: ${Math.round(performance.now()-saved)} ms`);
    send("textDocument/didClose",{textDocument:{uri}});
    await take(msg=>msg.method==="textDocument/publishDiagnostics"&&msg.params.diagnostics.length===0);
    send("shutdown",null,2);
    assert.equal((await take(msg=>msg.id===2)).result,null);
    const exited=new Promise((resolve,reject)=>{child.once("exit",resolve);child.once("error",reject);});
    send("exit"); child.stdin.end(); assert.equal(await exited,0);
  } finally { if(child&&!child.killed&&child.exitCode===null) child.kill(); await rm(root,{recursive:true,force:true}); }
});
