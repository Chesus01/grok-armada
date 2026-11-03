// node setup.js [--offline]  Installs deps, checks config, logs in by wallet signature, verifies balances. Places no trades.
const {execSync}=require('child_process'),fs=require('fs'),D=__dirname,OFF=process.argv.includes('--offline');
const out=(k,v)=>console.log(JSON.stringify({step:k,...v}));
(async()=>{
 if(+process.versions.node.split('.')[0]<18){out('node',{ok:false,msg:'Node 18+ required'});process.exit(1);}
 try{require.resolve('tweetnacl',{paths:[D]});require.resolve('bs58',{paths:[D]});require.resolve('@solana/web3.js',{paths:[D]});out('deps',{ok:true});}
 catch{out('deps',{installing:true});execSync('npm install --no-audit --no-fund --silent',{cwd:D,stdio:'inherit'});out('deps',{ok:true});}
 let C;try{C=require('./log').cfg();out('config',{ok:true,tier:C.tier,markets:Object.keys(C.markets).length});}catch(e){out('config',{ok:false,msg:'copy a tier file to config.json: '+e.message});process.exit(1);}
 const {markets,login,api,pubkey,keypairUnchecked,keyEnv,hasKey,rawCfg}=require('./auth'),bs58=require('bs58').default||require('bs58'),K=keyEnv();
 out('tier',{tier:C.tier,keyEnv:K,folder:require('path').dirname(D),pinnedWallet:rawCfg().wallet||null});
 if(OFF){out('offline',{ok:true,msg:'skipped network checks'});return;}
 const mk=await markets(),bad=Object.keys(C.markets).filter(s=>{const m=mk.find(x=>x.symbol===s);return !m||m.reduceOnly;});
 out('markets',{ok:!bad.length,live:mk.length,untradable:bad});
 if(!hasKey()){out('key',{ok:false,msg:K+' not set - add it through the secure secret box, never in chat'});process.exit(2);}
 const kw=bs58.encode(keypairUnchecked().publicKey),RC=rawCfg();
 if(!RC.wallet){RC.wallet=kw;fs.writeFileSync(D+'/config.json',JSON.stringify(RC,null,1));out('pin',{ok:true,wallet:kw,msg:'wallet recorded in config.json; scripts now refuse any other key'});}
 const w=pubkey();out('key',{ok:true,wallet:w});
 try{const H=require('os').homedir(),me=require('path').resolve(D,'..');for(const d of fs.readdirSync(H).filter(x=>/^armada-(easy|medium|high)$/.test(x))){const p=require('path').join(H,d);if(p===me)continue;try{const o=JSON.parse(fs.readFileSync(p+'/scripts/config.json'));if(o.wallet===w)out('shared_wallet',{ok:false,warn:true,other:d,msg:'another tier uses this same wallet - use a separate trading account per tier'});}catch{}}}catch{}
 const j=await login();out('login',{ok:true,expires:new Date(j.expiresAt*1000).toISOString()});
 const b=await api('/mobile/balances'),usdc=(b.body.profiles||[]).reduce((s,p)=>s+p.usdc/1e6,0);
 let sol=null;try{const r=await fetch(process.env.SOL_RPC||'https://api.mainnet-beta.solana.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'getBalance',params:[w]})});sol=(await r.json()).result.value/1e9;}catch{}
 const minNeed=C.margin+1;
 out('balance',{ok:usdc>=minNeed,imperialUsdc:+usdc.toFixed(2),walletSol:sol,msg:usdc>=minNeed?'ready to trade':`deposit at least $${minNeed} USDC into Imperial first`});
})().catch(e=>{out('error',{ok:false,msg:e.message});process.exit(1)});
