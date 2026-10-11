import test from 'node:test';import assert from 'node:assert/strict';import os from 'node:os';import fs from 'node:fs';import path from 'node:path';import {Wallet} from 'ethers';import {Store} from '../lib/store.mjs';
let createApp;try{({createApp}=await import('../app.mjs'));}catch{}
const origin='https://nepnoid.github.io';
test('HTTP gateway limits RPC methods and faucet enforces CAPTCHA, wallet proof, replay and persistent pause',async()=>{
 assert.equal(typeof createApp,'function');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gnc-http-'));const store=new Store(path.join(dir,'claims.sqlite'));const wallet=Wallet.createRandom();let sends=0;
 const config={origins:[origin],publicOrigin:'https://gnc.example.test',chainId:771337,token:'0x0000000000000000000000000000000000000001',faucetAddress:'0x0000000000000000000000000000000000000002',cooldownMs:86400000,ipMax:3,dailyMax:10,ipSalt:'private-test-salt',trustProxy:false,siteKey:'site-key',captchaHostname:'nepnoid.github.io',paused:false};
 const app=createApp({config,store,rpc:async()=>({jsonrpc:'2.0',id:1,result:'0xbc509'}),captcha:async(token)=>token==='valid',sendClaim:async()=>{sends++;return {tokenHash:'0x'+'1'.repeat(64),gasHash:'0x'+'2'.repeat(64)};},health:async()=>true});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}`;
 const post=async(p,body,o=origin)=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',Origin:o},body:JSON.stringify(body)});
 try{
  assert.equal((await post('/rpc',{jsonrpc:'2.0',id:1,method:'evm_mine',params:[]})).status,403);
  assert.equal((await post('/rpc',{jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]},'https://evil.test')).status,403);
  assert.equal((await post('/rpc',{jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})).status,200);
  const c=await (await post('/api/v1/faucet/challenges',{address:wallet.address})).json();assert.ok(c.id);assert.ok(c.message);
  const signature=await wallet.signMessage(c.message);
  assert.equal((await post('/api/v1/faucet/claims',{challengeId:c.id,signature,turnstileToken:'bad'})).status,403);assert.equal(sends,0);
  const claim=await post('/api/v1/faucet/claims',{challengeId:c.id,signature,turnstileToken:'valid'});assert.equal(claim.status,201);assert.equal(sends,1);
  assert.equal((await post('/api/v1/faucet/claims',{challengeId:c.id,signature,turnstileToken:'valid'})).status,401);
  store.setPaused(true);assert.equal((await post('/api/v1/faucet/challenges',{address:Wallet.createRandom().address})).status,503);
  assert.equal((await fetch(base+'/health')).status,200);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
