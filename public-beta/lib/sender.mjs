import {Contract,keccak256} from 'ethers';
export const tokenAbi=['function owner() view returns(address)','function decimals() view returns(uint8)','function symbol() view returns(string)','function balanceOf(address) view returns(uint256)','function transfer(address,uint256) returns(bool)'];
export async function verifyChain(provider,config){
 const network=await provider.getNetwork();if(network.chainId!==BigInt(config.chainId))throw new Error('Wrong beta chain');
 const genesis=await provider.getBlock(0);if(!genesis||genesis.hash.toLowerCase()!==config.genesisHash.toLowerCase())throw new Error('Wrong genesis');
}
export async function createSender({provider,wallet,config}){
 await verifyChain(provider,config);
 const token=new Contract(config.token,tokenAbi,provider);if(await provider.getCode(config.token)==='0x'||await token.decimals()!==18n||await token.symbol()!=='GNC')throw new Error('Invalid GNC contract');
 if((await token.owner()).toLowerCase()===wallet.address.toLowerCase())throw new Error('Faucet must not have mint authority');
 async function send(claim,store,transaction,state,hashField){
  const nonce=await provider.send('eth_getTransactionCount',[wallet.address,'pending']);const fee=await provider.getFeeData();const gasPrice=fee.gasPrice||1000000000n;
  if(gasPrice>100000000000n)throw new Error('Gas price too high');
  const rawTx=await wallet.signTransaction({...transaction,type:0,chainId:config.chainId,nonce:Number(BigInt(nonce)),gasPrice});const txHash=keccak256(rawTx);
  // Saved before submission. An interrupted claim pauses the faucet on restart.
  store.update(claim.id,state,{rawTx,[hashField]:txHash});
  const broadcast=await provider.broadcastTransaction(rawTx);const receipt=await provider.waitForTransaction(broadcast.hash,1,60000);if(!receipt||receipt.status!==1)throw new Error('Transfer not confirmed');return txHash;
 }
 return async(claim,store)=>{
  await verifyChain(provider,config);const tokens=await token.balanceOf(wallet.address);if(tokens<config.tokenAmount)throw new Error('Faucet empty');
  const gasBalance=await provider.getBalance(wallet.address);if(gasBalance<config.gasAmount+10000000000000000n)throw new Error('Faucet gas low');
  const data=token.interface.encodeFunctionData('transfer',[claim.address,config.tokenAmount]);
  const gas=await provider.estimateGas({from:wallet.address,to:config.token,data});if(gas>200000n)throw new Error('Token gas limit exceeded');
  const tokenHash=await send(claim,store,{to:config.token,data,gasLimit:gas+10000n,value:0n},'token_submitted','tokenHash');
  store.update(claim.id,'token_confirmed',{tokenHash});
  const gasHash=config.gasAmount>0n?await send(claim,store,{to:claim.address,value:config.gasAmount,gasLimit:21000n},'gas_submitted','gasHash'):null;
  return {tokenHash,gasHash};
 };
}
