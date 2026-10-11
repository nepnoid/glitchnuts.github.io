import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {PublicError} from './security.mjs';
export class Store {
 constructor(filename){
  this.db=new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
   CREATE TABLE IF NOT EXISTS challenges(id TEXT PRIMARY KEY,address TEXT NOT NULL,origin TEXT NOT NULL,nonce TEXT NOT NULL,chainId INTEGER NOT NULL,token TEXT NOT NULL,expiresAt INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS claims(id TEXT PRIMARY KEY,address TEXT NOT NULL,ipHash TEXT NOT NULL,createdAt INTEGER NOT NULL,state TEXT NOT NULL,rawTx TEXT,tokenHash TEXT,gasHash TEXT);
   CREATE INDEX IF NOT EXISTS claims_address ON claims(address,createdAt);
   CREATE INDEX IF NOT EXISTS claims_ip ON claims(ipHash,createdAt);
   CREATE TABLE IF NOT EXISTS requests(scope TEXT NOT NULL,identity TEXT NOT NULL,time INTEGER NOT NULL);
   CREATE INDEX IF NOT EXISTS request_scope ON requests(scope,identity,time);
   CREATE TABLE IF NOT EXISTS controls(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  `);
 }
 saveChallenge(c){this.db.prepare('INSERT INTO challenges(id,address,origin,nonce,chainId,token,expiresAt) VALUES(?,?,?,?,?,?,?)').run(c.id,c.address.toLowerCase(),c.origin,c.nonce,c.chainId,c.token,c.expiresAt);return c;}
 challenge(id){return this.db.prepare('SELECT * FROM challenges WHERE id=?').get(id);}
 throttle(scope,identity,now,max,windowMs,units=1){
  if(!Number.isSafeInteger(units)||units<1||units>100)throw new PublicError(429,'Invalid request budget');
  this.db.exec('BEGIN IMMEDIATE');try{
   const count=this.db.prepare('SELECT count(*) n FROM requests WHERE scope=? AND identity=? AND time>?').get(scope,identity,now-windowMs).n;
   if(count+units>max)throw new PublicError(429,'Request limit reached');
   for(let i=0;i<units;i++)this.db.prepare('INSERT INTO requests VALUES(?,?,?)').run(scope,identity,now);
   this.db.prepare('DELETE FROM requests WHERE time<?').run(now-86400000);this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 reserve({challengeId,ipHash,now,config}){
  this.db.exec('BEGIN IMMEDIATE');try{
   if(this.db.prepare("SELECT value FROM controls WHERE key='paused'").get()?.value==='1')throw new PublicError(503,'Faucet paused');
   const c=this.challenge(challengeId);if(!c||c.used||c.expiresAt<=now)throw new PublicError(401,'Challenge expired or already used');
   const recent=this.db.prepare('SELECT count(*) n FROM claims WHERE address=? AND createdAt>?').get(c.address,now-config.cooldownMs).n;
   if(recent)throw new PublicError(429,'Wallet cooldown active');
   if(this.db.prepare('SELECT count(*) n FROM claims WHERE ipHash=? AND createdAt>?').get(ipHash,now-86400000).n>=config.ipMax)throw new PublicError(429,'Daily network limit reached');
   const midnight=Math.floor(now/86400000)*86400000;
   if(this.db.prepare('SELECT count(*) n FROM claims WHERE createdAt>=?').get(midnight).n>=config.dailyMax)throw new PublicError(503,'Daily faucet budget reached');
   const id=randomUUID();this.db.prepare('INSERT INTO claims(id,address,ipHash,createdAt,state) VALUES(?,?,?,?,?)').run(id,c.address,ipHash,now,'reserved');
   this.db.prepare('UPDATE challenges SET used=1 WHERE id=?').run(challengeId);this.db.exec('COMMIT');return {id,address:c.address};
  }catch(e){this.db.exec('ROLLBACK');throw e;}
 }
 update(id,state,{rawTx=null,tokenHash=null,gasHash=null}={}){this.db.prepare('UPDATE claims SET state=?,rawTx=COALESCE(?,rawTx),tokenHash=COALESCE(?,tokenHash),gasHash=COALESCE(?,gasHash) WHERE id=?').run(state,rawTx,tokenHash,gasHash,id);}
 claim(id){return this.db.prepare('SELECT id,address,createdAt,state,tokenHash,gasHash FROM claims WHERE id=?').get(id);}
 pending(){return this.db.prepare("SELECT * FROM claims WHERE state NOT IN ('complete','failed') ORDER BY createdAt").all();}
 setPaused(value){this.db.prepare("INSERT INTO controls(key,value) VALUES('paused',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(value?'1':'0');}
 isPaused(){return this.db.prepare("SELECT value FROM controls WHERE key='paused'").get()?.value==='1';}
 cleanup(now){this.db.prepare('DELETE FROM challenges WHERE expiresAt<?').run(now-86400000);this.db.prepare('DELETE FROM claims WHERE createdAt<? AND state IN (\'complete\',\'failed\')').run(now-30*86400000);}
 close(){this.db.close();}
}
