import {getAddress,parseUnits} from 'ethers';
import {isIP} from 'node:net';
import {CHAIN_ID} from './security.mjs';
export function readConfig(env=process.env){
 const required=k=>{if(!env[k]||typeof env[k]!=='string')throw new Error(`Missing ${k}`);return env[k];};
 const origin=value=>{const u=new URL(value);if(u.protocol!=='https:'||u.origin!==value||u.username||u.password)throw new Error('HTTPS origin required');return u.origin;};
 const publicOrigin=origin(required('PUBLIC_ORIGIN'));
 const origins=required('ALLOWED_ORIGINS').split(',').map(x=>origin(x.trim()));
 const upstream=new URL(required('RPC_UPSTREAM'));
 if(upstream.protocol!=='http:'||!['validator1','127.0.0.1','localhost'].includes(upstream.hostname)||upstream.username||upstream.password||upstream.search||upstream.pathname!=='/')throw new Error('Use private RPC upstream');
 const token=getAddress(required('TOKEN_ADDRESS'));const genesisHash=required('GENESIS_HASH');if(!/^0x[0-9a-fA-F]{64}$/.test(genesisHash))throw new Error('Genesis hash required');
 const integer=(name,def,min,max)=>{const x=Number(env[name]||def);if(!Number.isSafeInteger(x)||x<min||x>max)throw new Error(`Invalid ${name}`);return x;};
 required('TRUSTED_PROXY_CIDR');
 let trustProxy=false;
 if(env.TRUSTED_PROXY_CIDR){const parts=env.TRUSTED_PROXY_CIDR.split('/');const version=isIP(parts[0]);const bits=Number(parts[1]);if(!version||!Number.isInteger(bits)||bits<(version===4?24:64)||bits>(version===4?32:128))throw new Error('Trusted proxy range too broad');trustProxy=env.TRUSTED_PROXY_CIDR;}
 const hostname=required('TURNSTILE_HOSTNAME');if(!origins.some(x=>new URL(x).hostname===hostname)&&new URL(publicOrigin).hostname!==hostname)throw new Error('CAPTCHA hostname not allowed');
 const tokenAmount=parseUnits(env.FAUCET_TOKENS||'100',18),gasAmount=parseUnits(env.FAUCET_GAS||'0.001',18);if(tokenAmount<=0n||tokenAmount>parseUnits('100',18)||gasAmount<0n||gasAmount>parseUnits('0.001',18))throw new Error('Faucet amount too large');
 return {chainId:CHAIN_ID,publicOrigin,origins,rpcUpstream:upstream.href,token,genesisHash,trustProxy,captchaHostname:hostname,
  siteKey:required('TURNSTILE_SITE_KEY'),captchaSecretFile:required('TURNSTILE_SECRET_FILE'),faucetKeyFile:required('FAUCET_KEY_FILE'),dbFile:required('CLAIM_DB'),saltFile:required('IP_HASH_SALT_FILE'),
  port:integer('PORT',8080,1024,65535),cooldownMs:integer('WALLET_COOLDOWN_HOURS',24,24,720)*3600000,ipMax:integer('IP_CLAIMS_PER_DAY',3,1,10),dailyMax:integer('CLAIMS_PER_DAY',100,1,1000),tokenAmount,gasAmount,paused:env.FAUCET_PAUSED!=='false'};
}
