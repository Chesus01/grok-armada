// Key from env IMPERIAL_SOL_PRIVATE_KEY only (never printed). JWT cached in .token (0600).
const nacl=require('tweetnacl'),bs58=require('bs58').default||require('bs58'),fs=require('fs');
const API='https://api.imperial.trade/api/v1',TOK=__dirname+'/.token';
function keypair(){const raw=(process.env.IMPERIAL_SOL_PRIVATE_KEY||'').trim();if(!raw)throw Error('IMPERIAL_SOL_PRIVATE_KEY not set');
 const b=raw.startsWith('[')?Uint8Array.from(JSON.parse(raw)):bs58.decode(raw);
 return b.length===64?nacl.sign.keyPair.fromSecretKey(b):nacl.sign.keyPair.fromSeed(b.slice(0,32));}
const pubkey=()=>bs58.encode(keypair().publicKey);
async function post(p,b){const r=await fetch(API+p,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b)});const t=await r.text();if(!r.ok)throw Error(p+' '+r.status+' '+t.slice(0,200));return JSON.parse(t);}
async function login(){const kp=keypair(),wallet=bs58.encode(kp.publicKey),message=`imperial:mobile-connect:${wallet}:${Date.now()}`;
 const signature=bs58.encode(nacl.sign.detached(Buffer.from(message),kp.secretKey));
 const {code}=await post('/mobile/connect',{wallet,message,signature});const j=await post('/mobile/exchange',{code});
 fs.writeFileSync(TOK,JSON.stringify(j),{mode:0o600});return j;}
async function token(){try{const j=JSON.parse(fs.readFileSync(TOK));if(j.expiresAt-60>Date.now()/1000)return j.jwt;}catch{}return (await login()).jwt;}
async function api(path,opt={}){const r=await fetch(API+path,{...opt,headers:{'content-type':'application/json',authorization:'Bearer '+await token(),...(opt.headers||{})}});const t=await r.text();try{return {status:r.status,body:JSON.parse(t)}}catch{return {status:r.status,body:t}}}
const markets=()=>fetch(API+'/armada/markets').then(r=>r.json());
module.exports={API,pubkey,login,token,api,keypair,markets};
