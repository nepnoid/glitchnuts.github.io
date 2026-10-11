import express from 'express';
import {createHmac,randomBytes,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {getAddress} from 'ethers';
import {PublicError,validateRpc,challengeMessage,verifyProof} from './lib/security.mjs';
export function createApp({config,store,rpc,captcha,sendClaim,health}){
 const app=express();app.disable('x-powered-by');app.set('trust proxy',config.trustProxy);
 const ip=r=>createHmac('sha256',config.ipSalt).update(r.ip||r.socket.remoteAddress||'unknown').digest('hex');
 const handler=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
 const failIfPaused=()=>{if(config.paused||store.isPaused())throw new PublicError(503,'Faucet paused');};
 app.use((req,res,next)=>{res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});const origin=req.get('Origin');if(origin&&!config.origins.includes(origin)&&origin!==config.publicOrigin)return next(new PublicError(403,'Origin not allowed'));if(origin){res.set('Access-Control-Allow-Origin',origin);res.vary('Origin');}if(req.method==='OPTIONS'){res.set({'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.sendStatus(204);}next();});
 app.use(express.json({limit:'64kb',strict:true}));
 app.use((req,res,next)=>{try{store.throttle('requests',ip(req),Date.now(),120,60000,req.path==='/rpc'&&Array.isArray(req.body)?req.body.length:1);next();}catch(e){next(e);}});
 app.get('/faucet/',(req,res)=>{res.set('Content-Security-Policy',"default-src 'none'; script-src 'self' https://challenges.cloudflare.com; style-src 'self'; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");res.sendFile(fileURLToPath(new URL('./public/faucet.html',import.meta.url)));});
 app.get('/faucet/ethers.js',(req,res)=>res.sendFile(fileURLToPath(new URL('./node_modules/ethers/dist/ethers.umd.min.js',import.meta.url))));
 app.get('/faucet/wallet.js',(req,res)=>res.sendFile(fileURLToPath(new URL('./public/wallet.js',import.meta.url))));
 app.get('/faucet/style.css',(req,res)=>res.sendFile(fileURLToPath(new URL('./public/style.css',import.meta.url))));
 app.get('/health',handler(async(req,res)=>{if(!await health())throw new PublicError(503,'Chain unavailable');res.json({status:'ready',chainId:config.chainId,testnet:true,faucet:config.paused||store.isPaused()?'paused':'enabled'});}));
 app.get('/api/v1/network',handler(async(req,res)=>res.json({chainId:config.chainId,name:'Kdawg GNC Beta',tokenAddress:config.token,tokenSymbol:'GNC',decimals:18,nativeCurrency:{name:'Test Gas',symbol:'tGAS',decimals:18},rpcUrl:config.publicOrigin+'/rpc',siteKey:config.siteKey,testnet:true,redeemable:false})));
 app.post('/rpc',handler(async(req,res)=>{validateRpc(req.body);store.throttle('rpc',ip(req),Date.now(),60,60000,Array.isArray(req.body)?req.body.length:1);res.json(await rpc(req.body));}));
 app.post('/api/v1/faucet/challenges',handler(async(req,res)=>{
  failIfPaused();const origin=req.get('Origin');if(!origin)throw new PublicError(403,'Browser origin required');store.throttle('challenges',ip(req),Date.now(),10,60000);
  let address;try{address=getAddress(req.body?.address);}catch{throw new PublicError(400,'Invalid wallet address');}
  if(['0x0000000000000000000000000000000000000000',config.faucetAddress.toLowerCase()].includes(address.toLowerCase()))throw new PublicError(400,'Invalid recipient');
  store.cleanup(Date.now());const c={id:randomUUID(),address:address.toLowerCase(),origin,chainId:config.chainId,token:config.token,nonce:randomBytes(32).toString('hex'),expiresAt:Date.now()+300000};store.saveChallenge(c);res.status(201).json({id:c.id,message:challengeMessage(c),expiresAt:c.expiresAt});
 }));
 let queue=Promise.resolve(),queued=0;
 app.post('/api/v1/faucet/claims',handler(async(req,res)=>{
  failIfPaused();store.throttle('claims',ip(req),Date.now(),10,60000);
  const {challengeId,signature,turnstileToken}=req.body||{};
  if(typeof challengeId!=='string'||challengeId.length>64||typeof signature!=='string'||signature.length>300||typeof turnstileToken!=='string'||!turnstileToken||turnstileToken.length>2048)throw new PublicError(400,'Invalid claim');
  const c=store.challenge(challengeId);if(!c||c.used||c.expiresAt<=Date.now()||c.origin!==req.get('Origin'))throw new PublicError(401,'Challenge expired or used');verifyProof(c,signature);
  if(!await captcha(turnstileToken,req.ip))throw new PublicError(403,'CAPTCHA validation failed');
  if(queued>=10)throw new PublicError(503,'Faucet busy, try later');queued++;
  const run=async()=>{
   failIfPaused();const claim=store.reserve({challengeId,ipHash:ip(req),now:Date.now(),config});
   try{const result=await sendClaim(claim,store);store.update(claim.id,'complete',result);return store.claim(claim.id);}
   catch{store.setPaused(true);throw new PublicError(503,'Claim requires operator review. Faucet paused; do not retry transfers.');}
  };
  const task=queue.then(run,run);queue=task.catch(()=>{});
  try{const claim=await task;res.status(201).json({id:claim.id,status:claim.state,tokenTxHash:claim.tokenHash,gasTxHash:claim.gasHash});}finally{queued--;}
 }));
 app.get('/api/v1/faucet/claims/:id',(req,res)=>{const c=store.claim(req.params.id);if(!c)return res.status(404).type('application/problem+json').json({type:'about:blank',title:'Claim not found',status:404});res.json({id:c.id,status:c.state,tokenTxHash:c.tokenHash,gasTxHash:c.gasHash});});
 app.use((err,req,res,next)=>{const status=err instanceof PublicError?err.status:err.type==='entity.too.large'?413:err instanceof SyntaxError?400:503;res.status(status).type('application/problem+json');if(status===429)res.set('Retry-After','60');res.json({type:'about:blank',title:err instanceof PublicError?err.message:status===400?'Invalid JSON':'Service unavailable',status});});
 return app;
}
