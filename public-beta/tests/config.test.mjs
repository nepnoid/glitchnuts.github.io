import test from 'node:test';import assert from 'node:assert/strict';
let readConfig;try{({readConfig}=await import('../lib/config.mjs'));}catch{}
const valid={PUBLIC_ORIGIN:'https://gnc.example.test',ALLOWED_ORIGINS:'https://nepnoid.github.io',RPC_UPSTREAM:'http://validator1:8545',TOKEN_ADDRESS:'0x0000000000000000000000000000000000000001',GENESIS_HASH:'0x'+'1'.repeat(64),FAUCET_KEY_FILE:'/state/faucet.key',CLAIM_DB:'/state/claims.sqlite',IP_HASH_SALT_FILE:'/state/ip-salt',TURNSTILE_SECRET_FILE:'/state/turnstile.secret',TURNSTILE_SITE_KEY:'widget-key',TURNSTILE_HOSTNAME:'nepnoid.github.io',TRUSTED_PROXY_CIDR:'10.77.0.2/32'};
test('beta configuration fails closed on missing CAPTCHA, HTTPS origin, genesis and external upstream',()=>{
 assert.equal(typeof readConfig,'function');assert.equal(readConfig(valid).chainId,771337);
 for(const field of ['TURNSTILE_SECRET_FILE','TURNSTILE_SITE_KEY','GENESIS_HASH','FAUCET_KEY_FILE','IP_HASH_SALT_FILE'])assert.throws(()=>readConfig({...valid,[field]:''}));
 assert.throws(()=>readConfig({...valid,PUBLIC_ORIGIN:'http://gnc.example.test'}));
 assert.throws(()=>readConfig({...valid,RPC_UPSTREAM:'https://mainnet.example.test'}));
 assert.throws(()=>readConfig({...valid,ALLOWED_ORIGINS:'*'}));
 assert.throws(()=>readConfig({...valid,TRUSTED_PROXY_CIDR:'0.0.0.0/0'}));
 assert.throws(()=>readConfig({...valid,TRUSTED_PROXY_CIDR:''}));
});
