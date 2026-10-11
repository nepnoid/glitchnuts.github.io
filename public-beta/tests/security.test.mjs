import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Wallet} from 'ethers';
let security={};try{security=await import('../lib/security.mjs');}catch{}
let Store;try{({Store}=await import('../lib/store.mjs'));}catch{}

test('RPC allowlist rejects admin, unlock, development mining, notifications and unsafe batches',()=>{
 assert.equal(typeof security.validateRpc,'function');
 for(const method of ['admin_peers','personal_unlockAccount','eth_sendTransaction','eth_sign','evm_mine','debug_traceTransaction','qbft_proposeValidatorVote']) assert.throws(()=>security.validateRpc({jsonrpc:'2.0',id:1,method,params:[]}));
 assert.throws(()=>security.validateRpc({jsonrpc:'2.0',method:'eth_chainId',params:[]}));
 assert.throws(()=>security.validateRpc(Array.from({length:11},(_,i)=>({jsonrpc:'2.0',id:i,method:'eth_chainId',params:[]}))));
 assert.doesNotThrow(()=>security.validateRpc({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}));
});
test('read calls have gas and log-range limits and signed writes enforce chain id',async()=>{
 assert.equal(typeof security.validateRpc,'function');
 assert.throws(()=>security.validateRpc({jsonrpc:'2.0',id:1,method:'eth_getLogs',params:[{fromBlock:'0x1',toBlock:'0xffff'}]}));
 assert.throws(()=>security.validateRpc({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:'0x0000000000000000000000000000000000000001',gas:'0xffffff'},'latest']}));
 const raw=await Wallet.createRandom().signTransaction({chainId:1,nonce:0,gasLimit:21000,gasPrice:1,to:Wallet.createRandom().address,value:0});
 assert.throws(()=>security.validateRpc({jsonrpc:'2.0',id:1,method:'eth_sendRawTransaction',params:[raw]}));
});
test('challenge proof is bound to wallet, origin and nonce',async()=>{
 assert.equal(typeof security.challengeMessage,'function');
 const wallet=Wallet.createRandom();const c={id:'abc',address:wallet.address,origin:'https://nepnoid.github.io',chainId:771337,nonce:'one',expiresAt:2000,token:'0x0000000000000000000000000000000000000001'};
 const message=security.challengeMessage(c);const sig=await wallet.signMessage(message);
 assert.equal(security.verifyProof(c,sig),wallet.address.toLowerCase());
 assert.throws(()=>security.verifyProof({...c,nonce:'two'},sig));assert.throws(()=>security.verifyProof({...c,address:Wallet.createRandom().address},sig));
});
test('durable reservations enforce cooldown, IP budget, daily cap and challenge replay after restart',()=>{
 assert.equal(typeof Store,'function');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gnc-store-'));const filename=path.join(dir,'claims.sqlite');
 let store=new Store(filename);const now=1000000;const config={cooldownMs:86400000,ipMax:1,dailyMax:2};
 try{
  store.saveChallenge({id:'c1',address:'a',origin:'o',nonce:'n',chainId:771337,token:'t',expiresAt:now+10000});
  const first=store.reserve({challengeId:'c1',ipHash:'ip',now,config});assert.ok(first.id);
  assert.throws(()=>store.reserve({challengeId:'c1',ipHash:'other',now,config}));store.close();store=new Store(filename);
  store.saveChallenge({id:'c2',address:'a',origin:'o',nonce:'n',chainId:771337,token:'t',expiresAt:now+10000});assert.throws(()=>store.reserve({challengeId:'c2',ipHash:'newip',now,config}));
  store.saveChallenge({id:'c3',address:'b',origin:'o',nonce:'n',chainId:771337,token:'t',expiresAt:now+10000});assert.throws(()=>store.reserve({challengeId:'c3',ipHash:'ip',now,config}));
  store.reserve({challengeId:'c3',ipHash:'ip2',now,config});
  store.saveChallenge({id:'c4',address:'c',origin:'o',nonce:'n',chainId:771337,token:'t',expiresAt:now+10000});assert.throws(()=>store.reserve({challengeId:'c4',ipHash:'ip3',now,config}));
 }finally{store.close();fs.rmSync(dir,{recursive:true,force:true});}
});
