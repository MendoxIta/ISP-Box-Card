import './providers.js';
import {PROVIDERS} from '../dist/isp-box-card.js';
let appearance={},layout='full';
const apply=()=>window.card.setConfig({...window.card.config,layout,appearance});
const sync=()=>{
 document.querySelector('#layout').value=layout;
 for(const input of document.querySelectorAll('[data-color]'))input.value=appearance.colors?.[input.dataset.color]||({accent:PROVIDERS[card.config.provider].color,background:'#090a0b',text:'#f5f5f5'}[input.dataset.color]);
 for(const input of document.querySelectorAll('[data-size]'))input.value=appearance[input.dataset.size]??'';
};
document.querySelector('#layout').addEventListener('change',event=>{layout=event.target.value;apply();});
document.querySelector('#appearance-controls').addEventListener('input',event=>{
 const input=event.target;
 if(input.dataset.color)appearance={...appearance,colors:{...appearance.colors,[input.dataset.color]:input.value}};
 else if(input.dataset.size){if(!input.checkValidity())return;appearance={...appearance};if(input.value==='')delete appearance[input.dataset.size];else appearance[input.dataset.size]=Number(input.value);}
 else return;
 apply();
});
document.querySelector('#provider').addEventListener('change',()=>{apply();sync();});
document.querySelector('#reset').addEventListener('click',()=>{appearance={};layout='full';apply();sync();});
sync();
