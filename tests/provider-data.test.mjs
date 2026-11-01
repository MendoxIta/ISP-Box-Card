import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.HTMLElement=class {};
globalThis.customElements={get:()=>true};
globalThis.window={};
const {diagnosticValue,validateConfig}=await import('../dist/isp-box-card.js');
test('Read-only diagnostics retain native temperature, fan and volume units',()=>{
 const states={'sensor.temp':{state:'60',attributes:{unit_of_measurement:'°C'}},'sensor.fan':{state:'660',attributes:{unit_of_measurement:'rpm'}},'sensor.volume':{state:'12.5',attributes:{unit_of_measurement:'GiB'}}};
 assert.equal(diagnosticValue({entity:'sensor.temp'},states),'60 °C');
 assert.equal(diagnosticValue({entity:'sensor.fan'},states),'660 rpm');
 assert.equal(diagnosticValue({entity:'sensor.volume'},states),'12,5 GiB');
});
test('Line synchronization and cumulative volume are not inferred as current traffic',()=>{
 const states={'sensor.sync':{state:'1000',attributes:{unit_of_measurement:'kbit/s'}},'sensor.volume':{state:'1000',attributes:{unit_of_measurement:'GiB'}}};
 assert.equal(diagnosticValue({entity:'sensor.sync',kind:'rate'},states),'1 Mbit/s');
 assert.equal(diagnosticValue({entity:'sensor.volume',kind:'rate'},states),'Unité non reconnue');
});
test('Diagnostics preserve zero, unknown link states and unavailable parent attributes',()=>{
 const states={'binary_sensor.link':{state:'unknown',attributes:{device_class:'connectivity'}},'sensor.calls':{state:'0',attributes:{}},'device_tracker.box':{state:'unavailable',attributes:{uptime:123}}};
 assert.equal(diagnosticValue({entity:'binary_sensor.link'},states),'Indisponible');
 assert.equal(diagnosticValue({entity:'sensor.calls'},states),'0');
 assert.equal(diagnosticValue({entity:'device_tracker.box',attribute:'uptime',kind:'duration',unit:'s'},states),'Indisponible');
 states['binary_sensor.link'].state='off';
 assert.equal(diagnosticValue({entity:'binary_sensor.link'},states),'Déconnecté');
});
test('Numeric attributes of a binary parent stay numeric instead of being treated as switches',()=>{
 const states={'binary_sensor.wan':{state:'on',attributes:{'wired clients':2,'wireless clients':3,device_class:'connectivity'}}};
 assert.equal(diagnosticValue({entity:'binary_sensor.wan',attribute:'wired clients'},states),'2');
 assert.equal(diagnosticValue({entity:'binary_sensor.wan',attribute:'wireless clients'},states),'3');
});
test('Diagnostic configuration accepts only read-only entities and known formats',()=>{
 assert.throws(()=>validateConfig({provider:'free',diagnostics:[{entity:'button.reboot'}]}));
 assert.throws(()=>validateConfig({provider:'free',diagnostics:[{entity:'sensor.temp',kind:'execute'}]}));
 assert.throws(()=>validateConfig({provider:'free',diagnostics:[{entity:'sensor.temp',name:123}]}));
 assert.equal(validateConfig({provider:'free',diagnostics:[{entity:'sensor.temp',name:'CPU'}]}).diagnostics.length,1);
});
