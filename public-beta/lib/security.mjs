import { Transaction, getAddress, verifyMessage } from 'ethers';
export const CHAIN_ID=771337;
export class PublicError extends Error { constructor(status,message){super(message);this.status=status;} }
const reject=message=>{throw new PublicError(400,message);};
const hex=/^0x[0-9a-fA-F]*$/;
const hash=/^0x[0-9a-fA-F]{64}$/;
const quantity=x=>typeof x==='string'&&/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(x);
const address=x=>{try{return getAddress(x);}catch{reject('Invalid address');}};
const block=x=>['latest','pending','earliest','safe','finalized'].includes(x)||quantity(x);
export function validateRpc(body){
 const batch=Array.isArray(body)?body:[body];if(!batch.length||batch.length>10)reject('Batch must contain 1–10 requests');
 for(const r of batch){
  if(!r||r.jsonrpc!=='2.0'||!Object.hasOwn(r,'id')||!((typeof r.id==='number'&&Number.isSafeInteger(r.id))||(typeof r.id==='string'&&r.id.length<=64))||!Array.isArray(r.params))reject('Invalid JSON-RPC request');
  const p=r.params;
  switch(r.method){
   case 'eth_chainId':case 'net_version':case 'web3_clientVersion':case 'eth_blockNumber':case 'eth_gasPrice':case 'eth_maxPriorityFeePerGas':case 'eth_syncing':if(p.length)reject('No parameters expected');break;
   case 'eth_getBalance':case 'eth_getTransactionCount':case 'eth_getCode':if(p.length!==2||!block(p[1]))reject('Expected address and block');address(p[0]);break;
   case 'eth_getTransactionReceipt':case 'eth_getTransactionByHash':if(p.length!==1||!hash.test(p[0]))reject('Expected transaction hash');break;
   case 'eth_getBlockByNumber':if(p.length!==2||!block(p[0])||p[1]!==false)reject('Full transactions disabled');break;
   case 'eth_getBlockByHash':if(p.length!==2||!hash.test(p[0])||p[1]!==false)reject('Full transactions disabled');break;
   case 'eth_call':case 'eth_estimateGas':{
    if(p.length<1||p.length>2||!p[0]||typeof p[0]!=='object'||Array.isArray(p[0]))reject('Invalid transaction call');
    if(p.length===2&&!block(p[1]))reject('State overrides disabled');
    const t=p[0];address(t.to);if(t.from)address(t.from);
    if(Object.keys(t).some(k=>!['to','from','data','value','gas','gasPrice','maxFeePerGas','maxPriorityFeePerGas'].includes(k)))reject('Unsupported call field');
    if(t.data&&(!hex.test(t.data)||t.data.length>16386||t.data.length%2!==0))reject('Call data too large');
    for(const k of ['gas','value','gasPrice','maxFeePerGas','maxPriorityFeePerGas'])if(t[k]!==undefined&&!quantity(t[k]))reject('Invalid quantity');
    if(t.gas&&BigInt(t.gas)>1000000n)reject('Call gas exceeds limit');
    t.gas=t.gas||'0xf4240';break;
   }
   case 'eth_getLogs':{
    if(p.length!==1||!p[0]||typeof p[0]!=='object')reject('Invalid log filter');const f=p[0];
    if(Object.keys(f).some(k=>!['address','fromBlock','toBlock','topics'].includes(k)))reject('Unsupported log field');
    if(!quantity(f.fromBlock)||!quantity(f.toBlock)||BigInt(f.toBlock)<BigInt(f.fromBlock)||BigInt(f.toBlock)-BigInt(f.fromBlock)>1000n)reject('Logs require explicit range of at most 1,001 blocks');
    if(!f.address||Array.isArray(f.address))reject('One log contract required');address(f.address);
    if(f.topics&&(!Array.isArray(f.topics)||f.topics.length>4||f.topics.some(t=>t!==null&&!hash.test(t))))reject('Invalid log topics');break;
   }
   case 'eth_sendRawTransaction':{
    if(p.length!==1||typeof p[0]!=='string'||!hex.test(p[0])||p[0].length>32770)reject('Invalid signed transaction');
    let t;try{t=Transaction.from(p[0]);}catch{reject('Malformed signed transaction');}
    if(!t.signature||!t.from||t.chainId!==BigInt(CHAIN_ID)||!t.to||t.gasLimit>1000000n||t.value!==0n)reject('Wrong chain or unsupported transaction');break;
   }
   default:throw new PublicError(403,'RPC method not allowed');
  }
 }
 return body;
}
export function challengeMessage(c){return `Kdawg Keno GNC beta faucet\nOrigin: ${c.origin}\nWallet: ${c.address.toLowerCase()}\nChain ID: ${c.chainId}\nToken: ${c.token.toLowerCase()}\nChallenge: ${c.id}\nNonce: ${c.nonce}\nExpires (UTC ms): ${c.expiresAt}\nClaim free test tokens only. No purchase, approval, or asset transfer is authorized by this signature.`;}
export function verifyProof(challenge,signature){
 let recovered;try{recovered=verifyMessage(challengeMessage(challenge),signature).toLowerCase();}catch{throw new PublicError(401,'Invalid wallet signature');}
 if(recovered!==challenge.address.toLowerCase())throw new PublicError(401,'Wallet signature does not match');return recovered;
}
