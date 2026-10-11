import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('local faucet generated browser script has valid JavaScript',()=>{
  const source=fs.readFileSync(new URL('../scripts/faucet.mjs',import.meta.url),'utf8');
  const start=source.indexOf('function page()');
  const end=source.indexOf('\ntry {',start);
  const html=vm.runInNewContext(source.slice(start,end)+';page()');
  const script=/<script>([\s\S]*?)<\/script>/.exec(html)[1];
  assert.doesNotThrow(()=>new vm.Script(script));
});
