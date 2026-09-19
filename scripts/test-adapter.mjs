// Exercises the exact browser wallet adapter against compiled contracts on a local EVM.
import assert from 'node:assert/strict';
import ganache from 'ganache';
import {JsonRpcProvider,ContractFactory,parseUnits} from 'ethers';
import {compile} from './compile.mjs';
import {Chain} from '../dist/chain.js';
const server=ganache.server({logging:{quiet:true},chain:{chainId:31337,hardfork:'shanghai'}});
await server.listen(0,'127.0.0.1');const url=`http://127.0.0.1:${server.address().port}`;
const read=new JsonRpcProvider(url,undefined,{cacheTimeout:-1});read.pollingInterval=20;
const signer=await read.getSigner(0),address=await signer.getAddress(),a=compile();
globalThis.window={ethereum:{request:({method,params})=>server.provider.request({method:method==='eth_requestAccounts'?'eth_accounts':method,params:params??[]})}};
let chain;
try{
 const deploy=async(n,args=[])=>{const c=await new ContractFactory(a[n].abi,a[n].bytecode,signer).deploy(...args);await c.waitForDeployment();return c;};
 const token=await deploy('MockUSDC'),factory=await deploy('LaunchpadFactory',[await token.getAddress(),address]);await(await token.mint(address,parseUnits('10000',6))).wait();
 chain=new Chain({chainId:31337,rpcUrl:url,factoryAddress:await factory.getAddress(),paymentTokenAddress:await token.getAddress()});
 await chain.connect();chain.provider.pollingInterval=20;assert.equal(chain.account,address);
 assert.deepEqual(await chain.load(),[]);
 const now=(await read.getBlock('latest')).timestamp;
 const launch=await chain.create({name:'Adapter Token',symbol:'APT',supply:1000000,rate:10,softCap:100,hardCap:200,minBuy:10,maxBuy:200,start:now+100,end:now+1000},()=>{});
 await chain.send(launch.id,'fund',null,()=>{});
 await server.provider.request({method:'evm_increaseTime',params:[101]});await server.provider.request({method:'evm_mine',params:[]});
 await chain.send(launch.id,'buy','200',()=>{});
 await chain.send(launch.id,'finalize',null,()=>{});
 await chain.send(launch.id,'claim',null,()=>{});
 await chain.send(launch.id,'withdraw',null,()=>{});
 const list=await chain.load();assert.equal(list.length,1);assert.equal(list[0].name,'Adapter Token');assert.equal(list[0].successful,true);assert.equal(list[0].claimed[address],true);assert.equal(list[0].withdrawn,true);assert.equal(list[0].allocations[address],2000);
 console.log('PASS exact frontend wallet adapter: connect → deploy → approve/fund → approve/buy → finalize → claim → withdraw → read back');
}finally{chain?.read.destroy();chain?.provider?.destroy();read.destroy();await server.close();}
