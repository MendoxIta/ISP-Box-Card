import '../dist/isp-box-card.js';
export const config = {
  type: 'custom:isp-box-card', provider: 'free', model: 'Freebox Ultra', technology: 'Fibre XGS-PON', hide_public_ip: true, download_max: 8000, upload_max: 8000,
  entities: {connection:'binary_sensor.demo_connection', download:'sensor.demo_download', upload:'sensor.demo_upload', devices:'sensor.demo_devices', ethernet_devices:'sensor.demo_ethernet', wifi_devices:'sensor.demo_wireless', public_ip:'sensor.demo_ip', uptime:'sensor.demo_uptime', optical_rx:'sensor.demo_rx', optical_tx:'sensor.demo_tx', wifi:'switch.demo_wifi', guest_wifi:'switch.demo_guest', reboot:'button.demo_reboot'},
  ports: [{name:'Port 1',download:'sensor.demo_port_down',upload:'sensor.demo_port_up'},{name:'Port 2',download:'sensor.demo_zero',upload:'sensor.demo_zero'},{name:'Port 3',download:'sensor.demo_zero',upload:'sensor.demo_zero'}],
};
const state=(state, unit)=>({state:String(state),attributes:unit?{unit_of_measurement:unit}:{}});
export const states = {
  'binary_sensor.demo_connection':state('on'), 'sensor.demo_download':state(275000,'kB/s'), 'sensor.demo_upload':state(150000,'kB/s'),
  'sensor.demo_devices':state(47), 'sensor.demo_ethernet':state(18), 'sensor.demo_wireless':state(29), 'sensor.demo_ip':state('203.0.113.42'),
  'sensor.demo_uptime':state(927072,'s'), 'sensor.demo_rx':state(-19.32,'dBm'), 'sensor.demo_tx':state(3.7,'dBm'),
  'switch.demo_wifi':state('on'), 'switch.demo_guest':state('off'), 'button.demo_reboot':state('unknown'),
  'sensor.demo_port_down':state(117.3,'Mbit/s'),'sensor.demo_port_up':state(42.7,'Mbit/s'),'sensor.demo_zero':state(0,'Mbit/s'),
};
window.calls=[]; window.rejectCalls=false;
const card=document.querySelector('isp-box-card');
window.card=card;
window.demoHass={states,callService:async(domain,service,data)=>{
  window.calls.push({domain,service,data});
  if(window.rejectCalls) throw new Error('Simulated permission error');
  document.querySelector('#log').textContent=`Simulation uniquement : ${domain}.${service} → ${data.entity_id}`;
  if(domain==='switch') states[data.entity_id]=state(service==='turn_on'?'on':'off');
  card.hass=window.demoHass;
}};
card.setConfig(config); card.hass=window.demoHass;
const models={free:['Freebox Ultra','Fibre XGS-PON'],orange:['Livebox 6','Fibre GPON'],bouygues:['Bbox','Fibre'],sfr:['SFR Box','Fibre']};
document.querySelector('#provider').onchange=event=>{const provider=event.target.value; card.setConfig({...config,provider,model:models[provider][0],technology:models[provider][1]});};
let failed=false;
document.querySelector('#unavailable').onclick=()=>{failed=!failed;for(const [id,obj]of Object.entries(states)) {obj.saved??=obj.state;obj.state=failed?'unavailable':obj.saved;}card.hass=window.demoHass;};
document.querySelector('#editor').onclick=()=>{document.querySelector('#log').textContent='L’éditeur utilise le composant ha-form fourni par Home Assistant. Configurez les entités dans HA après installation.';};
