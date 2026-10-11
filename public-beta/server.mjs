import fs from 'node:fs';
import path from 'node:path';
import {Wallet,JsonRpcProvider} from 'ethers';
import {readConfig} from './lib/config.mjs';
import {Store} from './lib/store.mjs';
import {createSender,verifyChain} from './lib/sender.mjs';
import {createApp} from './app.mjs';
function privateFile(filename){const stat=fs.statSync(filename);if(!stat.isFile()||(stat.mode&0o077)!==0)throw new Error('Secret file permissions must be 0600');return fs.readFileSync(filename,'utf8').trim();}
let provider,store,server;
try{
 const env={...process.env};
 if(env.DEPLOYMENT_FILE){const manifest=JSON.parse(fs.readFileSync(env.DEPLOYMENT_FILE,'utf8'));if(manifest.chainId!==771337)throw new Error('Wrong deployment chain');env.TOKEN_ADDRESS=manifest.tokenAddress;env.GENESIS_HASH=manifest.genesisHash;}
 const config=readConfig(env);
 const key=privateFile(config.faucetKeyFile);const ipSalt=privateFile(config.saltFile),captchaSecret=privateFile(config.captchaSecretFile);
 if(ipSalt.length<32||captchaSecret.length<16||captchaSecret.startsWith('1x000000')||captchaSecret.startsWith('2x000000'))throw new Error('Non-test production secret required');
 provider=new JsonRpcProvider(config.rpcUpstream);provider.pollingInterval=1000;
 const wallet=new Wallet(key,provider);config.faucetAddress=wallet.address;config.ipSalt=ipSalt;
 fs.mkdirSync(path.dirname(config.dbFile),{recursive:true,mode:0o700});store=new Store(config.dbFile);fs.chmodSync(config.dbFile,0o600);
 if(store.pending().length)store.setPaused(true);
 const sendClaim=await createSender({provider,wallet,config});
 const rpc=async(body)=>{
  const response=await fetch(config.rpcUpstream,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw new Error('RPC unavailable');
  const reader=response.body.getReader();let total=0;const chunks=[];
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>1024*1024){await reader.cancel();throw new Error('RPC response too large');}chunks.push(value);}
  const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));const clean=r=>r?.error?{jsonrpc:'2.0',id:r.id,error:{code:Number.isInteger(r.error.code)?r.error.code:-32000,message:'Node request rejected'}}:r;
  return Array.isArray(result)?result.map(clean):clean(result);
 };
 const captcha=async(token,remoteip)=>{
  try{const response=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:captchaSecret,response:token,remoteip}),signal:AbortSignal.timeout(8000)});if(!response.ok)return false;const data=await response.json();return data.success===true&&data.hostname===config.captchaHostname&&data.action==='gnc-faucet';}catch{return false;}
 };
 const health=async()=>{try{await verifyChain(provider,config);return true;}catch{return false;}};
 const app=createApp({config,store,rpc,captcha,sendClaim,health});
 server=app.listen(config.port,'0.0.0.0');server.requestTimeout=90000;server.headersTimeout=10000;server.timeout=95000;
 server.on('error',()=>{process.stderr.write('Beta API listener failed\n');process.exitCode=1;});
 let closing=false;const close=()=>{if(closing)return;closing=true;server.close(()=>{provider.destroy();store.close();process.exit(0);});setTimeout(()=>{server.closeAllConnections();},5000).unref();};
 process.once('SIGTERM',close);process.once('SIGINT',close);
 process.stdout.write(`Kdawg GNC beta API ready. Faucet ${config.paused||store.isPaused()?'paused':'enabled'}.\n`);
}catch{provider?.destroy();store?.close();process.stderr.write('Beta startup failed. Check private configuration, chain identity, deployment, and secret file permissions.\n');process.exitCode=1;}
