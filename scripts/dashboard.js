// node dashboard.js [--live]  -> prints {"changed":bool,"data":{...}} for the dashboard canvas DATA block.
// Reads only local files written by monitor.js (snapshot.json, state.json, trades.jsonl) + config.json. No key needed.
// --live also fetches season points (needs the key named by config.json keyEnv; never printed). "changed" compares to the last run
// (ignoring timestamps/marks) so the hourly routine only rewrites the canvas when something real changed.
const fs=require('fs'),crypto=require('crypto'),D=__dirname,{cfg,state}=require('./log');
const rd=(f,d)=>{try{return JSON.parse(fs.readFileSync(D+'/'+f))}catch{return d}};
const tz='America/New_York',fmt=ms=>ms?new Date(ms).toLocaleString('en-US',{timeZone:tz,month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})+' ET':'';
const r2=x=>+(+x||0).toFixed(2),nyDay=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:tz});
(async()=>{let C={};try{C=cfg()}catch{}const S=rd('snapshot.json',{}),st=state(),raw=S.history||[],openRaw=S.openFull||[];
 const closed=raw.filter(t=>t.status!=='open');
 const realized=closed.reduce((s,t)=>s+ +(t.pnlUsd||0),0),unreal=openRaw.reduce((s,p)=>s+ +(p.pnlUsd||0),0);
 const vol=raw.flatMap(t=>(t.actions||[]).map(x=>Math.abs(+(x.sizeDelta||0)))).reduce((a,b)=>a+b,0);
 const fees=raw.reduce((s,t)=>s+ +(t.totalFeesUsd||0),0);
 const ev=fs.existsSync(D+'/trades.jsonl')?fs.readFileSync(D+'/trades.jsonl','utf8').trim().split('\n').filter(Boolean).slice(-25).map(l=>{try{const e=JSON.parse(l);
  return {time:fmt(e.ts),what:e.type,detail:e.type==='open'?`${e.symbol} ${e.side} ${e.lev}x $${e.marginUsd} @${e.px} TP ${e.tp} SL ${e.sl}`:e.type==='closed'?`${e.asset} ${e.side} ${r2(e.pnl)>=0?'+':''}$${r2(e.pnl)}${e.reason?' ('+e.reason+')':''}`:e.type==='close'?`${e.symbol} ${e.side} manual close`:(e.why||'')}}catch{return null}}).filter(Boolean).reverse():[];
 let points=null;
 if(process.argv.includes('--live')&&require('./auth').hasKey()){try{const {api}=require('./auth');points=(await api('/mobile/points')).body?.seasonPoints??null;}catch{}}
 const data={updated:fmt(Date.now()),tier:C.tier||'',status:S.status||'not run yet',lastRun:(S.ts||st.lastRun)?fmt(Date.parse(S.ts||st.lastRun)):'',lastError:st.lastError||'',
  equity:r2(S.equity),startEquity:r2(st.startEquity),totalPnl:r2(S.pnl),dayPct:r2(S.dayPct),realizedPnl:r2(realized),unrealizedPnl:r2(unreal),
  volume:r2(vol),volToday:r2(S.volToday),volGoal:C.volGoal||0,fees:+fees.toFixed(3),points,tradesToday:S.tradesToday||0,lossStreak:S.lossStreak||0,
  limits:{maxSlots:C.maxSlots,maxTradesDay:C.maxTradesDay,dailyHaltPct:C.dailyHaltPct,killPct:C.killPct,maxLossStreak:C.maxLossStreak,lev:`${C.levMin}-${C.levMax}x`,tpPct:C.tpPct,slPct:C.slPct},
  markets:Object.keys(C.markets||{}),regime:S.regime||null,top:S.top||[],
  open:openRaw.map(p=>{const o=k=>+((p.tpslOrders||[]).find(x=>x.orderType===k)?.triggerPriceUsd||0);return {asset:p.asset,side:p.side,size:r2(p.sizeUsd),lev:+(+p.leverageX||0).toFixed(1),entry:+p.entryPrice,mark:+p.markPrice,tp:o('tp'),sl:o('sl'),pnl:r2(p.pnlUsd),pnlPct:r2(p.pnlPercent)}}),
  history:[...raw].sort((a,b)=>(b.openedAt||0)-(a.openedAt||0)).slice(0,30).map(t=>({time:fmt(t.openedAt*1000),asset:t.asset,side:t.side,status:t.status,size:r2(t.sizeUsd),entry:+t.entryPrice,pnl:r2(t.pnlUsd),closed:fmt((t.closedAt||0)*1000)})),
  events:ev};
 const key=JSON.stringify([data.status,data.open.map(p=>[p.asset,p.side,p.tp,p.sl]),data.history.map(h=>[h.asset,h.status,h.pnl]),data.events.length&&data.events[0],data.points,data.markets,Math.round(data.equity)]);
 const h=crypto.createHash('sha1').update(key).digest('hex'),prev=rd('dashboard.hash.json',{}).h;
 if(!process.argv.includes('--peek'))fs.writeFileSync(D+'/dashboard.hash.json',JSON.stringify({h}));
 console.log(JSON.stringify({changed:h!==prev,data}));
})().catch(e=>{console.log(JSON.stringify({error:e.message}));process.exit(1)});
