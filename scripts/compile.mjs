import fs from 'node:fs';
import path from 'node:path';
import solc from 'solc';
export function compile(){
 const sources=Object.fromEntries(fs.readdirSync('contracts/src').filter(f=>f.endsWith('.sol')).map(f=>[f,{content:fs.readFileSync(`contracts/src/${f}`,'utf8')}]));
 const input={language:'Solidity',sources,settings:{optimizer:{enabled:true,runs:200},evmVersion:'shanghai',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object']}}}};
 const output=JSON.parse(solc.compile(JSON.stringify(input),{import:p=>{try{return {contents:fs.readFileSync(path.join('node_modules',p),'utf8')}}catch{return {error:`Missing import ${p}`}}}}));
 const errors=(output.errors??[]).filter(e=>e.severity==='error'); if(errors.length)throw Error(errors.map(e=>e.formattedMessage).join('\n'));
 const artifacts={};for(const [f,cs]of Object.entries(output.contracts)){if(!sources[f])continue;for(const[n,c]of Object.entries(cs)){artifacts[n]={abi:c.abi,bytecode:`0x${c.evm.bytecode.object}`};if(c.evm.deployedBytecode.object.length/2>24576)throw Error(`${n} exceeds EIP-170 size`);}}
 return artifacts;
}
if(process.argv[1]?.endsWith('compile.mjs')){fs.mkdirSync('contracts/out',{recursive:true});fs.writeFileSync('contracts/out/artifacts.json',JSON.stringify(compile()));console.log('Solidity compiled: LaunchToken, TokenSale, LaunchpadFactory, MockUSDC');}
