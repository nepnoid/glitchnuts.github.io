import express from 'express';
import { Contract, formatUnits } from 'ethers';
import { normalizeDestination, readFaucetSettings } from '../lib/config.mjs';
import { localProvider, readDeployment } from '../lib/deployment.mjs';

const tokenAbi = [
  'function owner() view returns (address)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
];

function loopbackIp(request) {
  const ip = request.socket.remoteAddress ?? '';
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return '127.0.0.1';
  return null;
}

function safeError(response, status, message) {
  response.status(status).json({ error: message });
}

function page() {
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kdawg Keno local GNC faucet</title>
<style>body{margin:0;background:#07120b;color:#d9ffe2;font:16px ui-monospace,monospace}.box{max-width:680px;margin:9vh auto;padding:28px;border:1px solid #2b8a4b;background:#0b1c10;box-shadow:0 0 28px #145c2b}h1{color:#64ff91;margin-top:0}input,button{box-sizing:border-box;width:100%;padding:13px;border-radius:4px;font:inherit}input{border:1px solid #3ca35f;background:#06100a;color:#eaffef}button{margin-top:12px;border:0;background:#44dc72;color:#041006;font-weight:bold;cursor:pointer}button:disabled{opacity:.55}#status{white-space:pre-wrap;overflow-wrap:anywhere;min-height:5em;color:#baffca}.dim{color:#8fbb99;font-size:.9em}</style>
<main class="box"><h1>Kdawg Keno local GNC faucet</h1><p>Loopback-only development faucet. Claim test ERC-20 GNC and separate native test ETH for gas.</p><label for="address">Public destination address</label><input id="address" autocomplete="off" spellcheck="false" placeholder="0x… (your local EVM address)"><button id="claim">Claim test GNC</button><pre id="status">Enter a destination address.</pre><p class="dim">No wallet connection or secret is requested. The local faucet signer sends both test assets.</p></main>
<script>
const $=id=>document.getElementById(id), status=$('status'), claim=$('claim');
claim.onclick=async()=>{claim.disabled=true;status.textContent='Submitting local claim…';try{const r=await fetch('/faucet',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({address:$('address').value})});const data=await r.json();if(!r.ok)throw new Error(data.error||'Claim failed');status.textContent='Native gas tx: '+data.gasTxHash+'\\nGNC token tx: '+data.tokenTxHash+'\\nWaiting for token receipt…';const balance=await (await fetch('/balance?address='+encodeURIComponent(data.destination))).json();if(!balance.ok)throw new Error('Claim submitted; balance lookup unavailable');status.textContent+='\\nGNC balance: '+balance.balanceGnc+' GNC';}catch(error){status.textContent='Claim unavailable: '+error.message;}finally{claim.disabled=false;}};
</script></html>`;
}

try {
  const settings = readFaucetSettings();
  const provider = await localProvider(settings.rpcUrl);
  const deployment = await readDeployment(settings.deploymentFile);
  const chainAccounts = (await provider.send('eth_accounts', [])).map((address) => address.toLowerCase());
  if (!chainAccounts.includes(deployment.faucet.toLowerCase())) throw new Error('faucet signer is not locally unlocked');
  const signerIndex = chainAccounts.indexOf(deployment.faucet.toLowerCase());
  const signer = await provider.getSigner(signerIndex);
  const token = new Contract(deployment.contract, tokenAbi, signer);
  if ((await token.owner()).toLowerCase() !== deployment.owner.toLowerCase()) throw new Error('deployment owner does not match on-chain GNC');
  if (await provider.getCode(deployment.contract) === '0x') throw new Error('deployment has no contract code');

  const claimsByAddress = new Map();
  const claimsByIp = new Map();
  let queue = Promise.resolve();
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(express.json({ limit: '1kb', strict: true }));
  app.get('/', (request, response) => {
    if (!loopbackIp(request)) return safeError(response, 403, 'local access only');
    response.type('html').send(page());
  });
  app.get('/health', (request, response) => {
    if (!loopbackIp(request)) return safeError(response, 403, 'local access only');
    response.json({ ok: true, chainId: 31337, service: 'Kdawg Keno local GNC faucet' });
  });
  app.get('/balance', async (request, response) => {
    if (!loopbackIp(request)) return safeError(response, 403, 'local access only');
    let destination;
    try {
      destination = normalizeDestination(request.query.address, deployment);
      const balance = await token.balanceOf(destination);
      response.json({ ok: true, balance: balance.toString(), balanceGnc: formatUnits(balance, 18) });
    } catch {
      safeError(response, 400, 'invalid EVM address');
    }
  });
  app.post('/faucet', async (request, response) => {
    const ip = loopbackIp(request);
    if (!ip) return safeError(response, 403, 'local access only');
    let destination;
    try {
      destination = normalizeDestination(request.body?.address, deployment);
    } catch (error) {
      return safeError(response, 400, error.message.includes('destination') ? 'invalid faucet destination' : 'invalid EVM address');
    }
    const now = Date.now();
    const recentlyClaimed = (key) => now - (key ?? 0) < settings.cooldownMs;
    if (recentlyClaimed(claimsByAddress.get(destination.toLowerCase()))) return safeError(response, 429, 'address cooldown active');
    const ipClaims = (claimsByIp.get(ip) ?? []).filter((time) => now - time < settings.cooldownMs);
    if (ipClaims.length >= settings.ipLimit) return safeError(response, 429, 'local request limit active');

    const work = async () => {
      const queuedNow = Date.now();
      if (queuedNow - (claimsByAddress.get(destination.toLowerCase()) ?? 0) < settings.cooldownMs) {
        const error = new Error('address cooldown active'); error.status = 429; throw error;
      }
      const queuedIpClaims = (claimsByIp.get(ip) ?? []).filter((time) => queuedNow - time < settings.cooldownMs);
      if (queuedIpClaims.length >= settings.ipLimit) {
        const error = new Error('local request limit active'); error.status = 429; throw error;
      }
      const tokenBalance = await token.balanceOf(deployment.faucet);
      if (tokenBalance < settings.tokenAmount) {
        const error = new Error('faucet is temporarily unavailable'); error.status = 503; throw error;
      }
      const gasTx = await signer.sendTransaction({ to: destination, value: settings.nativeAmount });
      const gasReceipt = await gasTx.wait();
      if (gasReceipt.status !== 1) throw new Error('native gas transfer failed');
      const tokenTx = await token.transfer(destination, settings.tokenAmount);
      const tokenReceipt = await tokenTx.wait();
      if (tokenReceipt.status !== 1) throw new Error('token transfer failed');
      const claimedAt = Date.now();
      claimsByAddress.set(destination.toLowerCase(), claimedAt);
      claimsByIp.set(ip, [...queuedIpClaims, claimedAt]);
      return { gasTxHash: gasTx.hash, tokenTxHash: tokenTx.hash, destination };
    };
    const result = queue.then(work, work);
    queue = result.catch(() => undefined);
    try {
      response.json(await result);
    } catch (error) {
      safeError(response, error.status ?? 503, error.status === 429 ? error.message : 'faucet is temporarily unavailable');
    }
  });
  app.use((error, request, response, next) => {
    if (error?.type === 'entity.parse.failed') return safeError(response, 400, 'invalid request');
    return safeError(response, 500, 'faucet is temporarily unavailable');
  });
  const server = app.listen(settings.port, '127.0.0.1');
  let closing = false;
  async function close() {
    if (closing) return;
    closing = true;
    await new Promise((resolve) => server.close(resolve));
  }
  process.once('SIGINT', () => { close().finally(() => process.exit(0)); });
  process.once('SIGTERM', () => { close().finally(() => process.exit(0)); });
  process.stdout.write(`Kdawg Keno local GNC faucet listening on http://127.0.0.1:${settings.port}\n`);
} catch {
  process.stderr.write('local faucet failed to start\n');
  process.exitCode = 1;
}
