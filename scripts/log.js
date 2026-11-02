// trades.jsonl event log + state.json (both local to this folder, never shared)
const fs=require('fs'),D=__dirname;
module.exports={event(type,d){fs.appendFileSync(D+'/trades.jsonl',JSON.stringify({type,...d})+'\n');},
 state(s){const f=D+'/state.json';if(s){fs.writeFileSync(f,JSON.stringify(s,null,1));return s}try{return JSON.parse(fs.readFileSync(f))}catch{return{}}},
 cfg(){return JSON.parse(fs.readFileSync(D+'/config.json'))}};
