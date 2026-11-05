import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {existsSync} from 'node:fs';
const root=resolve('.');
const server=createServer(async(req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end('Not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://127.0.0.1:${server.address().port}/demo/index.html`);
 await page.waitForSelector('isp-box-card .reading');
 await page.evaluate(()=>{
  window.editor=customElements.get('isp-box-card').getConfigElement();
  editor.setConfig({...card.config,appearance:{radius:12,colors:{accent:'#123456'}},diagnostics:[{entity:'sensor.demo_zero',name:'Keep me'}]});document.body.append(editor);
  window.events=0;editor.addEventListener('config-changed',event=>{events++;editor.setConfig(structuredClone(event.detail.config));});
  // HA echoes each config-changed through setConfig. A mounted input subtree must survive.
  window.savedForm=editor.shadowRoot.querySelector('ha-form');
  savedForm.innerHTML='<details open id="remember"><summary>Appearance state</summary><input id="focused" value="12"></details>';
  savedForm.querySelector('input').focus();
  savedForm.dispatchEvent(new CustomEvent('value-changed',{detail:{value:{...savedForm.data,appearance:{radius:8,colors:{accent:[124,58,237]}}}}}));
 });
 assert.equal(await page.evaluate(()=>editor.shadowRoot.querySelector('ha-form')===savedForm),true,'HA setConfig echo must not recreate the form or collapse its sections');
 assert.equal(await page.evaluate(()=>savedForm.querySelector('details').open),true);
 assert.equal(await page.evaluate(()=>editor.shadowRoot.activeElement?.id),'focused');
 assert.equal(await page.evaluate(()=>editor.config.appearance.radius),8);
 assert.equal(await page.evaluate(()=>editor.config.appearance.colors.accent),'#7c3aed');
 assert.equal(await page.evaluate(()=>editor.config.diagnostics[0].name),'Keep me');
 assert.equal(await page.evaluate(()=>events),1);
 assert.deepEqual(await page.evaluate(()=>[...editor.shadowRoot.querySelectorAll('details[data-section]')].map(el=>el.dataset.section)),['box','display','appearance','advanced']);
 await page.evaluate(()=>{
  editor.shadowRoot.querySelector('details[data-section=appearance]').open=true;
  editor.shadowRoot.querySelector('details[data-section=display]').open=true;
  const appearance=editor.shadowRoot.querySelector('#appearance-form');window.savedSchema=appearance.schema;
  for(let i=1;i<=20;i++)appearance.dispatchEvent(new CustomEvent('value-changed',{detail:{value:{...appearance.data,appearance:{...appearance.data.appearance,radius:i}}}}));
  editor.hass={states:{}};
 });
 assert.equal(await page.evaluate(()=>editor.shadowRoot.querySelector('details[data-section=appearance]').open),true);
 assert.equal(await page.evaluate(()=>editor.shadowRoot.querySelector('details[data-section=display]').open),true);
 assert.equal(await page.evaluate(()=>editor.shadowRoot.querySelector('#appearance-form').schema===savedSchema),true);
 assert.equal(await page.evaluate(()=>editor.config.appearance.radius),20);
 assert.equal(await page.evaluate(()=>events),21);
 assert.deepEqual(errors,[]);
 console.log('PASS: HA config echo preserves mounted form, open section, focus, normalized colors and advanced YAML; no duplicate event.');
}finally{await browser.close();await new Promise(r=>server.close(r));}
