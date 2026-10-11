'use strict';
const $ = id => document.getElementById(id);
const money = n => n.toLocaleString();
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const storageKey = 'kdawg-keno-session-v1';
function readSaved(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } }
const saved = readSaved(storageKey, {});
let balance = Number.isSafeInteger(saved.balance) && saved.balance >= 0 && saved.balance < 1e12 ? saved.balance : 10000;
let wins = Number.isSafeInteger(saved.wins) && saved.wins >= 0 ? saved.wins : 0;
let rounds = Number.isSafeInteger(saved.rounds) && saved.rounds >= 0 ? saved.rounds : 0;
let best = Math.max(balance, Number.isSafeInteger(saved.best) ? saved.best : 10000);
let game = 'keno', busy = false, mining = false, cancelMining = false, minedBlocks = 0;
let lastClaim = Number(saved.lastClaim) || 0;
const picks = new Set();
const games = {
  keno:{title:'Kdawg Keno',desc:'Pick 1–5 numbers. We draw 20 of 80. Hits decide your payout.',symbols:''},
  dice:{title:'Hash Dice · arcade preview',desc:'A quick demo roll. Browser credits only.',symbols:'◈ 7 ◈',multiplier:1.85,threshold:.43},
  glitch:{title:'Glitch Drop · arcade preview',desc:'Chase a demo multiplier. Browser credits only.',symbols:'⚡ 2.2× ⚡',multiplier:2.2,threshold:.48},
  blackjack:{title:'Blackjack · arcade preview',desc:'Simplified two-hand comparison, not full Blackjack rules.',symbols:'♠ 20 ♥ 18'},
  roulette:{title:'Roulette · arcade preview',desc:'Automatic red bet pays 2× gross. Zero is green.',symbols:'◎ RED ◎'},
  slots:{title:'Nutz Slots · arcade preview',desc:'Three matching reels pay 20× gross.',symbols:'✦ 7 ✦'}
};
function save() { try { localStorage.setItem(storageKey, JSON.stringify({balance,wins,rounds,best,lastClaim})); } catch {} }
function updateStats() {
  best = Math.max(best,balance);
  $('balance').firstChild.textContent = money(balance);
  $('wins').textContent = wins;
  const data = [['Balance',balance,'Demo credits'],['Personal best',best,'This device'],['Rounds played',rounds,'Completed rounds']];
  $('leaderboard').replaceChildren(...data.map(([name,value,label],i)=>{
    const row=document.createElement('div');row.className='leader';
    const rank=document.createElement('span');rank.className='rank';rank.textContent=i+1;
    const who=document.createElement('span');who.className='who';
    const title=document.createElement('b');title.textContent=name;const detail=document.createElement('small');detail.textContent=label;
    who.append(title,detail);const score=document.createElement('span');score.className='score';score.textContent=money(value);
    row.append(rank,who,score);return row;
  }));save();
}
function wagerLabel() {
  const wager=Number($('wager').value);$('wagerLabel').textContent=wager;
  if(!busy)$('play').textContent=game==='keno'?`Draw 20 · ${wager} GNC-C`:`Play ${wager} GNC-C`;
  document.querySelectorAll('.chip[data-wager]').forEach(c=>c.classList.toggle('selected',Number(c.dataset.wager)===wager));
}
function renderPicks() {
  $('pickCount').textContent=`${picks.size} / 5 picked`;
  $('kenoGrid').querySelectorAll('button').forEach(b=>{const selected=picks.has(Number(b.dataset.number));b.classList.toggle('picked',selected);b.setAttribute('aria-pressed',String(selected));});
  const table=KenoEngine.payouts[picks.size];
  $('paytable').textContent=table?`Gross payout · ${Object.entries(table).map(([hits,mult])=>`${hits} hit${Number(hits)===1?'':'s'} = ${mult}×`).join(' / ')} · includes stake`:'Pick 1–5 numbers to see the payout table.';
}
for(let n=1;n<=80;n++) {
  const button=document.createElement('button');button.type='button';button.className='keno-number';button.dataset.number=n;
  button.textContent=String(n).padStart(2,'0');button.setAttribute('aria-label',`Keno number ${n}`);button.setAttribute('aria-pressed','false');
  button.addEventListener('click',()=>{if(busy)return;if(picks.has(n))picks.delete(n);else if(picks.size<5)picks.add(n);else{$('result').textContent='Five is the limit. Unpick one to change it.';return;}clearDraw();renderPicks();});
  $('kenoGrid').appendChild(button);
}
function clearDraw(){ $('drawnNumbers').replaceChildren();$('kenoGrid').querySelectorAll('button').forEach(b=>{b.classList.remove('drawn','hit');}); }
$('quickPick').addEventListener('click',()=>{if(busy)return;picks.clear();KenoEngine.draw().slice(0,5).forEach(n=>picks.add(n));clearDraw();renderPicks();});
$('clearPicks').addEventListener('click',()=>{if(busy)return;picks.clear();clearDraw();renderPicks();});
function selectGame(id){if(busy||!games[id])return;game=id;document.querySelectorAll('.game-tab').forEach(b=>b.classList.toggle('active',b.dataset.game===id));$('gameTitle').textContent=games[id].title;$('gameDesc').textContent=games[id].desc;$('kenoPanel').hidden=id!=='keno';$('symbols').hidden=id==='keno';$('symbols').textContent=games[id].symbols;$('result').textContent=id==='keno'?'Choose your numbers or use Quick pick.':'Arcade preview ready.';wagerLabel();}
document.querySelectorAll('.game-tab').forEach(b=>b.addEventListener('click',()=>selectGame(b.dataset.game)));
$('wager').addEventListener('input',wagerLabel);
document.querySelectorAll('.chip[data-wager]').forEach(b=>b.addEventListener('click',()=>{if(busy)return;$('wager').value=b.dataset.wager;wagerLabel();}));
function lockRound(value){busy=value;$('play').disabled=value;$('wager').disabled=value;$('quickPick').disabled=value;$('clearPicks').disabled=value;document.querySelectorAll('.game-tab,.chip[data-wager],.keno-number').forEach(b=>b.disabled=value);}
$('play').addEventListener('click',async()=>{
  if(busy)return;const wager=Number($('wager').value),activeGame=game;
  if(balance<wager){$('result').textContent='Low demo balance? Claim free browser credits above.';return;}
  if(activeGame==='keno'&&!picks.size){$('result').textContent='Pick at least one number, or tap Quick pick.';return;}
  // Validate and capture the outcome before deducting the stake.
  let draw,result;
  try{if(activeGame==='keno'){draw=KenoEngine.draw();result=KenoEngine.settle([...picks],draw,wager);}}catch{$('result').textContent='Unable to start this round. No credits deducted.';return;}
  lockRound(true);balance-=wager;updateStats();$('play').textContent='Drawing…';
  let payout=0,detail='';
  try{
    if(activeGame==='keno'){
      clearDraw();let hits=0;
      for(let i=0;i<draw.length;i++){
        const n=draw[i];const button=$('kenoGrid').querySelector(`[data-number="${n}"]`);button.classList.add('drawn');
        const ball=document.createElement('span');ball.className='draw-ball';ball.textContent=String(n).padStart(2,'0');
        if(picks.has(n)){button.classList.add('hit');ball.classList.add('hit');hits++;}
        $('drawnNumbers').appendChild(ball);$('result').textContent=`Ball ${i+1}/20 · ${hits} matched`;
        await sleep(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?10:85);
      }
      payout=result.payout;detail=`${result.hits} of ${picks.size} matched · ${result.multiplier}× gross`;
    }else{
      await sleep(600);
      const rng=()=>KenoEngine.draw()[0];
      if(activeGame==='slots') {const symbols=['✦','7','⚡','◈'];const values=[rng()%4,rng()%4,rng()%4];$('symbols').textContent=values.map(n=>symbols[n]).join(' ');payout=values.every(n=>n===values[0])?wager*20:0;detail='Three-reel arcade preview';}
      else if(activeGame==='roulette'){const number=rng()%37;const red=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number);$('symbols').textContent=`${number} · ${number===0?'GREEN':red?'RED':'BLACK'}`;payout=red?wager*2:0;detail='Automatic red bet';}
      else if(activeGame==='blackjack'){const player=16+rng()%8,dealer=16+rng()%8;$('symbols').textContent=`YOU ${player} · DEALER ${dealer}`;payout=player<=21&&(dealer>21||player>dealer)?wager*2:player===dealer&&player<=21?wager:0;detail='Simplified hand comparison';}
      else{const win=Math.random()>games[activeGame].threshold;payout=win?Math.floor(wager*games[activeGame].multiplier):0;detail='Demo round complete';}
    }
    balance+=payout;rounds++;if(payout>wager)wins++;updateStats();
    const net=payout-wager;$('result').textContent=`${detail}. Returned ${money(payout)} GNC-C · net ${net>=0?'+':''}${money(net)}.`;
    const chip=document.createElement('span');chip.className=net>0?'win':'';chip.textContent=`${net>=0?'+':''}${money(net)}`;$('recent').appendChild(chip);while($('recent').children.length>7)$('recent').children[1].remove();
  }catch{balance+=wager;updateStats();$('result').textContent='Round interrupted. Your stake was returned.';}
  finally{lockRound(false);wagerLabel();}
});
$('demoFaucet').addEventListener('click',()=>{
  const remaining=30000-(Date.now()-lastClaim);
  if(remaining>0){$('faucetStatus').textContent=`More demo credits in ${Math.ceil(remaining/1000)}s. Not on-chain GNC.`;return;}
  lastClaim=Date.now();balance+=1000;updateStats();$('faucetStatus').textContent='+1,000 browser credits added. Available again in 30s.';
});
$('close').onclick=()=> $('modal').classList.remove('open');$('close2').onclick=$('close').onclick;
const BOARD_API=(document.querySelector('meta[name=gnc-board-api]')?.content||'').replace(/\/$/,'');
async function api(path,options={}){const response=await fetch(BOARD_API+path,{...options,signal:AbortSignal.timeout(8000)});if(!response.ok)throw new Error(response.status===429?'Please wait before posting again.':'GNC API unavailable.');return response.json();}
async function loadNetworkStatus(){
  if(!BOARD_API){$('networkTag').textContent='RPC NOT CONFIGURED';return;}
  $('networkTag').textContent='CHECKING RPC…';
  try{const data=await api('/api/network/status');if(data.status!=='connected'||!Number.isSafeInteger(data.blockHeight))throw new Error();$('networkTag').textContent=`RPC READ-ONLY · BLOCK ${data.blockHeight}`;}
  catch{$('networkTag').textContent='RPC UNAVAILABLE';}
}
function renderPosts(posts,shared){
  if(!posts.length){$('posts').textContent=shared?'No messages yet. Start the conversation.':'Your local lobby is empty. Say hello.';return;}
  $('posts').replaceChildren(...posts.filter(p=>typeof p==='string'||typeof p?.text==='string').map(item=>{
    const row=document.createElement('div');row.className='post';row.append(document.createTextNode(typeof item==='string'?item:item.text));
    const small=document.createElement('small');small.textContent=shared?`${item.displayName||'Guest'} · public shared post`:'Local post · this device only';row.append(small);return row;
  }));
}
async function refreshBoard(){
  if(!BOARD_API){$('boardStatus').textContent='Local board · shared API not configured';renderPosts(readSaved('gnc-demo-board',[]),false);return;}
  $('boardStatus').textContent='Loading public board…';
  try{const data=await api('/api/board/messages?limit=40');if(!Array.isArray(data.messages))throw new Error();renderPosts(data.messages,true);$('boardStatus').textContent='Shared public board · online';}
  catch{$('boardStatus').textContent='Shared board offline. Posting will not silently become local.';}
}
$('boardForm').addEventListener('submit',async e=>{
  e.preventDefault();const text=$('postInput').value.trim();if(!text)return;
  $('postButton').disabled=true;
  try{
    if(BOARD_API){await api('/api/board/messages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({displayName:$('displayName').value.trim()||'Guest',text})});$('postInput').value='';await refreshBoard();}
    else{const posts=readSaved('gnc-demo-board',[]);posts.unshift(text);try{localStorage.setItem('gnc-demo-board',JSON.stringify(posts.slice(0,40)));}catch{}$('postInput').value='';renderPosts(posts.slice(0,40),false);}
  }catch(error){$('boardStatus').textContent=error.message||'Post failed. Your message is still in the box.';}
  finally{$('postButton').disabled=false;}
});
$('mineButton').addEventListener('click',async()=>{
  if(mining)return;if(!window.crypto?.subtle){$('minerConsole').textContent='Web Crypto unavailable. Use HTTPS.';return;}
  mining=true;cancelMining=false;$('mineButton').disabled=true;$('stopMining').disabled=false;
  const seed=crypto.randomUUID(),target='000';let nonce=0;const started=Date.now();
  try{
    while(!cancelMining&&Date.now()-started<20000){
      const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`KDAWG-DEMO|${seed}|${nonce}`));
      const hash=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash.startsWith(target)){minedBlocks++;$('minedBlocks').textContent=minedBlocks;$('lastNonce').textContent=nonce;balance+=25;updateStats();$('minerConsole').textContent=`DEMO PUZZLE SOLVED\nnonce=${nonce}\nhash=${hash}\n+25 browser credits. No blockchain transaction.`;return;}
      if(++nonce%100===0){$('minerConsole').textContent=`SHA-256 puzzle · nonce ${nonce}\nStop anytime. This is not GNC network mining.`;await sleep(0);}
    }
    $('minerConsole').textContent=cancelMining?'Stopped. No reward issued.':'Time limit reached. Try another puzzle.';
  }catch{$('minerConsole').textContent='Puzzle failed. No network transaction occurred.';}
  finally{mining=false;$('mineButton').disabled=false;$('stopMining').disabled=true;}
});
$('stopMining').addEventListener('click',()=>cancelMining=true);
updateStats();renderPicks();selectGame('keno');loadNetworkStatus();refreshBoard();
