// trades.jsonl event log + state.json (both local to this folder, never shared)
// cfg(): config.json with active markets = markets - removeMarkets + extraMarkets (looked up in `suggested`).
const fs=require('fs'),D=__dirname;
function cfg(){const C=JSON.parse(fs.readFileSync(D+'/config.json')),M={...C.markets},S=C.suggested||{};
 for(const s of C.removeMarkets||[])delete M[s];
 for(const x of C.extraMarkets||[]){const sym=typeof x==='string'?x:x.symbol,def=typeof x==='string'?S[x]:x;if(sym&&def&&def.src)M[sym]={src:def.src,id:def.id,crypto:def.crypto};}
 return {...C,markets:M};}
module.exports={event(type,d){fs.appendFileSync(D+'/trades.jsonl',JSON.stringify({type,...d})+'\n');},
 state(s){const f=D+'/state.json';if(s){fs.writeFileSync(f,JSON.stringify(s,null,1));return s}try{return JSON.parse(fs.readFileSync(f))}catch{return{}}},
 cfg};
