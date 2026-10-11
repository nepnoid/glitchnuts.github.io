import {Store} from '../lib/store.mjs';
const command=process.argv[2];
if(!['pause','resume','status'].includes(command)||!process.env.CLAIM_DB){process.stderr.write('Usage: CLAIM_DB=/claims/claims.sqlite node scripts/faucet-control.mjs pause|resume|status\n');process.exit(1);}
const store=new Store(process.env.CLAIM_DB);
try{
 if(command==='pause')store.setPaused(true);
 if(command==='resume'){
  if(store.pending().length)throw new Error('Unfinished claims require receipt reconciliation first; refusing to resume');
  store.setPaused(false);
 }
 process.stdout.write(`Faucet ${store.isPaused()?'paused':'enabled'}; ${store.pending().length} unresolved claim(s).\n`);
}catch{process.stderr.write('Control failed. Reconcile pending claims before resuming.\n');process.exitCode=1;}
finally{store.close();}
