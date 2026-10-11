import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import express from 'express';import {Store} from '../lib/store.mjs';import {createApp} from '../app.mjs';
test('10-item RPC batches debit 10 operations instead of one HTTP request',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gnc-batch-'));const store=new Store(path.join(dir,'s.sqlite'));
 const app=createApp({config:{origins:['https://nepnoid.github.io'],publicOrigin:'https://beta.test',trustProxy:false,ipSalt:'test'},store,rpc:async b=>b.map(r=>({jsonrpc:'2.0',id:r.id,result:'0x1'})),health:async()=>true});const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));
 try{const batch=Array.from({length:10},(_,id)=>({jsonrpc:'2.0',id,method:'eth_chainId',params:[]}));for(let n=0;n<6;n++){const r=await fetch(`http://127.0.0.1:${s.address().port}/rpc`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(batch)});assert.equal(r.status,200);}const limited=await fetch(`http://127.0.0.1:${s.address().port}/rpc`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(batch)});assert.equal(limited.status,429);}finally{s.closeAllConnections();await new Promise(r=>s.close(r));store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('trusted proxy uses distinct forwarded clients; untrusted direct peer cannot forge identity',async()=>{
 const ip=async trust=>{const app=express();app.set('trust proxy',trust);app.get('/',(req,res)=>res.json({ip:req.ip}));const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));try{return await (await fetch('http://127.0.0.1:'+s.address().port,{headers:{'X-Forwarded-For':'198.51.100.42'}})).json();}finally{s.closeAllConnections();await new Promise(r=>s.close(r));}};
 assert.equal((await ip('127.0.0.1/32')).ip,'198.51.100.42');assert.equal((await ip('10.77.0.2/32')).ip,'127.0.0.1');
});
