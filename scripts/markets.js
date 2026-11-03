// node markets.js                 -> active, starter and suggested markets (JSON)
// node markets.js add SYM [SYM..] -> add from this tier's suggested list (or re-enable a removed starter market)
// node markets.js remove SYM [..] -> stop trading a market (open positions are NOT closed)
// Tier limits (leverage, pre-IPO cap, sizing, halts) apply to added markets exactly like starter ones. No network, no key needed.
const fs=require('fs'),F=__dirname+'/config.json',{cfg}=require('./log');
const C=JSON.parse(fs.readFileSync(F)),[cmd,...syms]=process.argv.slice(2).map((x,i)=>i?x.toUpperCase():x);
C.extraMarkets=C.extraMarkets||[];C.removeMarkets=C.removeMarkets||[];const S=C.suggested||{},bad=[];
if(cmd==='add')for(const s of syms){if(C.markets[s])C.removeMarkets=C.removeMarkets.filter(x=>x!==s);else if(S[s]){if(!C.extraMarkets.includes(s))C.extraMarkets.push(s);}else bad.push(s);}
else if(cmd==='remove')for(const s of syms){C.extraMarkets=C.extraMarkets.filter(x=>(x.symbol||x)!==s);if(C.markets[s]&&!C.removeMarkets.includes(s))C.removeMarkets.push(s);}
else if(cmd){console.error('usage: node markets.js [add|remove SYM ...]');process.exit(1);}
if(cmd)fs.writeFileSync(F,JSON.stringify(C,null,1));
const A=cfg().markets;
console.log(JSON.stringify({tier:C.tier,active:Object.keys(A),starter:Object.keys(C.markets),added:C.extraMarkets,removed:C.removeMarkets,
 suggested:Object.keys(S).filter(s=>!A[s]),unknown:bad.length?bad.map(s=>s+' is not in this tier\'s suggested list'):undefined,preIpoMaxLev:C.preIpoMaxLev}));
