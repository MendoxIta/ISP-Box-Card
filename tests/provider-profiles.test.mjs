import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveProviderConfig} from '../src/provider-profiles.js';
import {providerFixture} from './provider-fixtures.mjs';
const resolve=(provider,fixture,extra={})=>resolveProviderConfig({provider,entities:{},...extra},fixture.registry,fixture.states,fixture.devices);
test('Freebox resolves renamed entities by integration identity, not visible names',()=>{
 const f=providerFixture('free'),c=resolve('free',f);
 assert.equal(c.entities.download,f.entities.download);assert.equal(c.entities.upload,f.entities.upload);
 assert.equal(c.entities.public_ip,f.entities.router);assert.equal(c.attributes.public_ip,'IPv4');assert.equal(c.attributes.uptime,'uptime');
 assert.equal(c.entities.connection,undefined);assert.equal(c.entities.devices,undefined);assert.equal(c.entities.guest_wifi,undefined);
 assert.equal(c.entities.missed_calls,f.entities.missed);
 assert(c.diagnostics.some(d=>d.entity===f.entities.temperature));assert(c.diagnostics.some(d=>d.entity===f.entities.fan));
 assert(c._device_info.some(d=>d.name==='Firmware'));
});
test('SFR WAN is distinct from DSL and synchronization is never bound to live traffic',()=>{
 const f=providerFixture('sfr'),c=resolve('sfr',f);
 assert.equal(c.entities.connection,f.entities.connection);assert.notEqual(c.entities.connection,f.entities.dsl);
 assert.equal(c.entities.download,undefined);assert.equal(c.entities.upload,undefined);
 assert.equal(c.entities.sync_download,f.entities.syncDown);assert.equal(c.entities.wifi,undefined);
 assert(c.diagnostics.some(d=>d.entity===f.entities.noise));assert(c.diagnostics.some(d=>d.entity===f.entities.voltage));
 const corrected=resolve('sfr',f,{entities:{download:f.entities.syncDown,upload:f.entities.syncUp}});
 assert.equal(corrected.entities.download,undefined);assert.equal(corrected.entities.sync_upload,f.entities.syncUp);
});
test('Livebox separates optics, cumulative volumes, tracked clients and named interface traffic',()=>{
 const f=providerFixture('orange'),c=resolve('orange',f);
 assert.equal(c.entities.public_ip,f.entities.connection);assert.equal(c.attributes.public_ip,'wan_ipaddress');
 assert.equal(c.entities.optical_rx,f.entities.rx);assert.equal(c.entities.guest_wifi,f.entities.guest);
 assert.equal(c.entities.wifi,f.entities.wifi);assert.notEqual(c.entities.wifi,c.entities.guest_wifi);
 assert.equal(c.entities.download,undefined);assert.equal(c.entities.devices,undefined);
 assert.equal(c.attributes.ethernet_devices,'wired clients');
 assert(c.diagnostics.some(d=>d.entity===f.entities.volume&&d.kind!=='rate'));
 assert(c.diagnostics.some(d=>d.entity===f.entities.interface&&d.kind==='rate'));
 assert(c.diagnostics.some(d=>d.attribute==='Temperature (°C)'&&d.unit==='°C'));
 assert(!c.diagnostics.some(d=>d.attribute==='missed_calls'||d.attribute==='callers'));
});
test('Known Livebox 3/4 have no auto-selected optical powers; explicit sources remain usable',()=>{
 const f=providerFixture('orange');f.devices[0].model='Livebox 4';
 assert.equal(resolve('orange',f).entities.optical_rx,undefined);
 assert.equal(resolve('orange',f,{entities:{optical_rx:'sensor.custom_rx'}}).entities.optical_rx,'sensor.custom_rx');
});
test('Bbox requires explicit mapping and exposes maximum bandwidth separately',()=>{
 const f=providerFixture('bouygues'),empty=resolve('bouygues',f);
 assert.deepEqual(empty.entities,{});assert.match(empty._notice,/manuellement/);
 const c=resolve('bouygues',f,{entities:f.entities});
 assert.equal(c.entities.download,f.entities.download);assert.equal(c.entities.wifi,undefined);assert.equal(c.entities.reboot,undefined);
 assert(c.diagnostics.some(d=>d.entity===f.entities.download_limit&&d.name.includes('disponible')));
 assert(c.diagnostics.some(d=>d.entity===f.entities.reboots));
});
test('Disabled entities are not enabled or guessed; unavailable mapped values remain selected',()=>{
 const f=providerFixture('free');f.registry.find(e=>e.entity_id===f.entities.fan).disabled_by='user';
 f.states[f.entities.download].state='unavailable';
 const c=resolve('free',f);assert.equal(c.entities.download,f.entities.download);assert(!c.diagnostics.some(d=>d.entity===f.entities.fan));
});
test('Multiple routers require a selected device; never mix their sensors',()=>{
 const a=providerFixture('free'),b=providerFixture('free');b.devices[0].id='router_b';b.devices[0].identifiers=[['freebox','02:00:00:00:00:02']];
 for(const e of b.registry){e.device_id='router_b';e.entity_id=e.entity_id.replace('renamed_','other_');e.unique_id=e.unique_id.replace('02:00:00:00:00:01','02:00:00:00:00:02');}
 const combined={registry:[...a.registry,...b.registry],states:a.states,devices:[...a.devices,...b.devices]};
 const ambiguous=resolve('free',combined);assert.deepEqual(ambiguous.entities,{});assert.match(ambiguous._notice,/Plusieurs/);
 const chosen=resolve('free',combined,{device_id:'router_a'});assert.equal(chosen.entities.download,a.entities.download);
 assert(chosen.diagnostics.every(d=>!d.entity.includes('other_')));
});
test('Explicit fields and custom diagnostic labels override automatic bindings without mutation',()=>{
 const f=providerFixture('free');const config={provider:'free',entities:{public_ip:'sensor.external_ip'},attributes:{},diagnostics:[{entity:f.entities.temperature,name:'CPU personnalisé'}]};
 const before=JSON.stringify(config);const c=resolveProviderConfig(config,f.registry,f.states,f.devices);
 assert.equal(c.entities.public_ip,'sensor.external_ip');assert.equal(c.attributes.public_ip,undefined);
 assert.equal(c.diagnostics.filter(d=>d.entity===f.entities.temperature).length,1);assert.equal(c.diagnostics.find(d=>d.entity===f.entities.temperature).name,'CPU personnalisé');assert.equal(JSON.stringify(config),before);
});
test('Auto detection can be disabled completely',()=>{
 const f=providerFixture('free');assert.deepEqual(resolve('free',f,{auto_detect:false}).entities,{});
});
