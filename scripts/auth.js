// Key is read ONLY from the env var named by config.json "keyEnv" (e.g. EMPIRE_CADET_SOL_PRIVATE_KEY). Never printed.
// No fallback to any other variable. If config.json "wallet" is set, the key's pubkey must match it or every script aborts.
// JWT cached in .token (0600) inside this tier's folder, tagged with its wallet.
const nacl=require('tweetnacl'),bs58=require('bs58').default||require('bs58'),fs=require('fs');
const API='https://api.imperial.trade/api/v1',TOK=__dirname+'/.token',CFG=__dirname+'/config.json';
function abort(msg,code=3){console.log(JSON.stringify({step:'abort',ok:false,msg}));process.exit(code);}
function rawCfg(){try{return JSON.parse(fs.readFileSync(CFG))}catch{abort('config.json missing - copy your tier file to config.json',1)}}
function keyEnv(){const c=rawCfg(),k=c.keyEnv,want='EMPIRE_'+String(c.tier||'').toUpperCase()+'_SOL_PRIVATE_KEY';if(k!==want)abort(`config.json keyEnv must be ${want} for tier ${c.tier}`,1);return k;}
const hasKey=()=>!!(process.env[keyEnv()]||'').trim();
function keypairUnchecked(){const k=keyEnv(),raw=(process.env[k]||'').trim();if(!raw)abort(k+' not set - add it through the secure secret box, never in chat',2);
 let b;try{b=raw.startsWith('[')?Uint8Array.from(JSON.parse(raw)):bs58.decode(raw);}catch{abort('key format not recognised (expect base58 or [..] array)',2)}
 return b.length===64?nacl.sign.keyPair.fromSecretKey(b):nacl.sign.keyPair.fromSeed(b.slice(0,32));}
function keypair(){const kp=keypairUnchecked(),w=bs58.encode(kp.publicKey),pin=rawCfg().wallet;
 if(pin&&pin!==w)abort(`wallet mismatch: ${keyEnv()} is for ${w} but this tier is pinned to ${pin}. Refusing to run.`,4);return kp;}
const pubkey=()=>bs58.encode(keypair().publicKey);
async function post(p,b){const r=await fetch(API+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});const t=await r.text();if(!r.ok)throw Error(p+' '+r.status+' '+t.slice(0,200));return JSON.parse(t);}
async function login(){const kp=keypair(),wallet=bs58.encode(kp.publicKey),message=`imperial:mobile-connect:${wallet}:${Date.now()}`;
 const signature=bs58.encode(nacl.sign.detached(Buffer.from(message),kp.secretKey));
 const {code}=await post('/mobile/connect',{wallet,message,signature});const j=await post('/mobile/exchange',{code});j.wallet=wallet;
 fs.writeFileSync(TOK,JSON.stringify(j),{mode:0o600});return j;}
async function token(){const w=pubkey();try{const j=JSON.parse(fs.readFileSync(TOK));if(j.wallet===w&&j.expiresAt-60>Date.now()/1000)return j.jwt;}catch{}return (await login()).jwt;}
async function api(path,opt={}){const r=await fetch(API+path,{...opt,headers:{'content-type':'application/json',authorization:'Bearer '+await token(),...(opt.headers||{})}});const t=await r.text();try{return {status:r.status,body:JSON.parse(t)}}catch{return {status:r.status,body:t}}}
const markets=()=>fetch(API+'/armada/markets').then(r=>r.json());
module.exports={API,pubkey,login,token,api,keypair,keypairUnchecked,markets,keyEnv,hasKey,rawCfg,abort};
