/* Integration contracts audited in docs/INTEGRATIONS.md. Pure, read-only resolution. */
export const INTEGRATION_PROFILES = {
  free: { domain: 'freebox', name: 'Freebox · Core', automatic: true,
    fields: ['download','upload','public_ip','uptime','wifi','reboot','missed_calls'],
    selectors: {download:['sensor','rate_down'],upload:['sensor','rate_up'],wifi:['switch','wifi'],reboot:['button','reboot'],missed_calls:['sensor','missed']},
    note: 'Températures et ventilation selon le modèle. Le tracker ne prouve pas la connexion Internet.' },
  sfr: { domain: 'sfr_box', name: 'SFR Box · Core', automatic: true,
    fields: ['connection','sync_download','sync_upload','reboot'],
    selectors: {connection:['binary_sensor','wan_status'],sync_download:['sensor','dsl_rate_down'],sync_upload:['sensor','dsl_rate_up'],reboot:['button','system_reboot']},
    note: 'Les débits DSL sont des vitesses de synchronisation, pas du trafic instantané. Redémarrage selon authentification.' },
  orange: { domain: 'livebox', name: 'Livebox · HACS Cyr-ius', automatic: true,
    fields: ['connection','public_ip','uptime','optical_rx','optical_tx','sync_download','sync_upload','ethernet_devices','wifi_devices','wifi','guest_wifi','reboot'],
    selectors: {connection:['binary_sensor','connectivity'],uptime:['sensor','uptime'],optical_rx:['sensor','fiber_power_rx'],optical_tx:['sensor','fiber_power_tx'],sync_download:['sensor','down','down_rate'],sync_upload:['sensor','up','up_rate'],wifi:['switch','wifi','wifi_switch'],guest_wifi:['switch','guest_wifi'],reboot:['button','restart','restart_btn']},
    note: 'Clients suivis selon les options de l’intégration, non exhaustifs. Les taux d’interface ne sont pas automatiquement attribués au WAN.' },
  bouygues: { domain: 'bbox', name: 'Bbox · Core (YAML)', automatic: false,
    fields: ['download','upload','download_limit','upload_limit','uptime','reboots'],selectors:{},
    note: 'Associez les six capteurs Bbox manuellement : l’intégration historique ne fournit pas d’identifiants de registre fiables. Aucune commande Wi-Fi ou redémarrage.' },
};
export const EXTRA_METRICS = {
  sync_download: {name:'Synchronisation DSL descendante',kind:'rate'},
  sync_upload: {name:'Synchronisation DSL montante',kind:'rate'},
  download_limit: {name:'Bande passante descendante disponible',kind:'rate'},
  upload_limit: {name:'Bande passante montante disponible',kind:'rate'},
  reboots: {name:'Nombre de démarrages'},missed_calls:{name:'Appels manqués non lus'},
};
const profileDomain = entry => entry.entity_id?.split('.')[0];
function sourceKeys(entry, device, provider) {
  const keys=new Set(entry.translation_key ? [entry.translation_key] : []);
  const uid=entry.unique_id || '';
  if(provider==='free' && uid.includes(' ')) keys.add(uid.slice(uid.indexOf(' ')+1));
  if(provider==='sfr') {const match=uid.match(/_(system|wan|dsl|ftth|voip)_(.+)$/);if(match)keys.add(`${match[1]}_${match[2]}`);}
  if(provider==='orange') {
    const identifier=device?.identifiers?.find(([domain])=>domain==='livebox')?.[1];
    if(identifier && uid.startsWith(identifier+'_'))keys.add(uid.slice(identifier.length+1));
  }
  return keys;
}
function selectorMatch(entry, selector, device, provider) {
  return profileDomain(entry)===selector[0] && selector.slice(1).some(key=>sourceKeys(entry,device,provider).has(key));
}
function isRootCandidate(entry, devices, provider) {
  const profile=INTEGRATION_PROFILES[provider],device=devices.find(d=>d.id===entry.device_id);
  return Object.values(profile.selectors).some(selector=>selectorMatch(entry,selector,device,provider));
}
export function resolveProviderConfig(config, registry=[], states={}, devices=[]) {
  const profile=INTEGRATION_PROFILES[config.provider];
  const explicitEntities={...(config.entities||{})};
  const result={...config,entities:{...explicitEntities},attributes:{...(config.attributes||{})},diagnostics:[],_integration:profile.name,_notice:'',_device_info:[]};
  let automaticDiagnostics=[];
  const enabled=registry.filter(entry=>entry.platform===profile.domain && !entry.disabled_by && entry.device_id);
  if(profile.automatic && config.auto_detect!==false) {
    const candidates=[...new Set(enabled.filter(entry=>isRootCandidate(entry,devices,config.provider)).map(entry=>entry.device_id))];
    const hinted=[...new Set(enabled.filter(entry=>Object.values(explicitEntities).includes(entry.entity_id)).map(entry=>entry.device_id))];
    const chosen=config.device_id || (hinted.length===1 ? hinted[0] : hinted.length===0 && candidates.length===1 ? candidates[0] : null);
    if(!chosen && candidates.length>1)result._notice='Plusieurs box trouvées : choisissez l’appareil dans l’éditeur.';
    if(chosen && !enabled.some(entry=>entry.device_id===chosen))result._notice='Aucune entité active de cette intégration sur l’appareil choisi.';
    if(chosen && enabled.some(entry=>entry.device_id===chosen)) {
      const device=devices.find(d=>d.id===chosen);
      result._detected_device=chosen;
      if(!config.model && device?.model)result.model=device.model;
      if(device?.sw_version)result._device_info.push({name:'Firmware',value:device.sw_version});
      const entries=enabled.filter(entry=>entry.device_id===chosen);
      const one=selector=>{const matches=entries.filter(entry=>selectorMatch(entry,selector,device,config.provider));return matches.length===1 ? matches[0] : undefined;};
      const bind=(key,entry,attribute)=>{
        if(!entry||Object.hasOwn(explicitEntities,key))return;
        result.entities[key]=entry.entity_id;
        if(attribute)result.attributes[key]=attribute;else if(!Object.hasOwn(explicitEntities,key))delete result.attributes[key];
      };
      for(const [key,selector]of Object.entries(profile.selectors))bind(key,one(selector));
      const add=(entry,name,options={})=>{if(entry)automaticDiagnostics.push({entity:entry.entity_id,name,...options});};
      const addAttribute=(entry,attribute,name,unit,kind)=>{
        if(entry && Object.hasOwn(states[entry.entity_id]?.attributes||{},attribute))add(entry,name,{attribute,...(unit?{unit}:{}),...(kind?{kind}:{})});
      };
      if(config.provider==='free') {
        const router=entries.filter(entry=>profileDomain(entry)==='device_tracker' && (
          device?.identifiers?.some(([domain,id])=>domain==='freebox'&&id===entry.unique_id) ||
          Object.hasOwn(states[entry.entity_id]?.attributes||{},'firmware_version')));
        if(router.length===1){bind('public_ip',router[0],'IPv4');bind('uptime',router[0],'uptime');}
        for(const entry of entries) {
          const state=states[entry.entity_id],keys=sourceKeys(entry,device,config.provider);
          if(profileDomain(entry)==='sensor' && (state?.attributes?.device_class==='temperature' || state?.attributes?.unit_of_measurement==='rpm'))add(entry,entry.name||entry.original_name||state.attributes.friendly_name);
          if(keys.has('raid_degraded')||[...keys].some(key=>key.startsWith('raid_degraded ')))add(entry,entry.name||entry.original_name||'État RAID',{kind:'binary'});
        }
        const children=new Set(devices.filter(d=>d.via_device_id===chosen).map(d=>d.id));
        for(const entry of enabled.filter(e=>children.has(e.device_id))) {
          if(entry.translation_key==='partition_free_space'||[...sourceKeys(entry,device,'free')].some(k=>k.startsWith('partition_free_space ')))add(entry,entry.name||entry.original_name||'Espace disque libre');
        }
      }
      if(config.provider==='sfr') {
        const descriptions={dsl_status:'Liaison DSL',ftth_status:'Liaison fibre',voip_status:'Téléphonie VoIP',voip_hook_status:'Téléphone décroché',voip_callhistory_active:'Journal des appels',system_temperature:'Température de la box',system_alimvoltage:'Tension d’alimentation',system_net_infra:'Infrastructure réseau',net_infra:'Infrastructure réseau',wan_mode:'Mode WAN',voip_infra:'Infrastructure VoIP',dsl_linemode:'Mode DSL',dsl_counter:'Tentatives de synchronisation',dsl_connect_count:'Tentatives de synchronisation',dsl_crc:'Erreurs CRC',dsl_crc_error_count:'Erreurs CRC',dsl_noise_down:'Marge de bruit descendante',dsl_noise_up:'Marge de bruit montante',dsl_attenuation_down:'Atténuation descendante',dsl_attenuation_up:'Atténuation montante',dsl_line_status:'État de la ligne DSL',dsl_training:'Entraînement DSL'};
        for(const entry of entries){const key=[...sourceKeys(entry,device,'sfr')].find(k=>Object.hasOwn(descriptions,k));if(key)add(entry,entry.name||descriptions[key]);}
      }
      if(config.provider==='orange') {
        const connectivity=one(['binary_sensor','connectivity']);
        bind('public_ip',connectivity,'wan_ipaddress');
        for(const [key,attribute]of [['ethernet_devices','wired clients'],['wifi_devices','wireless clients']]) {
          if(Object.hasOwn(states[connectivity?.entity_id]?.attributes||{},attribute))bind(key,connectivity,attribute);
        }
        const descriptions={fiber_rx:'Volume interface fibre reçu (cumulé)',fiber_tx:'Volume interface fibre émis (cumulé)',wifi_rx:'Volume Wi-Fi reçu (cumulé)',wifi_tx:'Volume Wi-Fi émis (cumulé)',callers:'Entrées du journal d’appels',upnp:'Redirections de ports actives',dhcp_leases:'Baux DHCP',guest_dhcp_leases:'Baux DHCP invités',last_reboot_reason:'Motif du dernier démarrage',callmissed:'Présence d’appels manqués',remote_access:'Accès distant',};
        const legacyOptics=/^livebox[ _-]?[34](?:$|\b)/i.test(device?.model||config.model||'');
        if(legacyOptics){for(const key of ['optical_rx','optical_tx'])if(!Object.hasOwn(explicitEntities,key))delete result.entities[key];}
        for(const entry of entries) {
          const keys=sourceKeys(entry,device,'orange');
          const key=[...keys].find(k=>Object.hasOwn(descriptions,k));
          if(key)add(entry,entry.name||descriptions[key]);
          const interfaceKey=[...keys].find(k=>/_(rate_rx|rate_tx)$/.test(k));
          if(interfaceKey)add(entry,`${entry.name||entry.original_name||interfaceKey} · interface`,{kind:'rate'});
          if([...keys].some(k=>/^ddns_\d+$/.test(k)))add(entry,entry.name||entry.original_name||'État DDNS',{kind:'binary'});
        }
        if(!legacyOptics){
          const optical=one(['sensor','fiber_power_rx']);
          for(const [attribute,name,unit]of [['Temperature (°C)','Température du module optique','°C'],['Voltage (V)','Tension du module optique','V'],['Bias (mA)','Courant du module optique','mA'],['ONU State','État ONU',''],['Downstream max rate Gbps','Capacité optique descendante','Gbit/s'],['Downstream current rate Gbps','Liaison optique descendante','Gbit/s']])addAttribute(optical,attribute,name,unit);
          const opticalTx=one(['sensor','fiber_power_tx']);
          for(const [attribute,name]of [['Upstream max rate (Gbps)','Capacité optique montante'],['Upstream current rate (Gbps)','Liaison optique montante']])addAttribute(opticalTx,attribute,name,'Gbit/s');
        }
        addAttribute(one(['sensor','fiber_rx']),'Rx errors','Erreurs de réception interface fibre');
        addAttribute(one(['sensor','fiber_tx']),'Tx errors','Erreurs d’émission interface fibre');
      }
      // An explicitly selected DSL sensor must never masquerade as live traffic.
      for(const [traffic,sync]of [['download','sync_download'],['upload','sync_upload']]) {
        const entry=entries.find(e=>e.entity_id===result.entities[traffic]);
        const selector=profile.selectors[sync];
        if(entry&&selector&&selectorMatch(entry,selector,device,config.provider)) {result.entities[sync]??=entry.entity_id;delete result.entities[traffic];}
      }
    }
  }
  if(config.provider==='bouygues' && !Object.keys(explicitEntities).length)result._notice=profile.note;
  for(const [key,description]of Object.entries(EXTRA_METRICS))if(result.entities[key])automaticDiagnostics.push({entity:result.entities[key],...description,...(result.attributes[key]?{attribute:result.attributes[key]}:{})});
  if(!result.entities.devices) {
    for(const [key,name]of [['ethernet_devices','Clients Ethernet suivis'],['wifi_devices','Clients Wi-Fi suivis']])if(result.entities[key])automaticDiagnostics.push({entity:result.entities[key],name,...(result.attributes[key]?{attribute:result.attributes[key]}:{})});
  }
  const used=new Map();
  for(const item of [...automaticDiagnostics,...(config.diagnostics||[])])used.set(`${item.entity}\u0000${item.attribute||''}`,item);
  result.diagnostics=[...used.values()];
  return result;
}
