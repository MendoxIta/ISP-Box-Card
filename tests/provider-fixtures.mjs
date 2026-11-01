// Explicitly synthetic fixtures matching the audited upstream integration contracts.
export function providerFixture(provider) {
 const mac='02:00:00:00:00:01',serial='fixture_serial';
 const platform={free:'freebox',sfr:'sfr_box',orange:'livebox',bouygues:'bbox'}[provider];
 const device={id:'router_a',identifiers:[[platform,provider==='orange'?serial:mac]],model:provider==='orange'?'Livebox 6':'Fixture router',sw_version:'fixture-1'};
 const registry=[],states={};let sequence=0;
 const add=(domain,key,state,attributes={},translation_key=key)=>{
  const entity_id=`${domain}.renamed_${++sequence}`;
  registry.push({entity_id,device_id:device.id,platform,disabled_by:null,translation_key,unique_id:domain==='device_tracker'&&provider==='free'?mac:`${provider==='orange'?serial:mac}${provider==='free'?' ':'_'}${key}`,original_name:key});
  states[entity_id]={entity_id,state:String(state),attributes};return entity_id;
 };
 const entities={};
 if(provider==='free') {
  entities.download=add('sensor','rate_down',125,{unit_of_measurement:'kB/s'});
  entities.upload=add('sensor','rate_up',25,{unit_of_measurement:'kB/s'});
  entities.router=add('device_tracker','router','home',{IPv4:'203.0.113.42',uptime:'2026-09-17T14:06:18',firmware_version:'fixture-1'},null);
  entities.temperature=add('sensor','temp_cpu0',60,{unit_of_measurement:'°C',device_class:'temperature'},null);
  entities.fan=add('sensor','fan0_speed',660,{unit_of_measurement:'rpm'},null);
  entities.missed=add('sensor','missed',0,{unit_of_measurement:'calls'});
  entities.wifi=add('switch','wifi','on');entities.reboot=add('button','reboot','unknown',{},null);
 } else if(provider==='sfr') {
  entities.connection=add('binary_sensor','wan_status','on',{device_class:'connectivity'});
  entities.dsl=add('binary_sensor','dsl_status','on',{device_class:'connectivity'});
  entities.syncDown=add('sensor','dsl_rate_down',20000,{unit_of_measurement:'kbit/s'});
  entities.syncUp=add('sensor','dsl_rate_up',1000,{unit_of_measurement:'kbit/s'});
  entities.noise=add('sensor','dsl_noise_down',7,{unit_of_measurement:'dB'});
  entities.voltage=add('sensor','system_alimvoltage',12000,{unit_of_measurement:'mV'},null);
  entities.reboot=add('button','system_reboot','unknown',{},null);
 } else if(provider==='orange') {
  entities.connection=add('binary_sensor','connectivity','on',{device_class:'connectivity',wan_ipaddress:'203.0.113.43','wired clients':2,'wireless clients':3});
  entities.rx=add('sensor','fiber_power_rx',-19,{unit_of_measurement:'dBm','Temperature (°C)':40,'Voltage (V)':3.3,'ONU State':'O5'});
  entities.tx=add('sensor','fiber_power_tx',3,{unit_of_measurement:'dBm'});
  entities.volume=add('sensor','fiber_rx',12,{unit_of_measurement:'GB','Rx errors':0});
  entities.uptime=add('sensor','uptime',86400,{unit_of_measurement:'s'});
  entities.interface=add('sensor','HomeLan_rate_rx',12,{unit_of_measurement:'Mbit/s'});
  entities.wifi=add('switch','wifi','on',{},'wifi_switch');entities.guest=add('switch','guest_wifi','off');
  entities.reboot=add('button','restart','unknown',{},'restart_btn');
  entities.ddns=add('binary_sensor','ddns_0','on',{device_class:'problem'});
 } else {
  entities.download=add('sensor','current_down_bandwidth',100,{unit_of_measurement:'Mbit/s'});
  entities.upload=add('sensor','current_up_bandwidth',10,{unit_of_measurement:'Mbit/s'});
  entities.download_limit=add('sensor','down_max_bandwidth',1000,{unit_of_measurement:'Mbit/s'});
  entities.upload_limit=add('sensor','up_max_bandwidth',100,{unit_of_measurement:'Mbit/s'});
  entities.uptime=add('sensor','uptime','2026-10-31T08:00:00+00:00',{device_class:'timestamp'});
  entities.reboots=add('sensor','number_of_reboots',3);
  // Legacy Bbox has no stable registry contract: names must never be guessed.
  registry.splice(0);
 }
 return {registry,states,devices:[device],entities};
}
