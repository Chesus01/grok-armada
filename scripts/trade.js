// node trade.js open SYM long|short marginUsd lev tpPct slPct [dry]  |  node trade.js close SYM long|short
// Entry + on-exchange TP and SL in one batch, preflight first. tp/sl are % of margin (ROE).
const {api,pubkey,markets}=require('./auth');const log=require('./log');
const mark=async s=>(await markets()).find(x=>x.symbol===s);
const base=(sym,o)=>({wallet:pubkey(),profileIndex:0,priority:0,underwriter:7,requestedHedgeVenue:0,fundingStatus:0,symbol:sym,...o});
async function open(symbol,side,marginUsd,lev,tpPct,slPct,{dry=false,slip=50}={}){
 const mk=await mark(symbol);if(!mk||mk.reduceOnly)throw Error(symbol+' not tradable');
 const px=mk.markPrice,sd=side==='long'?0:1,size=marginUsd*lev;if(size<10)throw Error('below $10 min order');
 if(lev>mk.maxLeverage)throw Error('lev above market max '+mk.maxLeverage);
 {let C={};try{C=log.cfg()}catch{}if(C.markets?.[symbol]?.src==='i'&&lev>(C.preIpoMaxLev||4))throw Error('pre-IPO markets cap at '+(C.preIpoMaxLev||4)+'x');}
 const tp=sd===0?px*(1+tpPct/100/lev):px*(1-tpPct/100/lev),sl=sd===0?px*(1-slPct/100/lev):px*(1+slPct/100/lev);
 const entry=base(symbol,{side:sd,orderType:0,action:0,triggerCondition:0,triggerPrice:0,sizeUsd:Math.round(size*1e6),collateralAmount:Math.round(marginUsd*1e6),slippageBps:slip,leverage:lev,marketPrice:Math.round(px*1e6)});
 const leg=(price,isTp)=>base(symbol,{side:sd,orderType:isTp?1:2,action:1,closeBps:10000,sizeUsd:0,collateralAmount:0,slippageBps:100,triggerPrice:Math.round(price*1e9),triggerCondition:(sd===0)===isTp?0:1,marketPrice:0});
 const pf=await api('/mobile/orders/preflight',{method:'POST',body:JSON.stringify(entry)});
 const plan={symbol,side,px,size,lev,marginUsd,tp:+tp.toPrecision(6),sl:+sl.toPrecision(6),preflight:pf.body};
 if(!pf.body?.ok||dry)return plan;
 const r=await api('/mobile/orders/batch',{method:'POST',body:JSON.stringify({entry,closeOrders:[leg(tp,true),leg(sl,false)]})});
 plan.result=r.body;log.event('open',{...plan,ts:Date.now()});return plan;}
async function close(symbol,side,{slip=100}={}){const sd=side==='long'?0:1;
 const ps=((await api('/positions?walletAddress='+pubkey())).body.dataList||[]).find(p=>p.asset===symbol&&p.side===side);if(!ps)return {error:'no such position'};
 const o=base(symbol,{side:sd,orderType:0,action:1,closeBps:10000,sizeUsd:Math.round(+ps.sizeUsd*1e6),collateralAmount:0,triggerCondition:0,triggerPrice:0,slippageBps:slip,marketPrice:Math.round((await mark(symbol)).markPrice*1e6)});
 const r=await api('/mobile/orders',{method:'POST',body:JSON.stringify(o)});log.event('close',{symbol,side,result:r.body,ts:Date.now()});return r.body;}
module.exports={open,close,mark};
if(require.main===module){const [cmd,...a]=process.argv.slice(2);
 (cmd==='close'?close(a[0],a[1]):cmd==='open'?open(a[0],a[1],+a[2],+a[3],+a[4],+a[5],{dry:a[6]==='dry'}):Promise.reject(Error('usage: open|close ...')))
 .then(x=>console.log(JSON.stringify(x,null,1))).catch(e=>{console.error('ERR',e.message);process.exit(1)});}
