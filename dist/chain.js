import {BrowserProvider,JsonRpcProvider,Contract,parseUnits,formatUnits,isAddress} from './vendor/ethers.min.js';
import abi from './abi.js';
export const validAddress=a=>isAddress(a)&&!/^0x0{40}$/i.test(a);
export const units=(v,d)=>parseUnits(String(v),d);
const num=(v,d)=>Number(formatUnits(v,d));
export class Chain {
 constructor(config){this.config=config;this.read=new JsonRpcProvider(config.rpcUrl,undefined,{staticNetwork:false});this.account=null;this.provider=null;}
 async connect(){
  if(!window.ethereum)throw Error('Install MetaMask or use a wallet browser. Demo mode works without a wallet.');
  this.provider=new BrowserProvider(window.ethereum);await this.provider.send('eth_requestAccounts',[]);
  const network=await this.provider.getNetwork();if(Number(network.chainId)!==this.config.chainId){await window.ethereum.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x'+this.config.chainId.toString(16)}]});this.provider=new BrowserProvider(window.ethereum);}
  this.account=await (await this.provider.getSigner()).getAddress();return this.account;
 }
 async verifiedFactory(){
  if(!validAddress(this.config.factoryAddress))throw Error('No factory deployed yet. Open Setup to configure your deployment.');
  const n=await this.read.getNetwork();if(Number(n.chainId)!==this.config.chainId)throw Error('RPC network does not match the configured chain.');
  if(await this.read.getCode(this.config.factoryAddress)==='0x')throw Error('No contract at the factory address on this network.');
  const f=new Contract(this.config.factoryAddress,abi.LaunchpadFactory,this.read);
  this.payment=await f.paymentToken();if(this.config.paymentTokenAddress&&this.payment.toLowerCase()!==this.config.paymentTokenAddress.toLowerCase())throw Error('Payment token does not match the deployed factory.');
  const p=new Contract(this.payment,abi.MockUSDC,this.read);if(Number(await p.decimals())!==6)throw Error('Only standard 6-decimal payment tokens are supported.');
  this.paymentSymbol=await p.symbol();return f;
 }
 async load(){
  const f=await this.verifiedFactory();const count=Number(await f.saleCount());const addresses=[];
  for(let i=0;i<count;i+=50)addresses.push(...await f.getSales(i,50));
  const result=[];for(let i=0;i<addresses.length;i+=5)result.push(...await Promise.all(addresses.slice(i,i+5).map(a=>this.loadSale(a))));
  const block=await this.read.getBlock('latest');this.time=block.timestamp;
  this.balance=this.account?num(await new Contract(this.payment,abi.MockUSDC,this.read).balanceOf(this.account),6):0;
  return result.reverse();
 }
 async loadSale(id){
  const s=new Contract(id,abi.TokenSale,this.read);
  const [token,creator,c,funded,finalized,successful,withdrawn,raised,sold]=await Promise.all([s.token(),s.creator(),s.config(),s.funded(),s.finalized(),s.successful(),s.proceedsWithdrawn(),s.totalRaised(),s.totalSold()]);
  const t=new Contract(token,abi.LaunchToken,this.read);const [name,symbol,supply,balance]=await Promise.all([t.name(),t.symbol(),t.totalSupply(),t.balanceOf(id)]);
  const user=this.account;const contrib=user?await s.contributions(user):0n;const allocation=user?await s.purchasedTokens(user):0n;
  return {id,token,creator,name,symbol,supply:num(supply,18),rate:num(c.rate,18),softCap:num(c.softCap,6),hardCap:num(c.hardCap,6),minBuy:num(c.minBuy,6),maxBuy:num(c.maxBuy,6),start:Number(c.start),end:Number(c.end),funded,finalized,successful,withdrawn,raised:num(raised,6),sold:num(sold,18),tag:'On-chain',description:'Fixed-supply ERC20 presale. Confirm contract addresses and immutable sale terms before contributing.',contributions:{[user]:num(contrib,6)},allocations:{[user]:num(allocation,18)},claimed:{[user]:user?await s.claimed(user):false},refunded:{[user]:user?await s.refunded(user):false},tokenBalance:num(balance,18)};
 }
 async signer(){if(!this.account)await this.connect();const n=await this.provider.getNetwork();if(Number(n.chainId)!==this.config.chainId)throw Error('Wrong network. Reconnect your wallet.');return this.provider.getSigner();}
 async send(id,action,amount,notify){
  const signer=await this.signer();await this.verifiedFactory();const s=new Contract(id,abi.TokenSale,signer);
  if(action==='buy'||action==='fund'){
   const token=action==='buy'?this.payment:await s.token();const value=action==='buy'?units(amount,6):await s.inventoryRequired();const t=new Contract(token,abi.MockUSDC,signer);
   if(await t.balanceOf(this.account)<value)throw Error('Insufficient token balance.');
   if(await t.allowance(this.account,id)<value){notify('Approve the exact token amount in your wallet…');const approval=await t.approve(id,value);await approval.wait();}
  }
  notify('Confirm the transaction in your wallet…');
  const methods={buy:'buyTokens',fund:'depositSaleTokens',finalize:'finalizeSale',claim:'claimTokens',refund:'claimRefund',withdraw:'withdrawRaisedFunds',recover:'withdrawUnsoldTokens'};
  if(!methods[action])throw Error('Unknown transaction.');
  const tx=await s[methods[action]](...(action==='buy'?[units(amount,6)]:[]));notify('Transaction submitted. Waiting for confirmation…');await tx.wait();return tx.hash;
 }
 async create(x,notify){
  const signer=await this.signer();await this.verifiedFactory();
  const f=new Contract(this.config.factoryAddress,abi.LaunchpadFactory,signer);
  const c={rate:units(x.rate,18),softCap:units(x.softCap,6),hardCap:units(x.hardCap,6),minBuy:units(x.minBuy,6),maxBuy:units(x.maxBuy,6),start:x.start,end:x.end};
  notify('Confirm token and sale deployment in your wallet…');const tx=await f.createLaunch(x.name,x.symbol,units(x.supply,18),c);notify('Deploying both contracts…');const receipt=await tx.wait();
  for(const log of receipt.logs){try{const p=f.interface.parseLog(log);if(p?.name==='LaunchCreated')return {id:p.args.sale,hash:tx.hash};}catch{}}
  throw Error('Transaction confirmed, but launch event not found. Refresh Explore.');
 }
}
