import assert from 'node:assert/strict';
import ganache from 'ganache';
import {BrowserProvider,ContractFactory,Contract,parseUnits} from 'ethers';
import {compile} from './compile.mjs';
const node=ganache.provider({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'},wallet:{totalAccounts:6}});
const p=new BrowserProvider(node,undefined,{cacheTimeout:-1});p.pollingInterval=20;
const [owner,buyer,other,treasury]=await Promise.all([0,1,2,3].map(i=>p.getSigner(i)));
const a=compile(),U=n=>parseUnits(String(n),6),T=n=>parseUnits(String(n),18);let passed=0;
const check=(label,fn)=>async()=>{await fn();passed++;console.log('PASS',label);};
async function deploy(name,args=[]){const c=await new ContractFactory(a[name].abi,a[name].bytecode,owner).deploy(...args);await c.waitForDeployment();return c;}
async function send(promise){return (await promise).wait();}
async function reject(fn){await assert.rejects(async()=>{const r=await fn();if(r?.wait)await r.wait();});}
async function time(){const b=await node.request({method:'eth_getBlockByNumber',params:['latest',false]});return Number(BigInt(b.timestamp));}
async function advance(seconds){await node.request({method:'evm_increaseTime',params:[seconds]});await node.request({method:'evm_mine',params:[]});}
const payment=await deploy('MockUSDC'),factory=await deploy('LaunchpadFactory',[await payment.getAddress(),await treasury.getAddress()]);
for(const who of [buyer,other]){await send(payment.mint(await who.getAddress(),U(10000)));}
async function sale(soft=100,hard=200,max=200){const start=await time()+100;const c={rate:T(10),softCap:U(soft),hardCap:U(hard),minBuy:U(10),maxBuy:U(max),start,end:start+1000};const r=await send(factory.createLaunch('Spydy Token','SPY',T(1000000),c));const ev=r.logs.map(l=>{try{return factory.interface.parseLog(l)}catch{return null}}).find(x=>x?.name==='LaunchCreated');return {sale:new Contract(ev.args.sale,a.TokenSale.abi,owner),token:new Contract(ev.args.token,a.LaunchToken.abi,owner),c};}
try{
 let x=await sale();const id=await x.sale.getAddress();
 await check('factory deploys immutable fixed-supply token and paginated registry',async()=>{assert.equal(await factory.saleCount(),1n);assert.equal((await factory.getSales(0,50))[0],id);assert.equal((await factory.getSales(100,50)).length,0);await reject(()=>factory.getSales(0,51));assert.equal(await x.token.totalSupply(),T(1000000));})();
 await check('purchase before funding and before start rejected',async()=>{await send(payment.connect(buyer).approve(id,U(10000)));await reject(()=>x.sale.connect(buyer).buyTokens(U(100)));await send(x.token.approve(id,await x.sale.inventoryRequired()));await send(x.sale.depositSaleTokens());await reject(()=>x.sale.depositSaleTokens());await reject(()=>x.sale.connect(buyer).buyTokens(U(100)));await reject(()=>x.sale.finalizeSale());})();
 await advance(101);
 await check('exact USDC-to-token conversion and allowance transfer',async()=>{await send(x.sale.connect(buyer).buyTokens(U(100)));assert.equal(await x.sale.totalRaised(),U(100));assert.equal(await x.sale.purchasedTokens(await buyer.getAddress()),T(1000));assert.equal(await x.token.balanceOf(await buyer.getAddress()),0n);})();
 await check('minimum, cumulative wallet cap, hard cap and authorization enforced',async()=>{await reject(()=>x.sale.connect(buyer).buyTokens(U(1)));await reject(()=>x.sale.connect(buyer).buyTokens(U(101)));await reject(()=>x.sale.connect(other).withdrawRaisedFunds());await reject(()=>x.sale.withdrawRaisedFunds());await reject(()=>x.sale.withdrawUnsoldTokens());await reject(()=>x.sale.connect(buyer).claimTokens());})();
 await advance(1001);await send(x.sale.finalizeSale());
 await check('successful finalization; unsold withdrawal preserves buyer reserve',async()=>{assert.equal(await x.sale.successful(),true);await send(x.sale.withdrawUnsoldTokens());assert.equal(await x.token.balanceOf(id),T(1000));await reject(()=>x.sale.withdrawUnsoldTokens());await reject(()=>x.sale.finalizeSale());})();
 await check('successful buyer claims once; refunds are forbidden',async()=>{await send(x.sale.connect(buyer).claimTokens());assert.equal(await x.token.balanceOf(await buyer.getAddress()),T(1000));await reject(()=>x.sale.connect(buyer).claimTokens());await reject(()=>x.sale.connect(buyer).claimRefund());})();
 await check('2% fee and creator withdrawal occur exactly once',async()=>{await send(x.sale.withdrawRaisedFunds());assert.equal(await payment.balanceOf(await treasury.getAddress()),U(2));assert.equal(await payment.balanceOf(await owner.getAddress()),U(98));await reject(()=>x.sale.withdrawRaisedFunds());})();
 x=await sale(150,200);const failId=await x.sale.getAddress();await send(x.token.approve(failId,await x.sale.inventoryRequired()));await send(x.sale.depositSaleTokens());await send(payment.connect(buyer).approve(failId,U(100)));await advance(101);await send(x.sale.connect(buyer).buyTokens(U(100)));await advance(1001);await send(x.sale.finalizeSale());
 await check('failure refunds full contribution; no claim or creator payment',async()=>{assert.equal(await x.sale.successful(),false);await reject(()=>x.sale.withdrawRaisedFunds());await reject(()=>x.sale.connect(buyer).claimTokens());const before=await payment.balanceOf(await buyer.getAddress());await send(x.sale.connect(buyer).claimRefund());assert.equal(await payment.balanceOf(await buyer.getAddress()),before+U(100));await reject(()=>x.sale.connect(buyer).claimRefund());await send(x.sale.withdrawUnsoldTokens());assert.equal(await x.token.balanceOf(failId),0n);})();
 x=await sale(100,200,100);const capId=await x.sale.getAddress();await send(x.token.approve(capId,await x.sale.inventoryRequired()));await send(x.sale.depositSaleTokens());for(const who of [buyer,other])await send(payment.connect(who).approve(capId,U(1000)));await advance(101);await send(x.sale.connect(buyer).buyTokens(U(100)));
 await check('wallet cap is cumulative across purchases',async()=>{await reject(()=>x.sale.connect(buyer).buyTokens(U(10)));})();
 await send(x.sale.connect(other).buyTokens(U(100)));
 await check('hard cap permits early permissionless finalization',async()=>{await reject(()=>x.sale.connect(other).buyTokens(U(10)));await send(x.sale.connect(other).finalizeSale());assert.equal(await x.sale.successful(),true);})();
 await check('reject invalid sale configuration and insufficient supply',async()=>{await reject(()=>factory.createLaunch('','SPY',T(1000000),x.c));const c={...x.c,start:await time()+100,end:await time()+1100};await reject(()=>factory.createLaunch('Tiny','TNY',T(1),c));await reject(()=>factory.createLaunch('Bad','BAD',T(1000000),{...c,softCap:0}));})();
 x=await sale();await advance(1102);await send(x.sale.finalizeSale());await check('unfunded sales finalize as failed and cannot be funded late',async()=>{assert.equal(await x.sale.successful(),false);await reject(()=>x.sale.depositSaleTokens());})();
 console.log(`\n${passed} EVM integration scenarios passed (actual compiled Solidity).`);
}finally{await node.disconnect();}
