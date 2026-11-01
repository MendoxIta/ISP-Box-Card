import {mkdir,readFile,writeFile} from 'node:fs/promises';
const profiles=await readFile('src/provider-profiles.js','utf8');
const source=await readFile('src/isp-box-card.js','utf8');
const declaration="import { INTEGRATION_PROFILES, EXTRA_METRICS, resolveProviderConfig } from './provider-profiles.js';";
if(!source.includes(declaration))throw new Error('Provider import contract changed; update the bundle script.');
await mkdir('dist',{recursive:true});
await writeFile('dist/isp-box-card.js',profiles+'\n'+source.replace(declaration,''));
console.log('Built dist/isp-box-card.js (provider profiles + card, no runtime imports)');
