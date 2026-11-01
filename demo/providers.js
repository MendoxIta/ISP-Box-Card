import '../dist/isp-box-card.js';
import {providerFixture} from '../tests/provider-fixtures.mjs';
const card=document.querySelector('isp-box-card');window.card=card;
window.registryCalls=[];window.serviceCalls=[];
function select(provider){
 const fixture=providerFixture(provider);window.fixture=fixture;
 const config={type:'custom:isp-box-card',provider,model:{free:'Freebox · fixture',orange:'Livebox 6 · fixture',bouygues:'Bbox · fixture',sfr:'SFR NB6 · fixture'}[provider],auto_detect:true,hide_public_ip:false,show_missing:false,entities:provider==='bouygues'?fixture.entities:{}};
 const handlers={};const connection={handlers,subscribeEvents:async(callback,type)=>{(handlers[type]??=[]).push(callback);return()=>{handlers[type]=handlers[type].filter(cb=>cb!==callback);};}};
 const hass={states:fixture.states,config:{time_zone:'Europe/Paris'},connection,callWS:async request=>{window.registryCalls.push({provider,type:request.type});if(request.type==='config/entity_registry/list')return structuredClone(fixture.registry);if(request.type==='config/device_registry/list')return structuredClone(fixture.devices);throw Error('Unexpected registry command');},callService:async(...args)=>{window.serviceCalls.push(args);}};
 card.setConfig(config);card.hass=hass;window.fixtureHass=hass;
 document.querySelector('#status').textContent=provider==='bouygues'?'Association manuelle des six capteurs Bbox, aucun nom deviné.':'Détection par intégration, appareil et identifiants du registre ; noms d’entités volontairement renommés.';
}
document.querySelector('#provider').onchange=event=>select(event.target.value);
select('free');
