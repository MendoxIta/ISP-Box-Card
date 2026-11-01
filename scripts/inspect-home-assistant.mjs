import { readFile, mkdir, writeFile } from 'node:fs/promises';

export async function credentials() {
  if (process.env.HASS_URL && process.env.HASS_TOKEN) return {url:process.env.HASS_URL.replace(/\/$/, ''),token:process.env.HASS_TOKEN};
  const path = process.env.HASS_ENV_FILE || '.env';
  const text = await readFile(path, 'utf8');
  const result = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(HASS_URL|HASS_TOKEN)\s*=\s*(.*)\s*$/);
    if (match) {
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      result[match[1]] = value;
    }
  }
  const url = process.env.HASS_URL || result.HASS_URL;
  const token = process.env.HASS_TOKEN || result.HASS_TOKEN;
  if (!url || !token) throw new Error('HASS_URL/HASS_TOKEN manquants.');
  return { url: url.replace(/\/$/, ''), token };
}

export async function connect({url,token}) {
  const ws = new WebSocket(url.replace(/^http/, 'ws') + '/api/websocket');
  let nextId = 0;
  const waiting = new Map();
  let resolveAuth, rejectAuth;
  const ready = new Promise((resolve, reject) => {resolveAuth=resolve;rejectAuth=reject;});
  const timeout = setTimeout(()=>{rejectAuth(new Error('WebSocket authentication timeout'));ws.close();},20000);
  ws.addEventListener('error',()=>rejectAuth(new Error('WebSocket connection failed')));
  ws.addEventListener('message',event=>{
    const data=JSON.parse(event.data);
    if(data.type==='auth_required') ws.send(JSON.stringify({type:'auth',access_token:token}));
    if(data.type==='auth_ok') {clearTimeout(timeout);resolveAuth();}
    if(data.type==='auth_invalid') {clearTimeout(timeout);rejectAuth(new Error('Home Assistant authentication rejected'));}
    if(data.type==='result') {const entry=waiting.get(data.id);if(!entry)return;waiting.delete(data.id);clearTimeout(entry.timeout);data.success?entry.resolve(data.result):entry.reject(new Error(`${entry.type}: ${data.error?.code} ${data.error?.message}`));}
  });
  await ready;
  return {
    call: (type,fields={})=>new Promise((resolve,reject)=>{const id=++nextId;const timeout=setTimeout(()=>{waiting.delete(id);reject(new Error(`${type}: timeout`));},30000);waiting.set(id,{resolve,reject,timeout,type});ws.send(JSON.stringify({id,type,...fields}));}),
    close:()=>ws.close(),
  };
}

export async function inspect() {
  const auth=await credentials();
  const api=await connect(auth);
  try {
    const [states,entities,devices,dashboards,resources,config] = await Promise.all([
      api.call('get_states'),api.call('config/entity_registry/list'),api.call('config/device_registry/list'),api.call('lovelace/dashboards/list'),api.call('lovelace/resources'),
      fetch(auth.url+'/api/config',{headers:{Authorization:`Bearer ${auth.token}`},signal:AbortSignal.timeout(20000)}).then(async response=>{if(!response.ok)throw Error(`API config HTTP ${response.status}`);return response.json();}),
    ]);
    const boxDevices=devices.filter(device=>/freebox|free telecom|free sas/i.test([device.name,device.name_by_user,device.manufacturer,device.model].join(' ')));
    const deviceIds=new Set(boxDevices.map(d=>d.id));
    const boxEntities=entities.filter(entity=>entity.platform==='freebox'||deviceIds.has(entity.device_id)||/freebox/i.test(entity.entity_id));
    const ids=new Set(boxEntities.map(entity=>entity.entity_id));
    const boxStates=states.filter(state=>ids.has(state.entity_id));
    const report={home_assistant_version:config.version,devices:boxDevices.map(({id,name,name_by_user,manufacturer,model})=>({id,name,name_by_user,manufacturer,model})),entities:boxEntities.map(entity=>({entity_id:entity.entity_id,platform:entity.platform,disabled_by:entity.disabled_by,device_id:entity.device_id,original_name:entity.original_name})),states:boxStates.map(state=>({entity_id:state.entity_id,state:/ip|mac|ssid|serial/i.test(state.entity_id)?'[redacted]':state.state,unit:state.attributes.unit_of_measurement,device_class:state.attributes.device_class,friendly_name:state.attributes.friendly_name})),dashboards:dashboards.map(({id,url_path,title,mode})=>({id,url_path,title,mode})),resources:resources.map(({id,url,res_type})=>({id,url,res_type}))};
    await mkdir('artifacts/live',{recursive:true});
    await writeFile('artifacts/live/inventory.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify(report,null,2));
    return {auth,api:null,states,entities,devices,dashboards,resources,config,boxStates,boxEntities};
  } finally {api.close();}
}
if (process.argv[1]?.endsWith('inspect-home-assistant.mjs')) await inspect();
