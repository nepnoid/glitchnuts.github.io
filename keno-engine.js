/* Kdawg Keno browser engine. Demo credits only; not a real-money RNG service. */
(function (root) {
  const payouts = {
    1: {1:3}, 2: {1:1,2:8}, 3: {2:2,3:20},
    4: {2:1,3:4,4:30}, 5: {3:2,4:10,5:40}
  };
  function randomInt(max) {
    const cutoff = Math.floor(4294967296 / max) * max;
    const buffer = new Uint32Array(1);
    do { root.crypto.getRandomValues(buffer); } while (buffer[0] >= cutoff);
    return buffer[0] % max;
  }
  function draw(rng = randomInt) {
    const pool = Array.from({length:80},(_,i)=>i+1);
    for(let i=0;i<20;i++) {
      const offset=rng(80-i);
      if(!Number.isInteger(offset)||offset<0||offset>=80-i) throw new Error('Invalid random value');
      const j=i+offset; [pool[i],pool[j]]=[pool[j],pool[i]];
    }
    return pool.slice(0,20);
  }
  function validNumbers(numbers) {
    return Array.isArray(numbers) && new Set(numbers).size===numbers.length && numbers.every(n=>Number.isInteger(n)&&n>=1&&n<=80);
  }
  function settle(picks, numbers, wager) {
    if(!validNumbers(picks)||picks.length<1||picks.length>5) throw new Error('Pick 1–5 unique numbers');
    if(!validNumbers(numbers)||numbers.length!==20) throw new Error('Expected 20 distinct drawn numbers');
    if(!Number.isSafeInteger(wager)||wager<=0) throw new Error('Invalid demo wager');
    const hits=picks.filter(n=>numbers.includes(n)).length;
    const multiplier=payouts[picks.length][hits]||0;
    if(!Number.isSafeInteger(wager*multiplier)) throw new Error('Payout overflow');
    return {hits,multiplier,payout:wager*multiplier};
  }
  root.KenoEngine={payouts,draw,settle};
})(globalThis);
