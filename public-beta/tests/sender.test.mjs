import test from 'node:test';import assert from 'node:assert/strict';import {Wallet,JsonRpcProvider,ContractFactory,Contract,parseUnits} from 'ethers';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import solc from 'solc';import ganache from 'ganache';import {Store} from '../lib/store.mjs';
let createSender;try{({createSender}=await import('../lib/sender.mjs'));}catch{}
test('faucet signs exact ERC20 and native gas transfers with persisted hashes and rejects wrong genesis',async()=>{
 assert.equal(typeof createSender,'function');const node=ganache.server({chain:{chainId:771337},logging:{quiet:true}});await node.listen(0,'127.0.0.1');const provider=new JsonRpcProvider(`http://127.0.0.1:${node.address().port}`);let store,dir;
 try{
  const owner=await provider.getSigner(0);const faucet=Wallet.createRandom().connect(provider),recipient=Wallet.createRandom().address;
  await (await owner.sendTransaction({to:faucet.address,value:parseUnits('1',18)})).wait();
  const source=fs.readFileSync(new URL('../../contracts/GNC.sol',import.meta.url),'utf8');const input={language:'Solidity',sources:{'GNC.sol':{content:source}},settings:{evmVersion:'paris',outputSelection:{'*':{'*':['abi','evm.bytecode']}}}};const artifact=JSON.parse(solc.compile(JSON.stringify(input))).contracts['GNC.sol'].GNC;
  const token=await new ContractFactory(artifact.abi,artifact.evm.bytecode.object,owner).deploy(await owner.getAddress(),parseUnits('1000000',18));await token.waitForDeployment();await (await token.transfer(faucet.address,parseUnits('1000',18))).wait();
  const genesis=(await provider.getBlock(0)).hash;const config={chainId:771337,genesisHash:genesis,token:await token.getAddress(),tokenAmount:parseUnits('100',18),gasAmount:parseUnits('.001',18)};
  await assert.rejects(()=>createSender({provider,wallet:faucet,config:{...config,genesisHash:'0x'+'0'.repeat(64)}}));
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'gnc-sender-'));store=new Store(path.join(dir,'store.sqlite'));const now=Date.now();store.saveChallenge({id:'one',address:recipient.toLowerCase(),origin:'o',chainId:771337,nonce:'n',token:config.token,expiresAt:now+300000});const claim=store.reserve({challengeId:'one',ipHash:'ip',now,config:{cooldownMs:86400000,ipMax:1,dailyMax:1}});
  const sender=await createSender({provider,wallet:faucet,config});const hashes=await sender(claim,store);assert.ok(hashes.tokenHash);assert.ok(hashes.gasHash);
  assert.equal(await token.balanceOf(recipient),parseUnits('100',18));assert.equal(await provider.getBalance(recipient),parseUnits('.001',18));
  const row=store.claim(claim.id);assert.equal(row.tokenHash,hashes.tokenHash);assert.equal(row.gasHash,hashes.gasHash);
 }finally{store?.close();provider.destroy();await node.close();if(dir)fs.rmSync(dir,{recursive:true,force:true});}
});
