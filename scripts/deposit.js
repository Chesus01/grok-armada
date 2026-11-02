// usage: node deposit.js <usdc> [profileIndex] [deposit|withdraw]  (signs locally; key never printed)
const {api,keypair,pubkey}=require('./auth');const w3=require('@solana/web3.js');
const RPC=process.env.SOL_RPC||'https://api.mainnet-beta.solana.com';
(async()=>{const amt=Math.round(parseFloat(process.argv[2])*1e6),idx=+(process.argv[3]||0),mode=process.argv[4]||'deposit';
 const r=await api('/deposit/build-tx',{method:'POST',body:JSON.stringify({wallet:pubkey(),profileIndex:idx,amount:amt,mode})});
 if(r.status!==200)throw Error('build '+r.status+' '+JSON.stringify(r.body));
 const tx=w3.VersionedTransaction.deserialize(Buffer.from(r.body.transaction,'base64'));
 const kp=keypair();tx.sign([w3.Keypair.fromSecretKey(kp.secretKey)]);
 const c=new w3.Connection(RPC,'confirmed');const sig=await c.sendRawTransaction(tx.serialize(),{maxRetries:5});
 console.log('sent',sig);const bh=await c.getLatestBlockhash();const res=await c.confirmTransaction({signature:sig,...bh},'confirmed');console.log('confirmed',JSON.stringify(res.value));
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
