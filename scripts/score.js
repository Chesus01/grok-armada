// Scores config.markets from public 1h/4h candles: k=Kraken pair, y=Yahoo ticker, i=Imperial mark price sampled hourly (pre-IPO; needs ~30h warm-up). score in [-1,1].
const fs=require('fs'),{markets}=require('./auth'),{cfg}=require('./log');
const ema=(a,n)=>{const k=2/(n+1);let e=a[0];for(const x of a)e=x*k+e*(1-k);return e};
const rsi=(a,n=14)=>{let g=0,l=0;for(let i=a.length-n;i<a.length;i++){const d=a[i]-a[i-1];d>0?g+=d:l-=d}return l?100-100/(1+g/l):100};
const atr=(c,n=14)=>{let s=0;for(let i=c.length-n;i<c.length;i++)s+=Math.max(c[i].h-c[i].l,Math.abs(c[i].h-c[i-1].c),Math.abs(c[i].l-c[i-1].c));return s/n};
const T=Math.tanh,cl=x=>Math.max(-1,Math.min(1,x));
const grp=(h,n)=>{const o=[];for(let i=0;i<h.length;i+=n){const g=h.slice(i,i+n);o.push({t:g[0].t,o:g[0].o,h:Math.max(...g.map(x=>x.h)),l:Math.min(...g.map(x=>x.l)),c:g.at(-1).c,v:g.reduce((s,x)=>s+x.v,0)})}return o};
async function kraken(p,iv){const j=await (await fetch(`https://api.kraken.com/0/public/OHLC?pair=${p}&interval=${iv}`)).json();if(j.error?.length)throw Error(j.error[0]);return Object.values(j.result).find(Array.isArray).map(r=>({t:r[0],o:+r[1],h:+r[2],l:+r[3],c:+r[4],v:+r[6]}));}
async function yahoo(s){const j=await (await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(s)}?interval=1h&range=60d`,{headers:{'user-agent':'Mozilla/5.0'}})).json();const r=j.chart.result?.[0];if(!r)throw Error('no yahoo data');const q=r.indicators.quote[0];
 const h=r.timestamp.map((t,i)=>({t,o:q.open[i],h:q.high[i],l:q.low[i],c:q.close[i],v:q.volume[i]||0})).filter(x=>x.c!=null);return [h,grp(h,4)];}
const SF=__dirname+'/samples.json';
async function sample(syms){if(!syms.length)return;let s={};try{s=JSON.parse(fs.readFileSync(SF))}catch{}const m=await markets(),t=Math.floor(Date.now()/1000);
 for(const y of syms){const x=m.find(z=>z.symbol===y);if(!x)continue;const a=s[y]=s[y]||[];if(!a.length||t-a.at(-1)[0]>=3000)a.push([t,x.markPrice]);if(a.length>400)a.shift();}fs.writeFileSync(SF,JSON.stringify(s));return s;}
function internal(s,y){const a=(s||{})[y]||[];if(a.length<30)throw Error(`warming up ${a.length}/30 samples`);
 const h=a.map((p,i)=>{const pr=i?a[i-1][1]:p[1];return {t:p[0],o:pr,h:Math.max(pr,p[1]),l:Math.min(pr,p[1]),c:p[1],v:1}});return [h,grp(h,4)];}
function tf(c){const cs=c.map(x=>x.c),last=cs.at(-1),a=atr(c)||last*1e-4,e20=ema(cs.slice(-120),20),e50=ema(cs.slice(-200),50);
 const trend=cl(0.6*T((e20-e50)/a/2)+0.4*T((last-e20)/a)),r=rsi(cs),ret=(last-cs.at(-7))/a,mom=cl(0.5*(r-50)/25+0.5*T(ret/3));
 const vr=c.slice(-6).reduce((s,x)=>s+x.v,0)/6/(c.slice(-54,-6).reduce((s,x)=>s+x.v,0)/48||1),flow=cl(T(ret/2)*Math.min(vr,2)/2);
 return {last,rsi:+r.toFixed(1),atrPct:+(a/last*100).toFixed(2),trend,mom,flow,age:Date.now()/1000-c.at(-1).t};}
async function scoreAll(){const M=cfg().markets,syms=Object.keys(M);const S=await sample(syms.filter(s=>M[s].src==='i'));const out=[];
 for(const s of syms){const {src,id,crypto}=M[s];try{let h1,h4;if(src==='k')[h1,h4]=await Promise.all([kraken(id,60),kraken(id,240)]);else if(src==='y')[h1,h4]=await yahoo(id);else [h1,h4]=internal(S,s);
  const a=tf(h1),b=tf(h4),score=+cl(0.45*(0.4*a.trend+0.6*b.trend)+0.35*(0.5*a.mom+0.5*b.mom)+0.20*(0.6*a.flow+0.4*b.flow)).toFixed(3);
  out.push({symbol:s,crypto:!!crypto,score,dir:score>0?'long':'short',price:a.last,rsi1h:a.rsi,rsi4h:b.rsi,atr1hPct:a.atrPct,trend:+(0.4*a.trend+0.6*b.trend).toFixed(2),stale:a.age>2*3600});}catch(e){out.push({symbol:s,error:e.message})}}
 const ok=out.filter(x=>!x.error),btc=ok.find(x=>x.symbol==='BTC');
 return {ts:new Date().toISOString(),regime:{breadthUp:ok.filter(x=>x.trend>0).length,breadthTotal:ok.length,btcTrend:btc?(btc.trend>0.15?'up':btc.trend<-0.15?'down':'flat'):'unknown'},scores:out.sort((a,b)=>Math.abs(b.score||0)-Math.abs(a.score||0))};}
module.exports={scoreAll};
if(require.main===module)scoreAll().then(r=>{console.log(JSON.stringify(r.regime));for(const x of r.scores)console.log(x.error?x.symbol+' ERR '+x.error:`${x.symbol.padEnd(9)} ${String(x.score).padStart(6)} ${x.dir.padEnd(5)} rsi1h ${x.rsi1h}${x.stale?' STALE':''}`)});
