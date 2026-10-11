import fs from 'node:fs/promises';import path from 'node:path';import {randomBytes} from 'node:crypto';
const state=path.resolve(process.env.GNC_STATE_DIR||new URL('../state/',import.meta.url).pathname);
try{
 await fs.mkdir(state,{recursive:true,mode:0o700});
 try{await fs.access(path.join(state,'ip-salt'));}catch{await fs.writeFile(path.join(state,'ip-salt'),randomBytes(32).toString('hex')+'\n',{mode:0o600,flag:'wx'});}
 for(const file of ['faucet.key','ip-salt','turnstile.secret','deployment.json']){
  const s=await fs.stat(path.join(state,file));if(!s.isFile()||((file!== 'deployment.json')&&(s.mode&0o077)!==0))throw new Error('Missing private file or incorrect permissions');
 }
 process.stdout.write('Runtime files ready. Check Docker user ownership before startup; no secrets printed.\n');
}catch{process.stderr.write('Host setup incomplete. Run bootstrap/deploy, save the CAPTCHA secret in state/turnstile.secret with mode 0600, then retry.\n');process.exitCode=1;}
