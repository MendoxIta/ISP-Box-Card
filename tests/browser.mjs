import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { existsSync } from 'node:fs';
const root=resolve('.');
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+'/'))throw Error();const data=await readFile(path);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript'})[extname(path)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/demo/index.html`);
 await page.waitForSelector('isp-box-card .reading');
 assert.match(await page.locator('isp-box-card .reading').first().innerText(),/2,2/);
 assert.equal(await page.locator('isp-box-card').evaluate(c=>c.shadowRoot.textContent.includes('203.0.113.42')),false);
 await page.getByRole('button',{name:'Afficher ou masquer'}).click();assert.match(await page.locator('isp-box-card').evaluate(c=>c.shadowRoot.textContent),/203.0.113.42/);
 await page.getByRole('button',{name:'Afficher ou masquer'}).click();assert.equal(await page.locator('isp-box-card').evaluate(c=>c.shadowRoot.textContent.includes('203.0.113.42')),false);
 for(const provider of ['orange','bouygues','sfr','free']) {await page.locator('#provider').selectOption(provider);assert.equal(await page.locator('isp-box-card').evaluate(c=>c.config.provider),provider);}
 await mkdir('artifacts',{recursive:true});
 for(const width of [1024,768,390,320]) {
   await page.setViewportSize({width,height:1000});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`Overflow at ${width}`);
   const clipped=await page.locator('isp-box-card').evaluate(c=>[...c.shadowRoot.querySelectorAll('.tile,.hero')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.className));assert.deepEqual(clipped,[],`Clipping at ${width}`);
   await page.screenshot({path:`artifacts/demo-${width}.png`,fullPage:true});
 }
 // No service is called when the restart confirmation is cancelled.
 page.once('dialog',d=>d.dismiss());await page.locator('[data-action="reboot"]').click();assert.equal(await page.evaluate(()=>calls.length),0);
 page.once('dialog',d=>d.accept());await page.locator('[data-action="reboot"]').click();await page.waitForFunction(()=>calls.length===1);
 assert.deepEqual(await page.evaluate(()=>calls[0]),{domain:'button',service:'press',data:{entity_id:'button.demo_reboot'}});
 page.once('dialog',d=>d.accept());await page.getByRole('switch',{name:'Wi-Fi principal'}).click();await page.waitForFunction(()=>calls.length===2);
 assert.equal(await page.evaluate(()=>calls[1].service),'turn_off');
 await page.getByRole('switch',{name:'Wi-Fi invité'}).click();await page.waitForFunction(()=>calls.length===3);assert.equal(await page.evaluate(()=>calls[2].service),'turn_on');
 await page.evaluate(()=>{window.rejectCalls=true;});page.once('dialog',d=>d.accept());await page.locator('[data-action="reboot"]').click();await page.getByRole('alert').waitFor();
 await page.locator('#unavailable').click();assert.equal(await page.getByRole('switch',{name:'Wi-Fi principal'}).isDisabled(),true);assert.match(await page.locator('.badge').innerText(),/inconnu/);
 // Explicit privacy opt-out must still allow masking again, and focus survives state updates.
 await page.locator('#unavailable').click();
 await page.evaluate(()=>card.setConfig({...card.config,hide_public_ip:false}));
 assert.match(await page.locator('isp-box-card').evaluate(c=>c.shadowRoot.textContent),/203.0.113.42/);
 await page.getByRole('button',{name:'Afficher ou masquer'}).focus();await page.keyboard.press('Enter');
 assert.equal(await page.locator('isp-box-card').evaluate(c=>c.shadowRoot.textContent.includes('203.0.113.42')),false);
 assert.equal(await page.locator('isp-box-card').evaluate(c=>c.shadowRoot.activeElement?.dataset.action),'privacy');
 // Unrelated HA changes should not reconstruct the DOM.
 assert.equal(await page.evaluate(()=>{const old=card.shadowRoot.querySelector('.hero');demoHass.states['sensor.unrelated']={state:'1',attributes:{}};card.hass=demoHass;return old===card.shadowRoot.querySelector('.hero');}),true);
 // A longest-form IPv4 must remain on one line at phone widths.
 const originalIp=await page.evaluate(()=>demoHass.states['sensor.demo_ip'].state);
 await page.evaluate(()=>{demoHass.states['sensor.demo_ip'].state='255.255.255.255';card.setConfig({...card.config,hide_public_ip:false});card.hass=demoHass;});
 for(const width of [390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.locator('isp-box-card .privacy .value').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'IPv4 should fit, not wrap or clip');}
 await page.evaluate(value=>{demoHass.states['sensor.demo_ip'].state=value;card.hass=demoHass;},originalIp);
 // Full reference composition must remain honest and usable without source entities.
 const savedConfig=await page.evaluate(()=>card.config);
 await page.evaluate(()=>card.setConfig({provider:'free',model:'Freebox Ultra',show_missing:true,hide_public_ip:false,entities:{},ports:[{name:'LAN 1'},{name:'LAN 2'},{name:'LAN 3'},{name:'LAN 4'}],download_max:8000,upload_max:8000}));
 assert.equal(await page.locator('isp-box-card .gauge').count(),2);
 assert.equal(await page.getByRole('switch',{name:'Wi-Fi invité'}).count(),0);
 assert.equal(await page.locator('[data-action=reboot]').isDisabled(),true);
 assert.match(await page.locator('isp-box-card').evaluate(c=>c.shadowRoot.textContent),/Source non associée/);
 for(const width of [1024,390,320]){await page.setViewportSize({width,height:1000});assert.deepEqual(await page.locator('isp-box-card').evaluate(c=>[...c.shadowRoot.querySelectorAll('.tile,.hero')].filter(e=>e.scrollWidth>e.clientWidth+2).map(e=>e.className)),[]);}
 await page.evaluate(()=>card.setConfig({...card.config,show_controls:false}));
 assert.equal(await page.locator('[data-action=reboot]').count(),0);
 await page.evaluate(config=>card.setConfig(config),savedConfig);
 // Missing images show an explicit error rather than an empty/broken graphic.
 await page.evaluate(()=>card.setConfig({...card.config,image:'/local/missing.webp'}));
 await page.locator('.image-error').waitFor();
 // State and configuration strings must not be interpreted as markup.
 await page.evaluate(()=>{card.setConfig({...card.config,title:'<img src=x onerror="window.pwned=true">'});});assert.equal(await page.evaluate(()=>Boolean(window.pwned)),false);
 assert.equal(await page.locator('isp-box-card').evaluate(c=>c.shadowRoot.querySelectorAll('.titles img').length),0);
 // The real visual editor delegates selectors to HA's ha-form, preserving advanced YAML.
 await page.evaluate(()=>{const editor=customElements.get('isp-box-card').getConfigElement();window.editor=editor;editor.setConfig({...card.config,ports:[{name:'LAN',download:'sensor.demo_zero'}]});document.body.append(editor);window.editorEvent=null;editor.addEventListener('config-changed',e=>window.editorEvent=e.detail.config);editor.shadowRoot.querySelector('ha-form').dispatchEvent(new CustomEvent('value-changed',{detail:{value:{...editor.config,provider:'orange'}}}));});
 assert.equal(await page.evaluate(()=>editorEvent.provider),'orange');assert.deepEqual(await page.evaluate(()=>editorEvent.ports),[]);assert.deepEqual(await page.evaluate(()=>editorEvent.entities),{});assert.equal(await page.evaluate(()=>editorEvent.image),undefined);
 assert.deepEqual(errors,[]);
 console.log('PASS: four themes; 1024/768/390/320px without overflow; rate conversion; IP privacy; confirmations; service routing; command failure; unavailable states; XSS escaping; editor event contract.');
 console.log('Screenshots: artifacts/demo-{1024,768,390,320}.png (simulated data, not connected Home Assistant).');
} finally { await browser.close(); await new Promise(r=>server.close(r)); }
