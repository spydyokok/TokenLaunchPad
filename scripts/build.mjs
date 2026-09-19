import fs from 'node:fs';
import {compile} from './compile.mjs';
fs.mkdirSync('dist/vendor',{recursive:true});fs.copyFileSync('node_modules/ethers/dist/ethers.min.js','dist/vendor/ethers.min.js');
fs.copyFileSync('node_modules/ethers/LICENSE.md','dist/vendor/ethers-LICENSE.md');
const artifacts=compile();
fs.writeFileSync('dist/abi.js',`// Generated from contracts/src by npm run build.\nexport default ${JSON.stringify(Object.fromEntries(Object.entries(artifacts).map(([k,v])=>[k,v.abi])))};\n`);
fs.mkdirSync('contracts/out',{recursive:true});fs.writeFileSync('contracts/out/artifacts.json',JSON.stringify(artifacts));
console.log('Static frontend + vendored ethers + compiler-generated ABIs ready.');
