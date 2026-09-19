import fs from 'node:fs';
import {JsonRpcProvider,ContractFactory,parseUnits} from 'ethers';
import {compile} from './compile.mjs';
const url=process.env.RPC_URL||'http://127.0.0.1:8545';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(url).hostname))throw Error('This script is only for an unlocked local development chain. Use the Foundry keystore script for a testnet.');
const p=new JsonRpcProvider(url),network=await p.getNetwork();if(Number(network.chainId)!==31337)throw Error('Expected disposable local chain 31337.');
const signer=await p.getSigner(0),address=await signer.getAddress(),artifacts=compile();
async function deploy(name,args=[]){const c=await new ContractFactory(artifacts[name].abi,artifacts[name].bytecode,signer).deploy(...args);await c.waitForDeployment();return c;}
const payment=await deploy('MockUSDC');const factory=await deploy('LaunchpadFactory',[await payment.getAddress(),address]);
for(const account of await p.listAccounts())await (await payment.mint(await account.getAddress(),parseUnits('100000',6))).wait();
const config={chainId:31337,chainName:'Local development',rpcUrl:url,explorer:'http://localhost:8545',factoryAddress:await factory.getAddress(),paymentTokenAddress:await payment.getAddress()};
fs.writeFileSync('dist/config.js',`// Generated local deployment. Public addresses only.\nexport default ${JSON.stringify(config,null,2)};\n`);
console.log(JSON.stringify({factory:config.factoryAddress,paymentToken:config.paymentTokenAddress,treasury:address,chainId:31337},null,2));
console.log('Minted 100,000 mock USDC to local accounts. Frontend configured. No private keys written.');
