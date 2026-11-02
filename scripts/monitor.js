// Hourly monitor + auto-trader. node monitor.js [--dry]  (--dry: evaluate only, place/modify nothing)
// Prints one JSON line; "event":true means something happened worth telling the owner. Create a file named STOP here to pause new trades.
const {api,pubkey,markets}=require('./auth'),log=require('./log'),fs=require('fs'),{scoreAll}=require('./score'),{close,open:openTrade}=require('./trade');
const DRY=process.argv.includes('--dry'),C=log.cfg();
const nyDay=(t=Date.now())=>new Date(t).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
const nyHour=()=>+new Date().toLocaleString('en-US',{timeZone:'America/New_York',hour:'2-digit',hour12:false});
const isC=s=>!!C.markets[s]?.crypto;
(async()=>{const w=pubkey(),now=Date.now(),day=nyDay(),st=log.state(),alerts=[],events=[];st.lastRun=new Date(now).toISOString();
 try{
 const [pos,tr,bal,mk]=await Promise.all([api('/positions?walletAddress='+w),api('/trades?walletAddress='+w+'&limit=200'),api('/mobile/balances'),markets()]);
 const open=pos.body.dataList||[],all=tr.body.dataList||[],cash=(bal.body.profiles||[]).reduce((s,p)=>s+p.usdc/1e6,0);
 const coll=open.reduce((s,p)=>s+ +p.collateralUsd,0),equity=cash+coll+open.reduce((s,p)=>s+ +p.pnlUsd,0);
 if(!st.startEquity)st.startEquity=equity;
 const closed=all.filter(t=>t.status!=='open').sort((a,b)=>(a.closedAt||0)-(b.closedAt||0));
 const volToday=all.flatMap(t=>(t.actions||[]).map(x=>({ts:(x.tx1Timestamp||t.openedAt)*1000,usd:Math.abs(+(x.sizeDelta||0))}))).filter(x=>nyDay(x.ts)===day).reduce((s,x)=>s+x.usd,0);
 if(st.day!==day){st.day=day;st.dayStartEquity=equity;st.halted=false;st.tradesToday=0;}
 const dayPct=(equity/st.dayStartEquity-1)*100;
 let lossStreak=0;for(let i=closed.length-1;i>=0&&+closed[i].pnlUsd<0;i--)lossStreak++;
 st.seen=st.seen||[];st.cool=st.cool||{};const first=!st.seen.length&&!st.init;st.init=1;
 for(const t of closed)if(!st.seen.includes(t.id)){st.seen.push(t.id);if(first)continue;log.event('closed',{ts:now,asset:t.asset,side:t.side,pnl:t.pnlUsd});events.push(`closed ${t.asset} ${t.side} pnl ${(+t.pnlUsd).toFixed(2)}`);if(+t.pnlUsd<0)st.cool[t.asset]=now+C.cooldownH*3600e3;}
 st.seen=st.seen.slice(-300);
 // breakeven stop
 st.be=st.be||{};for(const p of open){const sl=(p.tpslOrders||[]).find(o=>o.orderType==='sl');if(!sl)alerts.push(`${p.asset} has no SL`);
  if(+p.pnlPercent>=C.breakevenPct&&sl&&!st.be[p.id]){const e=+p.entryPrice,px=p.side==='long'?e*1.001:e*0.999;if(DRY){alerts.push(`[dry] would move ${p.asset} SL to breakeven`);continue;}
   const r=await api('/mobile/orders/update',{method:'POST',body:JSON.stringify({wallet:w,orderPda:sl.orderPda,profileIndex:p.profileIndex,triggerPrice:Math.round(px*1e9)})});
   if(r.body?.success){st.be[p.id]=px;events.push(`${p.asset} stop moved to breakeven`);}else alerts.push(`breakeven update failed ${p.asset}`);}}
 // safety: kill switch + daily halt (close everything)
 const closeAll=async why=>{events.push(why);if(DRY)return;for(const p of open)await close(p.asset,p.side);log.event('halt',{ts:now,why,equity,dayPct});};
 if(!st.killed&&(equity<=st.startEquity*(1-C.killPct/100)||lossStreak>=C.maxLossStreak)){await closeAll(`KILL SWITCH equity ${equity.toFixed(2)} lossStreak ${lossStreak}`);if(!DRY)st.killed=true;}
 if(!st.halted&&dayPct<=C.dailyHaltPct){await closeAll(`DAILY HALT ${dayPct.toFixed(2)}%`);if(!DRY)st.halted=true;}
 const status=st.killed?'killed':fs.existsSync(__dirname+'/STOP')?'stopped (STOP file)':st.halted?'halted (daily)':'running';
 // candidates
 const sc=await scoreAll(),M=Object.fromEntries(mk.map(m=>[m.symbol,m])),openSyms=new Set(open.map(p=>p.asset)),cands=[],placed=[];
 const sameDir=(list,d)=>list.filter(p=>isC(p.asset||p.symbol)&&(p.side||p.dir)===d).length;
 for(const s of sc.scores){if(s.error)continue;const why=[],a=Math.abs(s.score);
  if(a<C.minScore)why.push('weak score');if(s.dir==='long'&&s.rsi1h>C.rsiMax||s.dir==='short'&&s.rsi1h<100-C.rsiMax)why.push('chasing (rsi)');
  if(s.stale)why.push('market closed/stale');if(openSyms.has(s.symbol))why.push('already open');if(!M[s.symbol]||M[s.symbol].reduceOnly)why.push('not tradable');
  if((st.cool[s.symbol]||0)>now)why.push('cooldown after stop');
  if(s.crypto&&sameDir(open,s.dir)>=C.maxSameDirCrypto&&a<C.strongScore)why.push('correlation cap');
  cands.push({symbol:s.symbol,score:s.score,dir:s.dir,atr:s.atr1hPct,pass:!why.length,why:why.join(', '),rank:a+0.04*Math.min(s.atr1hPct||0,2)});}
 cands.sort((a,b)=>b.rank-a.rank);
 // stale rotation: close the flattest old position if a strong replacement exists
 const ageH=p=>(now/1000-p.openedAt)/3600;let live=open;
 const stale=open.map(p=>({p,h:ageH(p),pct:+p.pnlPercent})).filter(x=>(x.h>=C.staleH1&&Math.abs(x.pct)<=C.stalePct1)||(x.h>=C.staleH2&&Math.abs(x.pct)<=C.stalePct2))
  .filter(x=>{const o=sc.scores.find(z=>z.symbol===x.p.asset);const own=o&&!o.error?(x.p.side==='long'?o.score:-o.score):0;return own<C.rotScore;}).sort((a,b)=>Math.abs(a.pct)-Math.abs(b.pct));
 if(stale.length&&open.length>=C.maxSlots&&status==='running'&&(st.tradesToday||0)<C.maxTradesDay){const x=stale[0];
  const rc=cands.find(c=>c.pass&&Math.abs(c.score)>=C.rotScore&&c.symbol!==x.p.asset);
  if(rc){if(DRY)events.push(`[dry] would rotate ${x.p.asset} -> ${rc.symbol}`);else{const r=await close(x.p.asset,x.p.side);
   if(r&&!r.error&&r.submissionOutcome!=='rejected'){st.seen.push(x.p.id);live=open.filter(p=>p.id!==x.p.id);rc.rotation=true;log.event('closed',{ts:now,asset:x.p.asset,side:x.p.side,pnl:x.p.pnlUsd,reason:'stale_rotation'});events.push(`rotated out of stale ${x.p.asset} ${x.p.side} pnl ${(+x.p.pnlUsd).toFixed(2)}`);}
   else alerts.push(`rotation close failed ${x.p.asset}`);}}}
 // open new trades
 const slots=C.maxSlots-live.length,passing=cands.filter(c=>c.pass);if(rc_first(passing))0;
 const blockers=[];if(status!=='running')blockers.push(status);if((st.tradesToday||0)>=C.maxTradesDay)blockers.push('max trades/day');if(slots<=0)blockers.push('no free slot');
 let marginLeft=equity*C.maxMarginPct/100-live.reduce((a,p)=>a+ +p.collateralUsd,0);
 const topup=C.volGoal>0&&nyHour()>=C.topupHourET&&volToday<C.volGoal;
 if(!blockers.length)for(const c of passing.slice(0,slots)){const a=Math.abs(c.score);
  const m=a>=C.strongScore?C.strongMargin:topup?C.topupMargin:C.margin;if(m>marginLeft||m>cash-1){c.why='margin cap';break;}
  let lev=C.levMin+Math.round((C.levMax-C.levMin)*Math.min(1,Math.max(0,(a-C.minScore)/(C.strongScore-C.minScore))));
  while(lev>C.levMin&&C.slPct/lev<c.atr)lev--;lev=Math.min(lev,Math.floor(M[c.symbol].maxLeverage));
  if(DRY){placed.push({symbol:c.symbol,dir:c.dir,lev,margin:m,dry:true});marginLeft-=m;continue;}
  const r=await openTrade(c.symbol,c.dir,m,lev,C.tpPct,C.slPct);const ok=r.result?.entry?.success&&r.result.closeOrders.every(x=>x.success);
  if(r.result?.entry?.success){st.tradesToday=(st.tradesToday||0)+1;marginLeft-=m;placed.push({symbol:c.symbol,dir:c.dir,lev,margin:m,entry:r.px,tp:r.tp,sl:r.sl});events.push(`opened ${c.symbol} ${c.dir} ${lev}x $${m} @${r.px} TP ${r.tp} SL ${r.sl}`);if(!ok)alerts.push(`${c.symbol} TP/SL leg failed!`);}
  else alerts.push(`${c.symbol} open refused: ${JSON.stringify(r.preflight||r.result).slice(0,150)}`);}
 st.lastError=null;if(!DRY)log.state(st);
 const out={ts:st.lastRun,dry:DRY,tier:C.tier,status,equity:+equity.toFixed(2),pnl:+(equity-st.startEquity).toFixed(2),dayPct:+dayPct.toFixed(2),volToday:Math.round(volToday),lossStreak,tradesToday:st.tradesToday||0,regime:sc.regime,
  open:open.map(p=>`${p.asset} ${p.side} ${(+p.pnlPercent).toFixed(2)}%`),top:cands.slice(0,6).map(c=>`${c.symbol} ${c.score} ${c.dir}${c.pass?' PASS':' ('+c.why+')'}`),placed,blockers,events,alerts,
  event:events.length>0||alerts.some(a=>!a.startsWith('[dry]'))};
 if(!DRY)fs.writeFileSync(__dirname+'/snapshot.json',JSON.stringify({...out,openFull:open,history:all.slice(0,100)},null,1));
 console.log(JSON.stringify(out));
 }catch(e){st.lastError=new Date().toISOString()+' '+e.message;if(!DRY)log.state(st);console.log(JSON.stringify({error:e.message,event:true}));}
})();
function rc_first(p){const i=p.findIndex(c=>c.rotation);if(i>0)p.unshift(...p.splice(i,1));}
