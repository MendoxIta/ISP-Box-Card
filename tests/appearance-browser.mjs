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
 const page=await browser.newPage({viewport:{width:1024,height:1600}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/demo/index.html`);
 await page.waitForSelector('isp-box-card .reading');
 await mkdir('artifacts/appearance',{recursive:true});
 const fullHeight=await page.locator('isp-box-card').evaluate(c=>c.getBoundingClientRect().height);
 const originalValues=await page.locator('isp-box-card').evaluate(c=>[...c.shadowRoot.querySelectorAll('.value,.reading,.diagnostic dd')].map(el=>el.textContent));
 await page.evaluate(()=>{window.original=structuredClone(card.config);card.setConfig({...original,layout:'compact',image:'/local/not-requested.png'});});
 assert.equal(await page.locator('isp-box-card .box-stage').count(),0);assert.equal(await page.locator('isp-box-card img').count(),0);
 assert((await page.locator('isp-box-card').evaluate(c=>c.getBoundingClientRect().height))<fullHeight);
 assert.deepEqual(await page.locator('isp-box-card').evaluate(c=>[...c.shadowRoot.querySelectorAll('.value,.reading,.diagnostic dd')].map(el=>el.textContent)),originalValues);
 // Custom palette and geometry must be real computed styles, not merely configuration.
 const colors={accent:'#7c3aed',background:'#f8fafc',surface:'#ffffff',text:'#172033',muted:'#475569',border:'#cbd5e1',download:'#0369a1',upload:'#15803d',success:'#15803d',warning:'#92400e',danger:'#b91c1c'};
 for(const provider of ['free','orange','bouygues','sfr']){
  for(const layout of ['full','compact']){
   await page.evaluate(({provider,layout,colors})=>card.setConfig({...original,provider,layout,appearance:{colors,radius:12,gap:12,padding:12}}),{provider,layout,colors});
   const computed=await page.locator('isp-box-card ha-card').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,radius:getComputedStyle(el).borderRadius}));
   assert.deepEqual(computed,{background:'rgb(248, 250, 252)',color:'rgb(23, 32, 51)',radius:'12px'});
   assert.equal(await page.locator('isp-box-card .dial .arc').first().evaluate(el=>getComputedStyle(el).stroke),'rgb(3, 105, 161)');
   for(const width of [1024,390,320]){
    await page.setViewportSize({width,height:1800});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(await page.locator('isp-box-card').evaluate(c=>[...c.shadowRoot.querySelectorAll('.tile,.hero,.diagnostic')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.className)),[],`${provider}/${layout}/${width}`);
    if(provider==='free'&&[1024,390].includes(width))await page.locator('isp-box-card').screenshot({path:`artifacts/appearance/${layout}-${width}.png`});
   }
  }
 }
 // Extreme settings must stay bounded and usable on a narrow card.
 for(const layout of ['full','compact'])for(const n of [0,1]){
  await page.evaluate(({layout,n})=>{demoHass.states['sensor.demo_ip'].state='255.255.255.255';card.setConfig({...original,layout,hide_public_ip:false,appearance:{radius:n*40,gap:n*24,padding:n*32}});card.hass=demoHass;},{layout,n});
  assert.equal(await page.locator('isp-box-card .privacy .value').evaluate(el=>el.scrollWidth>el.clientWidth+1),false);
  assert.deepEqual(await page.locator('isp-box-card').evaluate(c=>[...c.shadowRoot.querySelectorAll('.tile,.hero')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.className)),[]);
 }
 // Removing overrides restores the provider palette and original geometry.
 await page.evaluate(()=>card.setConfig({...original,provider:'orange'}));
 assert.equal(await page.locator('isp-box-card ha-card').evaluate(el=>el.style.getPropertyValue('--accent')),'#ff7900');
 assert.equal(await page.locator('isp-box-card ha-card').evaluate(el=>el.style.getPropertyValue('--isp-background')),'');
 // Editor roundtrip: HA color_rgb arrays become safe YAML hex; advanced data survives.
 await page.evaluate(()=>{
  const editor=customElements.get('isp-box-card').getConfigElement();window.editor=editor;
  editor.setConfig({...original,layout:'compact',appearance:{radius:0,gap:9,colors:{accent:'#abc'}},diagnostics:[{entity:'sensor.demo_zero',name:'Custom'}]});document.body.append(editor);
  window.emitted=null;editor.addEventListener('config-changed',event=>window.emitted=event.detail.config);
  const form=editor.shadowRoot.querySelector('ha-form');window.editorRgb=form.data.appearance.colors.accent;
  form.dispatchEvent(new CustomEvent('value-changed',{detail:{value:{...form.data,appearance:{radius:0,gap:9,padding:'',colors:{accent:[124,58,237],background:null}},provider:'orange'}}}));
 });
 assert.deepEqual(await page.evaluate(()=>editorRgb),[170,187,204]);
 assert.deepEqual(await page.evaluate(()=>emitted.appearance),{radius:0,gap:9,colors:{accent:'#7c3aed'}});
 assert.equal(await page.evaluate(()=>emitted.layout),'compact');assert.equal(await page.evaluate(()=>emitted.diagnostics.length),0); // Existing provider reset contract.
 await page.evaluate(()=>{
  editor.setConfig({...original,layout:'compact',appearance:{radius:0,colors:{accent:'#7c3aed'}},diagnostics:[{entity:'sensor.demo_zero',name:'Custom'}]});
 });
 await page.locator('isp-box-card-editor details[data-section=appearance] > summary').click();
 await page.locator('isp-box-card-editor #reset-appearance').click();
 assert.equal(await page.evaluate(()=>emitted.appearance),undefined);assert.equal(await page.evaluate(()=>emitted.layout),undefined);
 assert.equal(await page.evaluate(()=>emitted.diagnostics[0].name),'Custom');assert.deepEqual(await page.evaluate(()=>emitted.entities),await page.evaluate(()=>original.entities));
 assert.deepEqual(await page.evaluate(()=>calls),[]);assert.deepEqual(errors,[]);
 // Exercise the interactive demo controls, not only direct setConfig calls.
 await page.goto(`http://127.0.0.1:${server.address().port}/demo/appearance.html`);
 await page.waitForSelector('isp-box-card .diagnostic-panel');
 await page.locator('#layout').selectOption('compact');
 await page.locator('[data-color=accent]').fill('#7c3aed');
 await page.locator('[data-size=radius]').fill('7');
 assert.equal(await page.locator('isp-box-card ha-card').evaluate(el=>getComputedStyle(el).borderRadius),'7px');
 await page.locator('#provider').selectOption('orange');
 assert.equal(await page.locator('isp-box-card ha-card').evaluate(el=>el.style.getPropertyValue('--accent')),'#7c3aed');
 await page.locator('#reset').click();
 assert.equal(await page.locator('isp-box-card .box-stage').count(),1);
 assert.equal(await page.locator('isp-box-card ha-card').evaluate(el=>el.style.getPropertyValue('--accent')),'#ff7900');
 assert.deepEqual(await page.evaluate(()=>serviceCalls),[]);assert.deepEqual(errors,[]);
 console.log('PASS: full/compact modes; 4 providers x 2 layouts x 3 widths; computed custom colors/geometry; spacing extremes; no data loss; safe editor RGB roundtrip and reset; no services.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
