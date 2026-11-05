// Connected read-only preview: only this browser receives the new local module bytes.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {credentials,connect} from './inspect-home-assistant.mjs';
const auth=await credentials(),api=await connect(auth);
const moduleBytes=await readFile('dist/isp-box-card.js');
const {version}=JSON.parse(await readFile('package.json','utf8'));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
async function snapshot(){const dashboards=await api.call('lovelace/dashboards/list');const configs={};for(const d of dashboards)configs[d.url_path]=await api.call('lovelace/config',{url_path:d.url_path});return{dashboards,configs,resources:await api.call('lovelace/resources')};}
try{
 await mkdir('artifacts/provider-adaptation',{recursive:true});const before=await snapshot();
 const context=await browser.newContext({viewport:{width:1280,height:1800},timezoneId:'Europe/Paris',serviceWorkers:'block'});
 await context.addInitScript(({url,token})=>{
  localStorage.setItem('hassTokens',JSON.stringify({hassUrl:url,access_token:token,token_type:'Bearer',expires_in:31536000,expires:Date.now()+31536000000,clientId:location.origin+'/',refresh_token:''}));
  window.__blocked=[];const Native=WebSocket;window.WebSocket=class extends Native{send(data){let msg;try{msg=JSON.parse(data);}catch{}if(msg?.type==='call_service'){window.__blocked.push(`${msg.domain}.${msg.service}`);throw Error('Read-only test forbids service calls');}return super.send(data);}};
 },auth);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message.replaceAll(auth.token,'[redacted]')));
 await page.route(/\/(?:local|hacsfiles\/[^/]+)\/isp-box-card\.js(?:\?.*)?$/,route=>route.fulfill({contentType:'text/javascript',body:moduleBytes}));
 await page.goto(auth.url+'/dashboard-family-test/internet',{waitUntil:'domcontentloaded',timeout:45000});
 const card=page.locator('isp-box-card');await card.waitFor({timeout:60000});
 await page.waitForFunction(version=>customElements.get('isp-box-card')?.version===version,version);
 await page.waitForFunction(()=>{const find=root=>{for(const el of root.querySelectorAll('*')){if(el.localName==='isp-box-card')return el;if(el.shadowRoot){const match=find(el.shadowRoot);if(match)return match;}}};const c=find(document.querySelector('home-assistant').shadowRoot);return c?.settings()._detected_device&&c._registryUnsubscribers?.length===2&&c.shadowRoot.querySelector('.diagnostic-panel')&&(c.config.layout==='compact'||!c.config.image||c.shadowRoot.querySelector('img')?.naturalWidth>0);},{},{timeout:60000});
 const checks=await card.evaluate(c=>{
  const settings=c.settings(),deviceId=settings._detected_device;
  const diagnostics=settings.diagnostics.map(item=>({entity:item.entity,name:item.name,unit:c._hass.states[item.entity]?.attributes?.unit_of_measurement}));
  const expected=c._registry.filter(entry=>entry.platform==='freebox'&&entry.device_id===deviceId&&!entry.disabled_by&&['sensor'].includes(entry.entity_id.split('.')[0])).filter(entry=>{const attrs=c._hass.states[entry.entity_id]?.attributes;return attrs?.device_class==='temperature'||attrs?.unit_of_measurement==='rpm';}).map(entry=>entry.entity_id);
  window.liveCard=c;
  return{version:customElements.get('isp-box-card').version,auto_detected:!!deviceId,registry_event_subscriptions:c._registryUnsubscribers.length,diagnostics,temperature_and_fan_entities:expected,ip_visible:c._revealed,ip_expected:c.config.hide_public_ip===false,connection_mapped:!!settings.entities.connection,guest_wifi_mapped:!!settings.entities.guest_wifi,firmware_visible:settings._device_info.some(i=>i.name==='Firmware')};
 });
 assert(checks.auto_detected);assert(checks.temperature_and_fan_entities.length>0);
 for(const id of checks.temperature_and_fan_entities)assert(checks.diagnostics.some(item=>item.entity===id));
 assert(checks.diagnostics.some(item=>item.name==='Appels manqués non lus'));
 assert.equal(checks.connection_mapped,false);assert.equal(checks.guest_wifi_mapped,false);assert.equal(checks.firmware_visible,true);assert.equal(checks.ip_visible,checks.ip_expected);
 assert.equal(await card.getByRole('switch',{name:'Wi-Fi invité',exact:true}).count(),0);
 assert.equal(await card.locator('.ports').count(),0);
 for(const width of [1280,390]){await page.setViewportSize({width,height:1800});assert.deepEqual(await card.evaluate(c=>[...c.shadowRoot.querySelectorAll('.tile,.hero,.diagnostic')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.className)),[]);await card.screenshot({path:`artifacts/provider-adaptation/freebox-${width}.png`});}
 // Real HA editor, inside its context-provider tree. No dashboard save.
 await page.evaluate(()=>{
  const editor=customElements.get('isp-box-card').getConfigElement();editor.hass=document.querySelector('home-assistant').hass;editor.setConfig({...liveCard.config,device_id:liveCard.settings()._detected_device,show_missing:false,layout:'compact',appearance:{radius:12,gap:10,colors:{accent:'#7c3aed',background:'#f8fafc',text:'#172033'}}});editor.addEventListener('config-changed',event=>editor.setConfig(structuredClone(event.detail.config)));window.previewEditor=editor;
  const panel=document.createElement('div');panel.id='profile-editor';panel.style.cssText='position:fixed;inset:0;z-index:99999;overflow:auto;background:var(--card-background-color,#fff);padding:24px';panel.append(editor);document.querySelector('home-assistant').shadowRoot.append(panel);
 });
 await page.locator('#profile-editor details[data-section=display] > summary').click();
 await page.getByRole('textbox',{name:'Titre personnalisé',exact:true}).fill('Prévisualisation des profils');await page.getByRole('textbox',{name:'Modèle de box',exact:true}).click();
 await page.waitForFunction(()=>previewEditor.config.title==='Prévisualisation des profils');
 assert.equal(await page.locator('#profile-editor ha-entity-picker').count(),7);
 assert.equal(await page.locator('#profile-editor ha-device-picker').count(),1);
 await page.locator('#profile-editor details[data-section=appearance] > summary').click();
 await page.getByText('Fonds, textes et bordures',{exact:true}).click();
 await page.evaluate(()=>{window.savedAppearanceForm=previewEditor.shadowRoot.querySelector('#appearance-form');});
 await page.locator('#profile-editor ha-selector-color_rgb').first().waitFor();
 assert.equal(await page.locator('#profile-editor ha-selector-color_rgb').count(),11);
 await page.getByRole('spinbutton',{name:'Arrondi des angles',exact:true}).fill('8');
 await page.getByRole('textbox',{name:'Titre personnalisé',exact:true}).click();
 await page.waitForFunction(()=>previewEditor.config.appearance.radius===8);
 assert.equal(await page.evaluate(()=>previewEditor.shadowRoot.querySelector('#appearance-form')===savedAppearanceForm),true,'HA echo must preserve the appearance form');
 assert.equal(await page.evaluate(()=>previewEditor.shadowRoot.querySelector('details[data-section=appearance]').open),true,'Appearance section must remain open');
 assert.equal(await page.getByRole('spinbutton',{name:'Arrondi des angles',exact:true}).isVisible(),true);
 assert.equal(await page.getByRole('textbox',{name:'Titre personnalisé',exact:true}).isVisible(),true);
 assert.equal(await page.locator('#profile-editor ha-selector-color_rgb').first().isVisible(),true,'Open color group must survive numeric edits and HA echo');
 await page.locator('#profile-editor ha-selector-color_rgb').first().evaluate(el=>el.dispatchEvent(new CustomEvent('value-changed',{detail:{value:[34,120,200]},bubbles:true,composed:true})));
 await page.waitForFunction(()=>previewEditor.config.appearance.colors.accent==='#2278c8');
 assert.equal(await page.locator('#profile-editor ha-selector-color_rgb').first().isVisible(),true,'Color group must stay open after changing color');
 const editorChecks=await page.evaluate(()=>({sections:previewEditor.shadowRoot.querySelectorAll('details[data-section]').length,form_reused:previewEditor.shadowRoot.querySelector('#appearance-form')===savedAppearanceForm,appearance_open:previewEditor.shadowRoot.querySelector('details[data-section=appearance]').open,hex_color:previewEditor.config.appearance.colors.accent,flattened_groups_clean:!('dimensions' in previewEditor.config.appearance)&&!('base_palette' in previewEditor.config.appearance.colors)}));
 assert.equal(editorChecks.sections,4);assert.equal(editorChecks.flattened_groups_clean,true);
 // Screenshot the native editor at a realistic pane width; no live state values are shown.
 await page.getByText('Fonds, textes et bordures',{exact:true}).click();
 await page.evaluate(()=>{for(const el of previewEditor.shadowRoot.querySelectorAll('details[data-section]'))el.open=el.dataset.section==='appearance';});
 for(const width of [520,390]){await page.setViewportSize({width,height:1800});await page.locator('#profile-editor isp-box-card-editor').screenshot({path:`artifacts/provider-adaptation/editor-${width}.png`});}


 // Compact + a light custom palette on real states, in this temporary DOM only.
 await page.evaluate(()=>liveCard.setConfig({...liveCard.config,layout:'compact',appearance:{radius:8,gap:10,padding:12,colors:{accent:'#7c3aed',background:'#f8fafc',surface:'#fff',text:'#172033',muted:'#475569',border:'#cbd5e1',download:'#0369a1',upload:'#15803d'}}}));
 await page.evaluate(()=>document.querySelector('home-assistant').shadowRoot.querySelector('#profile-editor').remove());
 assert.equal(await card.locator('.box-stage').count(),0);
 for(const width of [1280,390]){await page.setViewportSize({width,height:1800});assert.deepEqual(await card.evaluate(c=>[...c.shadowRoot.querySelectorAll('.tile,.hero,.diagnostic')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.className)),[]);await card.screenshot({path:`artifacts/provider-adaptation/appearance-compact-${width}.png`});}
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.__blocked),[]);
 const after=await snapshot();assert.deepEqual(after,before);
 const report={passed:true,version:checks.version,preview_only:true,installed_module_modified:false,real_home_assistant:true,real_freebox:true,other_providers:'synthetic fixtures only',editor:editorChecks,module_sha256:createHash('sha256').update(moduleBytes).digest('hex'),checks,page_errors:errors,service_calls:0,all_dashboards_and_resources_unchanged:true};
 await writeFile('artifacts/provider-adaptation/verification.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
}finally{api.close();await browser.close();}
