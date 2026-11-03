// node setup.js [--offline]  Installs deps, checks config, logs in by wallet signature, verifies balances. Places no trades.
const {execSync}=require('child_process'),fs=require('fs'),D=__dirname,OFF=process.argv.includes('--offline');
const out=(k,v)=>console.log(JSON.stringify({step:k,...v}));
(async()=>{
 if(+process.versions.node.split('.')[0]<18){out('node',{ok:false,msg:'Node 18+ required'});process.exit(1);}
 try{require.resolve('tweetnacl',{paths:[D]});require.resolve('bs58',{paths:[D]});require.resolve('@solana/web3.js',{paths:[D]});out('deps',{ok:true});}
 catch{out('deps',{installing:true});execSync('npm install --no-audit --no-fund --silent',{cwd:D,stdio:'inherit'});out('deps',{ok:true});}
 let C;try{C=require('./log').cfg();out('config',{ok:true,tier:C.tier,markets:Object.keys(C.markets).length});}catch(e){out('config',{ok:false,msg:'copy a tier file to config.json: '+e.message});process.exit(1);}
 const {markets,login,api,pubkey}=require('./auth');
 if(OFF){out('offline',{ok:true,msg:'skipped network checks'});return;}
 const mk=await markets(),bad=Object.keys(C.markets).filter(s=>{const m=mk.find(x=>x.symbol===s);return !m||m.reduceOnly;});
 out('markets',{ok:!bad.length,live:mk.length,untradable:bad});
 if(!(process.env.IMPERIAL_SOL_PRIVATE_KEY||'').trim()){out('key',{ok:false,msg:'IMPERIAL_SOL_PRIVATE_KEY not set - add it through the secure secret box, never in chat'});process.exit(2);}
 let w;try{w=pubkey();}catch(e){out('key',{ok:false,msg:'key format not recognised (expect base58 or [..] array)'});process.exit(2);}
 out('key',{ok:true,wallet:w});
 const j=await login();out('login',{ok:true,expires:new Date(j.expiresAt*1000).toISOString()});
 const b=await api('/mobile/balances'),usdc=(b.body.profiles||[]).reduce((s,p)=>s+p.usdc/1e6,0);
 let sol=null;try{const r=await fetch(process.env.SOL_RPC||'https://api.mainnet-beta.solana.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getBalance',params:[w]})});sol=(await r.json()).result.value/1e9;}catch{}
 const minNeed=C.margin+1;
 out('balance',{ok:usdc>=minNeed,imperialUsdc:+usdc.toFixed(2),walletSol:sol,msg:usdc>=minNeed?'ready to trade':`deposit at least $${minNeed} USDC into Imperial first`});
})().catch(e=>{out('error',{ok:false,msg:e.message});process.exit(1)});
