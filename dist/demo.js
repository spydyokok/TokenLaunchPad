// Device-local simulation only. Never used by the on-chain adapter.
export const DEMO_USER='0xDe00000000000000000000000000000000000001';
const creator='0xCa00000000000000000000000000000000000002';
const round=n=>Math.round(n*1e6)/1e6;
export function seed(now=Math.floor(Date.now()/1000)){
 const base={supply:1000000,rate:10,minBuy:10,maxBuy:5000,softCap:10000,hardCap:40000,start:now-86400,end:now+3*86400,funded:true,finalized:false,successful:false,withdrawn:false,recovered:false,creator,contributions:{},allocations:{},claimed:{},refunded:{}};
 return {version:1,clock:now,balance:10000,tokens:{},activity:[],sales:[
 {...base,id:'demo-nova',name:'Nova Protocol',symbol:'NOVA',tag:'Infrastructure',raised:24600,sold:246000,description:'A sample presale for decentralized infrastructure. Explore the complete purchase and settlement flow.'},
 {...base,id:'demo-orbit',name:'Orbit Network',symbol:'ORB',tag:'Ecosystem',rate:25,hardCap:20000,softCap:5000,raised:7800,sold:195000,end:now+6*86400,description:'A sample community network launch. All displayed funds are simulated.'},
 {...base,id:'demo-lumen',name:'Lumen Finance',symbol:'LUM',tag:'DeFi',creator:DEMO_USER,raised:12000,sold:120000,end:now-3600,contributions:{[DEMO_USER]:100},allocations:{[DEMO_USER]:1000},description:'A completed demo sale ready to finalize. Try claiming tokens and withdrawing creator proceeds.'},
 {...base,id:'demo-echo',name:'Echo Labs',symbol:'ECHO',tag:'Research',raised:3400,sold:34000,end:now-3600,finalized:true,successful:false,contributions:{[DEMO_USER]:100},allocations:{[DEMO_USER]:1000},description:'This sample missed its soft cap. Claim your simulated 100 USDC refund.'}
 ]};
}
export function status(s,now){if(s.finalized)return s.successful?'Successful':'Failed';if(now>=s.end||s.raised>=s.hardCap)return 'Awaiting finalization';if(!s.funded)return 'Needs funding';return now<s.start?'Upcoming':'Live';}
export function transact(state,id,action,amount){
 const d=structuredClone(state),s=d.sales.find(x=>x.id===id);if(!s)throw Error('Launch not found.');
 const owner=s.creator.toLowerCase()===DEMO_USER.toLowerCase();
 if(action==='buy'){
  const n=Number(amount);if(status(s,d.clock)!=='Live')throw Error('This sale is not open.');
  if(!Number.isFinite(n)||n<=0||Math.abs(round(n)-n)>1e-9)throw Error('Use a positive USDC amount with up to 6 decimals.');
  if(n<s.minBuy||round((s.contributions[DEMO_USER]||0)+n)>s.maxBuy)throw Error('Amount is outside the wallet purchase limits.');
  if(round(s.raised+n)>s.hardCap)throw Error('Amount exceeds the remaining hard cap.');
  if(n>d.balance)throw Error('Not enough demo USDC.');
  d.balance=round(d.balance-n);s.raised=round(s.raised+n);s.sold=round(s.sold+n*s.rate);s.contributions[DEMO_USER]=round((s.contributions[DEMO_USER]||0)+n);s.allocations[DEMO_USER]=round((s.allocations[DEMO_USER]||0)+n*s.rate);
 } else if(action==='finalize'){
  if(s.finalized||(d.clock<s.end&&s.raised<s.hardCap))throw Error('Finalize after the deadline or when the hard cap is reached.');
  s.finalized=true;s.successful=s.funded&&s.raised>=s.softCap;
 } else if(action==='claim'){
  if(!s.finalized||!s.successful||s.claimed[DEMO_USER]||!s.allocations[DEMO_USER])throw Error('No tokens available to claim.');
  s.claimed[DEMO_USER]=true;d.tokens[s.symbol]=round((d.tokens[s.symbol]||0)+s.allocations[DEMO_USER]);
 } else if(action==='refund'){
  if(!s.finalized||s.successful||s.refunded[DEMO_USER]||!s.contributions[DEMO_USER])throw Error('No refund available.');
  s.refunded[DEMO_USER]=true;d.balance=round(d.balance+s.contributions[DEMO_USER]);
 } else if(action==='withdraw'){
  if(!owner||!s.finalized||!s.successful||s.withdrawn)throw Error('Creator withdrawal is not available.');
  s.withdrawn=true;d.balance=round(d.balance+s.raised*.98);
 } else if(action==='recover'){
  if(!owner||!s.finalized||s.recovered||!s.funded)throw Error('No unsold tokens available.');
  const unsold=s.rate*s.hardCap-(s.successful?s.sold:0);if(unsold<=0)throw Error('There are no unsold tokens.');
  s.recovered=true;d.tokens[s.symbol]=round((d.tokens[s.symbol]||0)+unsold);
 } else if(action==='fund'){
  if(!owner||s.funded||d.clock>=s.start)throw Error('Fund before the sale starts.');
  s.funded=true;d.tokens[s.symbol]=round((d.tokens[s.symbol]||0)-s.hardCap*s.rate);
 } else throw Error('Unknown action.');
 d.activity.unshift({action,symbol:s.symbol,time:d.clock,amount:amount??null});return d;
}
export function createDemo(state,input){
 const d=structuredClone(state);validateLaunch(input,d.clock);
 const id='demo-'+crypto.randomUUID();const sale={...input,id,creator:DEMO_USER,tag:'Community',raised:0,sold:0,funded:false,finalized:false,successful:false,withdrawn:false,recovered:false,contributions:{},allocations:{},claimed:{},refunded:{}};
 d.sales.unshift(sale);d.tokens[input.symbol]=(d.tokens[input.symbol]||0)+input.supply;d.activity.unshift({action:'create',symbol:input.symbol,time:d.clock});return {state:d,id};
}
export function validateLaunch(x,now){
 if(!x.name?.trim()||x.name.length>48||!(/^[A-Z0-9]{1,10}$/).test(x.symbol))throw Error('Use a name and a 1–10 character uppercase symbol.');
 for(const k of ['supply','rate','softCap','hardCap','minBuy','maxBuy'])if(!Number.isFinite(x[k])||x[k]<=0||x[k]>1e9)throw Error('All numeric fields must be between 0 and 1 billion.');
 for(const k of ['softCap','hardCap','minBuy','maxBuy'])if(Math.abs(round(x[k])-x[k])>1e-9)throw Error('USDC values support up to 6 decimals.');
 if(x.softCap>x.hardCap||x.maxBuy>x.hardCap||x.minBuy>x.maxBuy)throw Error('Check caps and wallet limits.');
 if(x.rate*x.hardCap>x.supply)throw Error('Total supply must cover all tokens available at the hard cap.');
 if(!Number.isFinite(x.start)||!Number.isFinite(x.end)||x.start<=now+60||x.end<=x.start)throw Error('Start at least 1 minute from now; end must be after start.');
}
