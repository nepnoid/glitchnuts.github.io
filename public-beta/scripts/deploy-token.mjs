#!/usr/bin/env node
import {mkdir,readFile,rm,chmod} from 'node:fs/promises';
import {resolve} from 'node:path';
import {Contract,ContractFactory,JsonRpcProvider,Wallet,getAddress,getCreateAddress,keccak256,parseUnits} from 'ethers';
import solc from 'solc';
import {CHAIN_ID,assertPrivateFile,checkRpcIdentity,exists,parseStateDir,rpcUrlFromEnv,writePrivate,loadState} from '../chain/lib.mjs';
const COMPONENT_ROOT=resolve(new URL('..',import.meta.url).pathname);
const INITIAL_SUPPLY=parseUnits('100000000',18),FAUCET_ALLOCATION=parseUnits('1000000',18);
async function artifact(){
 if(!solc.version().startsWith('0.8.24'))throw new Error('Pinned compiler required');
 const source=await readFile(resolve(COMPONENT_ROOT,'..','contracts','GNC.sol'),'utf8');
 const out=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'GNC.sol':{content:source}},settings:{evmVersion:'paris',optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object']}}}})));
 if(out.errors?.some(e=>e.severity==='error'))throw new Error('Contract compilation failed');const a=out.contracts['GNC.sol'].GNC;return {abi:a.abi,bytecode:'0x'+a.evm.bytecode.object};
}
async function main(){
 const stateDir=parseStateDir(),rpcUrl=rpcUrlFromEnv();
 const local=await loadState(stateDir);if(!local.manifest.genesisHash)throw new Error('genesisHash has not been finalized; run chain verification first');
 const identity=await checkRpcIdentity({stateDir,rpcUrl}),a=await artifact();
 const deploymentFile=resolve(stateDir,'deployment.json'),journalFile=resolve(stateDir,'deployment-journal.json'),lock=resolve(stateDir,'deployment.lock');
 try{await mkdir(lock,{mode:0o700});}catch{throw new Error('Deployment lock exists. Check the active process before removing a stale lock.');}
 const provider=new JsonRpcProvider(rpcUrl);provider.pollingInterval=1000;
 try{
  if(await exists(deploymentFile)){
   const d=JSON.parse(await readFile(deploymentFile,'utf8'));
   if(d.chainId!==CHAIN_ID||d.genesisHash!==identity.genesisHash||getAddress(d.ownerAddress)!==getAddress(local.manifest.ownerAddress)||getAddress(d.faucetAddress)!==getAddress(local.manifest.faucetAddress)||await provider.getCode(d.tokenAddress)==='0x')throw new Error('Existing deployment identity mismatch');
   const token=new Contract(d.tokenAddress,a.abi,provider);if(getAddress(await token.owner())!==getAddress(d.ownerAddress))throw new Error('Existing token owner mismatch');
   process.stdout.write(JSON.stringify({ok:true,reused:true,tokenAddress:d.tokenAddress,chainId:CHAIN_ID})+'\n');return;
  }
  const owner=new Wallet(await assertPrivateFile(resolve(stateDir,'owner.key'),'owner.key'),provider);
  const faucetAddress=getAddress(local.manifest.faucetAddress);
  if(getAddress(owner.address)!==getAddress(local.manifest.ownerAddress))throw new Error('Owner key mismatch');
  let j=await exists(journalFile)?JSON.parse(await readFile(journalFile,'utf8')):{chainId:CHAIN_ID,genesisHash:identity.genesisHash,ownerAddress:owner.address,faucetAddress};
  if(j.chainId!==CHAIN_ID||j.genesisHash!==identity.genesisHash||getAddress(j.ownerAddress)!==owner.address||getAddress(j.faucetAddress)!==faucetAddress)throw new Error('Deployment checkpoint chain mismatch');
  const save=()=>writePrivate(journalFile,JSON.stringify(j,null,2)+'\n');
  const stage=async(name,transaction)=>{
   if(!j[name]){
    const nonce=Number(BigInt(await provider.send('eth_getTransactionCount',[owner.address,'pending'])));const fee=await provider.getFeeData();const gas=await provider.estimateGas({...transaction,from:owner.address});
    const raw=await owner.signTransaction({...transaction,chainId:CHAIN_ID,nonce,type:0,gasPrice:fee.gasPrice||1000000000n,gasLimit:gas+20000n});
    j[name]={raw,hash:keccak256(raw),nonce};await save();
   }
   let receipt=await provider.getTransactionReceipt(j[name].hash);
   if(!receipt){
    try{await provider.broadcastTransaction(j[name].raw);}catch{if(!await provider.getTransaction(j[name].hash))throw new Error('Uncertain deployment. Retain checkpoint and inspect receipts.');}
    receipt=await provider.waitForTransaction(j[name].hash,1,60000);
   }
   if(!receipt||receipt.status!==1)throw new Error('Deployment stage not confirmed');
   j[name].receipt={transactionHash:receipt.hash,blockNumber:receipt.blockNumber,status:receipt.status};await save();return receipt;
  };
  const tx=await new ContractFactory(a.abi,a.bytecode,owner).getDeployTransaction(owner.address,INITIAL_SUPPLY);
  await stage('deployment',tx);
  const tokenAddress=getCreateAddress({from:owner.address,nonce:j.deployment.nonce});const token=new Contract(tokenAddress,a.abi,provider);
  if(await provider.getCode(tokenAddress)==='0x'||getAddress(await token.owner())!==owner.address)throw new Error('Deployed token mismatch');
  const data=token.interface.encodeFunctionData('transfer',[faucetAddress,FAUCET_ALLOCATION]);await stage('funding',{to:tokenAddress,data,value:0n});
  const d={format:1,contract:'GNC',chainId:CHAIN_ID,genesisHash:identity.genesisHash,tokenAddress,ownerAddress:owner.address,faucetAddress,initialSupply:INITIAL_SUPPLY.toString(),faucetAllocation:FAUCET_ALLOCATION.toString(),receipts:{deployment:j.deployment.receipt,faucetFunding:j.funding.receipt}};
  await writePrivate(deploymentFile,JSON.stringify(d,null,2)+'\n');await chmod(deploymentFile,0o644);
  process.stdout.write(JSON.stringify({ok:true,reused:false,tokenAddress,chainId:CHAIN_ID})+'\n');
 }finally{provider.destroy();await rm(lock,{recursive:true,force:true});}
}
main().catch(error=>{process.stderr.write(error.message==='genesisHash has not been finalized; run chain verification first'?error.message+'\n':'GNC deployment failed. Check chain identity, private configuration and deployment journal. Never delete state to retry.\n');process.exitCode=1;});
