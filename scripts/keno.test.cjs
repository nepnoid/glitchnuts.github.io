const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm=require('node:vm');const context=vm.createContext({crypto:require('node:crypto').webcrypto});const file=require('node:path').join(__dirname,'../keno-engine.js');if(fs.existsSync(file)) vm.runInContext(fs.readFileSync(file,'utf8'),context);const engine=context.KenoEngine||{};
test('draw contains 20 distinct numbers from 1 through 80',()=>{
  assert.equal(typeof engine.draw,'function');
  let cursor=0;const numbers=engine.draw(n=>(cursor++*17)%n);
  assert.equal(numbers.length,20);assert.equal(new Set(numbers).size,20);
  assert.ok(numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=80));
});
test('payout is determined by actual selected/drawn matches',()=>{
  assert.equal(typeof engine.settle,'function');
  const r=engine.settle([1,2,3,4,5],Array.from({length:20},(_,i)=>i+1),100);
  assert.equal(r.hits,5);assert.equal(r.multiplier,40);assert.equal(r.payout,4000);
  assert.equal(engine.settle([60,61,62,63,64],Array.from({length:20},(_,i)=>i+1),100).payout,0);
});
test('rejects duplicate/out-of-range picks and nonpositive wager',()=>{
  assert.equal(typeof engine.settle,'function');const draw=Array.from({length:20},(_,i)=>i+1);
  assert.throws(()=>engine.settle([1,1],draw,100));assert.throws(()=>engine.settle([81],draw,100));
  assert.throws(()=>engine.settle([],draw,100));assert.throws(()=>engine.settle([1],draw,0));
  assert.throws(()=>engine.settle([1],[1,1],100));
});
