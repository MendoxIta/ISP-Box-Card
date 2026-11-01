import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {existsSync} from 'node:fs';
const root=resolve('.');
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/demo/providers.html`);
 await page.waitForFunction(()=>window.card?.settings()?._detected_device==='router_a');
 await mkdir('artifacts/providers',{recursive:true});
 for(const provider of ['free','orange','bouygues','sfr']){
  await page.locator('#provider').selectOption(provider);
  await page.waitForFunction(provider=>card.config.provider===provider&&(provider==='bouygues'||card.settings()._detected_device==='router_a'),provider);
  const text=await page.locator('isp-box-card').evaluate(c=>c.shadowRoot.textContent);
  if(provider==='free'){
   assert.match(text,/60 °C/);assert.match(text,/660 rpm/);assert.match(text,/Appels manqués non lus/);
   assert.equal(await page.getByRole('switch',{name:'Wi-Fi invité',exact:true}).count(),0);
   assert.equal(await page.locator('isp-box-card .gauge').count(),2);
   assert.equal(await page.locator('isp-box-card').evaluate(c=>c.settings().entities.connection),undefined);
  }
  if(provider==='sfr'){
   assert.match(text,/Synchronisation DSL descendante/);assert.match(text,/20 Mbit\/s/);
   assert.equal(await page.locator('isp-box-card .gauge').count(),0);
   assert.equal(await page.getByRole('switch').count(),0);assert.match(text,/Connectée/);
  }
  if(provider==='orange'){
   assert.match(text,/Volume interface fibre reçu \(cumulé\)/);assert.match(text,/12 GB/);
   assert.match(text,/12 Mbit\/s/);assert.match(text,/Clients Ethernet suivis/);assert.match(text,/Problème/);
   assert.equal(await page.locator('.diagnostic').filter({hasText:'Clients Ethernet suivis'}).locator('dd').innerText(),'2');
   assert.equal(await page.locator('.diagnostic').filter({hasText:'Clients Wi-Fi suivis'}).locator('dd').innerText(),'3');
   assert.equal(await page.locator('isp-box-card .gauge').count(),0);
   assert.equal(await page.getByRole('switch',{name:'Wi-Fi invité',exact:true}).count(),1);
  }
  if(provider==='bouygues'){
   assert.match(text,/Bande passante descendante disponible/);assert.match(text,/Nombre de démarrages/);assert.match(text,/Échelle : 1 Gbit\/s/);
   assert.equal(await page.getByRole('switch').count(),0);assert.equal(await page.locator('[data-action=reboot]').count(),0);
   assert.equal(await page.evaluate(()=>registryCalls.filter(c=>c.provider==='bouygues').length),0);
  }
  for(const width of [1024,390,320]){
   await page.setViewportSize({width,height:1400});
   assert.deepEqual(await page.locator('isp-box-card').evaluate(c=>[...c.shadowRoot.querySelectorAll('.tile,.hero,.diagnostic')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.className)),[],`${provider}: overflow at ${width}`);
   await page.screenshot({path:`artifacts/providers/${provider}-${width}.png`,fullPage:true});
  }
 }
 // Registry errors must leave explicitly mapped fields usable; no requests on every HA tick.
 await page.evaluate(()=>{window.failCount=0;const hass={states:fixture.states,connection:{},callWS:async()=>{failCount++;throw Error('Permission denied');}};card.setConfig({provider:'sfr',entities:{connection:fixture.entities.connection}});card.hass=hass;window.failedHass=hass;});
 await page.waitForFunction(()=>card._registryLoading===false);
 await page.evaluate(()=>{for(let i=0;i<10;i++)card.hass=failedHass;});
 assert.equal(await page.evaluate(()=>failCount),2);
 assert.match(await page.locator('isp-box-card .badge').innerText(),/Connectée/);
 // Same-connection configuration retry must recover after the initial registry denial.
 await page.evaluate(()=>{
  failedHass.callWS=async({type})=>structuredClone(type==='config/entity_registry/list'?fixture.registry:fixture.devices);
  card.setConfig({...card.config});
 });
 await page.waitForFunction(()=>card.settings()._detected_device==='router_a');
 assert.equal(await page.locator('.reboot').count(),1);
 // Renaming an automatic entity must invalidate the registry on the same connection.
 await page.locator('#provider').selectOption('free');
 await page.waitForFunction(()=>card.config.provider==='free'&&card.settings()._detected_device==='router_a');
 await page.evaluate(async()=>{
  const old=fixture.entities.wifi,next='switch.renamed_after_load';
  fixture.registry.find(e=>e.entity_id===old).entity_id=next;
  fixture.states[next]={...fixture.states[old],entity_id:next};delete fixture.states[old];fixture.entities.wifi=next;
  card.hass=fixtureHass;
  for(const callback of fixtureHass.connection.handlers.entity_registry_updated||[])callback({event_type:'entity_registry_updated'});
  await new Promise(resolve=>setTimeout(resolve,250));
 });
 assert.equal(await page.evaluate(()=>card.settings().entities.wifi),'switch.renamed_after_load');
 // DOM removal must unsubscribe; reinsertion must refresh and subscribe exactly once.
 await page.evaluate(()=>card.remove());
 assert.deepEqual(await page.evaluate(()=>Object.values(fixtureHass.connection.handlers).map(list=>list.length)),[0,0]);
 await page.evaluate(()=>document.querySelector('main').append(card));
 await page.waitForFunction(()=>card.settings()._detected_device==='router_a'&&fixtureHass.connection.handlers.entity_registry_updated?.length===1);
 assert.equal(await page.evaluate(()=>fixtureHass.connection.handlers.device_registry_updated.length),1);
 assert.deepEqual(await page.evaluate(()=>serviceCalls),[]);assert.deepEqual(errors,[]);
 console.log('PASS: integration-specific Free/Livebox/Bbox/SFR fixtures; registry discovery; DSL != traffic; volumes != rates; no unsupported controls; three responsive widths each; permission fallback/retry; live entity rename; subscription cleanup; no service calls.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
