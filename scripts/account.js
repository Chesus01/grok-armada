// node account.js -> compact JSON: wallet, cash, equity, open positions with TP/SL, points
const {api,pubkey}=require('./auth');
(async()=>{const w=pubkey();const [b,p,pt]=await Promise.all([api('/mobile/balances'),api('/positions?walletAddress='+w),api('/mobile/points')]);
 const cash=(b.body.profiles||[]).reduce((s,x)=>s+x.usdc/1e6,0),open=p.body.dataList||[];
 const eq=cash+open.reduce((s,x)=>s+ +x.collateralUsd+ +x.pnlUsd,0);
 console.log(JSON.stringify({wallet:w,cash:+cash.toFixed(2),equity:+eq.toFixed(2),points:pt.body?.seasonPoints??null,
  open:open.map(x=>({asset:x.asset,side:x.side,size:+(+x.sizeUsd).toFixed(2),entry:+x.entryPrice,pnl:+(+x.pnlUsd).toFixed(2),pnlPct:+(+x.pnlPercent).toFixed(2),
   tp:+((x.tpslOrders||[]).find(o=>o.orderType==='tp')?.triggerPriceUsd||0),sl:+((x.tpslOrders||[]).find(o=>o.orderType==='sl')?.triggerPriceUsd||0)}))},null,1));
})().catch(e=>{console.error('ERR',e.message);process.exit(1)});
