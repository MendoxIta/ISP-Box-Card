import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.HTMLElement=class {};
globalThis.customElements={get:()=>true};
globalThis.window={};
const {rateMbps,connectionState,validateConfig,PROVIDERS,IspBoxCard,startupMilliseconds,durationLabel}=await import('../dist/isp-box-card.js');
test('Freebox byte rates are converted to bits, preserving unit case',()=>{
 assert.equal(rateMbps('275000','kB/s'),2200);
 assert.equal(rateMbps('275000','KB/s'),2200);
 assert.equal(rateMbps('2200','Mbit/s'),2200);
 assert.equal(rateMbps('2.2','Gbit/s'),2200);
 assert.equal(rateMbps('1000','kbit/s'),1);
 assert.equal(rateMbps('1000','B/s'),.008);
});
test('Missing, unsupported or invalid rates remain unknown',()=>{
 for(const value of ['unknown','unavailable','',null,undefined,'NaN',Infinity,-1]) assert.equal(rateMbps(value,'Mbit/s'),null);
 assert.equal(rateMbps(2,'unexpected'),null);assert.equal(rateMbps(0,'Mbit/s'),0);
});
test('Connection is never inferred from arbitrary values',()=>{
 assert.equal(connectionState('on'),'online');assert.equal(connectionState('down'),'offline');
 for(const value of ['unavailable','unknown','123',undefined]) assert.equal(connectionState(value),'unknown');
});
test('All four operators share one validated configuration',()=>{
 for(const provider of Object.keys(PROVIDERS)) assert.equal(validateConfig({provider}).provider,provider);
});
test('Trust boundaries reject invalid actions, image URLs and scales',()=>{
 for(const config of [{provider:'other'},{provider:'__proto__'},{provider:'free',entities:{wifi:'sensor.any'}},{provider:'free',entities:{reboot:'switch.any'}},{provider:'free',image:'https://example.com/image.jpg'},{provider:'free',image:'//example.com/image'},{provider:'free',download_max:0},{provider:'free',entities:{secret:'sensor.any'}},{provider:'free',ports:[{}]}]) assert.throws(()=>validateConfig(config));
});
test('Configuration is copied, not mutated by caller',()=>{
 const config={provider:'free',entities:{wifi:'switch.any'}};const result=validateConfig(config);config.entities.wifi='switch.other';assert.equal(result.entities.wifi,'switch.any');
});
test('Freebox tracker attributes supply masked IP and timezone-safe startup text',()=>{
 const card=Object.create(IspBoxCard.prototype);
 card.config=validateConfig({provider:'free',entities:{public_ip:'device_tracker.box',uptime:'device_tracker.box'},attributes:{public_ip:'IPv4',uptime:'uptime'}});
 card._hass={states:{'device_tracker.box':{state:'home',attributes:{IPv4:'203.0.113.42',uptime:'2026-09-17T14:06:18'}}}};
 assert.equal(card.entity('public_ip').state,'203.0.113.42');
 assert.equal(card.text('uptime'),'Depuis le 17/09/2026 à 14:06');
 delete card._hass.states['device_tracker.box'].attributes.IPv4;
 assert.equal(card.text('public_ip'),'Indisponible');
 card._hass.states['device_tracker.box'].state='unavailable';
 assert.equal(card.text('uptime'),'Indisponible');
});
test('Startup dates use the HA zone, not the browser zone, across daylight saving',()=>{
 assert.equal(startupMilliseconds('2026-09-17T14:06:18','Europe/Paris'),Date.parse('2026-09-17T12:06:18Z'));
 assert.equal(startupMilliseconds('2026-11-01T14:06:18','Europe/Paris'),Date.parse('2026-11-01T13:06:18Z'));
 assert.equal(startupMilliseconds('2026-03-29T02:30:00','Europe/Paris'),null);
 assert.equal(startupMilliseconds('2026-09-17T14:06:18',undefined),null);
 assert.equal(startupMilliseconds('2026-09-17T14:06:18','not-a-zone'),null);
 assert.equal(startupMilliseconds('2026-09-17T14:06:18+02:00'),Date.parse('2026-09-17T12:06:18Z'));
});
test('Uptime duration stays readable without invented future values',()=>{
 assert.equal(durationLabel((2*24+3)*3600000),'2 j 3 h');
 assert.equal(durationLabel(65*60000),'1 h 5 min');
 assert.equal(durationLabel(2*60000),'2 min');
 assert.equal(durationLabel(-1),'Indisponible');
});
test('Reference options accept only explicit booleans',()=>{
 assert.throws(()=>validateConfig({provider:'free',show_missing:'true'}));
 assert.throws(()=>validateConfig({provider:'free',show_controls:'false'}));
 assert.equal(validateConfig({provider:'free',show_missing:true,show_controls:false}).show_controls,false);
});
test('Attribute mappings cannot be used to change action states',()=>{
 assert.throws(()=>validateConfig({provider:'free',attributes:{reboot:'anything'}}));
 assert.throws(()=>validateConfig({provider:'free',attributes:{uptime:''}}));
 assert.throws(()=>validateConfig({provider:'free',attributes:[]}));
});
