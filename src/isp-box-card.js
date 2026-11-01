/* ISP Box Card — MIT. Uses only authenticated HA registry/state data. */
import { INTEGRATION_PROFILES, EXTRA_METRICS, resolveProviderConfig } from './provider-profiles.js';
export const VERSION = '0.2.0';
export const PROVIDERS = {
  free: { name: 'Free', color: '#ed3346', model: 'Freebox' },
  orange: { name: 'Orange', color: '#ff7900', model: 'Livebox' },
  bouygues: { name: 'Bouygues Telecom', color: '#00b6ce', model: 'Bbox' },
  sfr: { name: 'SFR', color: '#e52838', model: 'SFR Box' },
};
const METRICS = ['connection', 'download', 'upload', 'devices', 'ethernet_devices', 'wifi_devices', 'public_ip', 'uptime', 'optical_rx', 'optical_tx', 'wifi', 'guest_wifi', 'reboot', ...Object.keys(EXTRA_METRICS)];
const LABELS = { connection: 'Connexion Internet', download: 'Débit descendant', upload: 'Débit montant', devices: 'Appareils connectés', ethernet_devices: 'Appareils Ethernet', wifi_devices: 'Appareils Wi-Fi', public_ip: 'IP publique', uptime: 'Temps de fonctionnement', optical_rx: 'Puissance optique RX', optical_tx: 'Puissance optique TX', wifi: 'Wi-Fi principal', guest_wifi: 'Wi-Fi invité', reboot: 'Redémarrage', ...Object.fromEntries(Object.entries(EXTRA_METRICS).map(([key, value])=>[key,value.name])) };
const missing = value => value == null || ['', 'unknown', 'unavailable'].includes(value);
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const number = value => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value);

export function rateMbps(value, unit) {
  if (missing(value) || !Number.isFinite(Number(value))) return null;
  // Preserve case: bytes (B) and bits (b) are not interchangeable.
  const factors = { 'bit/s': 1e-6, 'b/s': 1e-6, 'kbit/s': .001, 'kbps': .001, 'Mbit/s': 1, 'Mbps': 1, 'Gbit/s': 1000, 'Gbps': 1000, 'B/s': 8e-6, 'kB/s': .008, 'KB/s': .008, 'MB/s': 8, 'GB/s': 8000 };
  return Object.hasOwn(factors, unit) && Number(value) >= 0 ? Number(value) * factors[unit] : null;
}
export function diagnosticValue(item, states) {
  const state = states?.[item.entity];
  const raw = item.attribute ? state?.attributes?.[item.attribute] : state?.state;
  if (!state || missing(state.state) || missing(raw)) return 'Indisponible';
  const value = String(raw), unit = item.unit ?? (item.attribute ? '' : state.attributes?.unit_of_measurement || '');
  if (item.kind === 'rate') {
    const mbps = rateMbps(value, unit); return mbps == null ? 'Unité non reconnue' : `${number(mbps)} Mbit/s`;
  }
  if (item.kind === 'duration') {
    const factors = {s:1000,min:60000,h:3600000,d:86400000};
    return Object.hasOwn(factors, unit) && Number.isFinite(Number(value)) ? durationLabel(Number(value)*factors[unit]) : value;
  }
  if (item.kind === 'binary' || (!item.attribute && (item.entity.startsWith('binary_sensor.') || item.entity.startsWith('switch.')))) {
    if (!['on', 'off', 'true', 'false'].includes(value)) return 'État inconnu';
    const positive = ['on', 'true'].includes(value);
    if (state.attributes?.device_class === 'problem') return positive ? 'Problème' : 'Normal';
    return state.attributes?.device_class === 'connectivity' ? positive ? 'Connecté' : 'Déconnecté' : positive ? 'Actif' : 'Inactif';
  }
  const numeric = Number(value);
  return `${value.trim() && Number.isFinite(numeric) ? number(numeric) : value}${unit ? ` ${unit}` : ''}`;
}
export function connectionState(value) {
  if (missing(value)) return 'unknown';
  if (['on', 'up', 'connected', 'online', 'Connected'].includes(value)) return 'online';
  if (['off', 'down', 'disconnected', 'offline', 'Disconnected'].includes(value)) return 'offline';
  return 'unknown';
}
export function startupMilliseconds(value, timeZone) {
  if (typeof value !== 'string') return null;
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const timestamp = Date.parse(value); return Number.isFinite(timestamp) ? timestamp : null;
  }
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (!parts || !timeZone) return null;
  const wall = Date.UTC(...parts.slice(1).map((part, index) => Number(part) - (index === 1 ? 1 : 0)));
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
    const asWall = timestamp => {
      const fields = Object.fromEntries(formatter.formatToParts(timestamp).map(part => [part.type, part.value]));
      return Date.UTC(Number(fields.year), Number(fields.month)-1, Number(fields.day), Number(fields.hour), Number(fields.minute), Number(fields.second));
    };
    let candidate = wall;
    for (let iteration=0; iteration<3; iteration++) candidate += wall-asWall(candidate);
    return asWall(candidate) === wall ? candidate : null;
  } catch { return null; }
}
export function durationLabel(milliseconds) {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return 'Indisponible';
  const minutes = Math.floor(milliseconds/60000), hours = Math.floor(minutes/60), days = Math.floor(hours/24);
  return days ? `${days} j ${hours%24} h` : hours ? `${hours} h ${minutes%60} min` : `${minutes} min`;
}
export function validateConfig(config) {
  if (!config || !Object.hasOwn(PROVIDERS, config.provider)) throw new Error('Choisir provider : free, orange, bouygues ou sfr.');
  for (const key of ['title', 'model', 'technology', 'image']) if (config[key] != null && typeof config[key] !== 'string') throw new Error(`${key} doit être un texte.`);
  if (config.image && (!/^\/(?!\/)/.test(config.image) || /[\\\x00-\x20]/.test(config.image))) throw new Error('image doit être un chemin local, par exemple /local/freebox-ultra.webp.');
  if (config.auto_detect != null && typeof config.auto_detect !== 'boolean') throw new Error('auto_detect doit être un booléen.');
  if (config.device_id != null && (typeof config.device_id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(config.device_id))) throw new Error('device_id invalide.');
  if (config.show_missing != null && typeof config.show_missing !== 'boolean') throw new Error('show_missing doit être un booléen.');
  if (config.show_controls != null && typeof config.show_controls !== 'boolean') throw new Error('show_controls doit être un booléen.');
  if (config.hide_public_ip != null && typeof config.hide_public_ip !== 'boolean') throw new Error('hide_public_ip doit être un booléen.');
  if (config.entities != null && (typeof config.entities !== 'object' || Array.isArray(config.entities))) throw new Error('entities doit être un objet.');
  for (const [key, entity] of Object.entries(config.entities || {})) {
    if (!METRICS.includes(key)) throw new Error(`Mesure inconnue : ${key}`);
    if (typeof entity !== 'string' || !/^[a-z_]+\.[a-z0-9_]+$/.test(entity)) throw new Error(`Entité invalide : ${key}`);
    if (['wifi', 'guest_wifi'].includes(key) && !entity.startsWith('switch.')) throw new Error(`${key} doit référencer un switch.`);
    if (key === 'reboot' && !entity.startsWith('button.')) throw new Error('reboot doit référencer un button.');
  }
  if (config.attributes != null && (typeof config.attributes !== 'object' || Array.isArray(config.attributes))) throw new Error('attributes doit être un objet.');
  for (const [key, attribute] of Object.entries(config.attributes || {})) {
    if (!['public_ip', 'uptime', 'ethernet_devices', 'wifi_devices'].includes(key) || typeof attribute !== 'string' || !attribute.trim()) throw new Error('Attribut invalide : seules IP, démarrage et compteurs clients acceptent un attribut nommé.');
  }
  for (const key of ['download_max', 'upload_max']) if (config[key] != null && (!Number.isFinite(config[key]) || config[key] <= 0)) throw new Error(`${key} doit être un nombre positif en Mbit/s.`);
  if (config.diagnostics != null && !Array.isArray(config.diagnostics)) throw new Error('diagnostics doit être une liste.');
  for (const item of config.diagnostics || []) {
    if (!item || typeof item.entity !== 'string' || !/^(sensor|binary_sensor|device_tracker|switch)\.[a-z0-9_]+$/.test(item.entity)) throw new Error('Diagnostic : entité de lecture invalide.');
    for (const key of ['name', 'attribute', 'unit']) if (item[key] != null && typeof item[key] !== 'string') throw new Error(`Diagnostic : ${key} doit être un texte.`);
    if (item.kind != null && !['text', 'rate', 'duration', 'binary'].includes(item.kind)) throw new Error('Format de diagnostic invalide.');
  }
  if (config.ports != null && !Array.isArray(config.ports)) throw new Error('ports doit être une liste.');
  for (const port of config.ports || []) {
    if (!port || typeof port.name !== 'string' || !port.name.trim()) throw new Error('Chaque port doit avoir un nom.');
    for (const key of ['download', 'upload']) if (port[key] != null && (typeof port[key] !== 'string' || !/^[a-z_]+\.[a-z0-9_]+$/.test(port[key]))) throw new Error(`Entité de port invalide : ${key}`);
  }
  return structuredClone(config);
}
const iconPaths = {
  wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/>',
  globe: '<circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><path d="M2 12h20M4 6h16M4 18h16"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 5v7l5 3"/>',
  devices: '<rect x="2" y="3" width="16" height="12" rx="1"/><path d="M1 19h16M20 10h3v12h-7v-5"/>',
  down: '<circle cx="12" cy="12" r="10"/><path d="M12 5v14m-5-5 5 5 5-5"/>',
  up: '<circle cx="12" cy="12" r="10"/><path d="M12 19V5m-5 5 5-5 5 5"/>',
  reboot: '<path d="M20 9a8 8 0 0 0-14-3L3 9m0-6v6h6M4 15a8 8 0 0 0 14 3l3-3m0 6v-6h-6"/>',
  port: '<path d="M3 3h18v14h-5v4H8v-4H3zM7 3v5m5-5v5m5-5v5"/>',
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name]}</svg>`;
const CSS = `
:host{display:block;container-type:inline-size;color:#f5f5f5;font-family:var(--paper-font-body1_-_font-family,Roboto,'Segoe UI',sans-serif);font-variant-numeric:tabular-nums}*{box-sizing:border-box}ha-card{display:block;background:#090a0b;color:#f5f5f5;border:0;border-radius:22px;padding:12px;box-shadow:none}.layout{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.tile,.hero{border:1px solid #303033;border-radius:19px;background:linear-gradient(135deg,#1c1d1f,#111214);min-width:0}.hero{grid-column:1/-1;overflow:hidden;position:relative;padding:22px 22px 0;background:radial-gradient(ellipse at 50% 100%,color-mix(in srgb,var(--accent) 23%,#090a0b),#0d0e0f 70%)}.heading{display:flex;align-items:center;gap:16px;position:relative;z-index:1}.brand{font-weight:800;font-size:19px;color:var(--accent);border-right:2px solid var(--accent);padding-right:16px}.titles{flex:1;min-width:0}.titles h2{font-size:clamp(21px,5.6cqi,40px);line-height:1.05;margin:0 0 6px;overflow-wrap:anywhere;text-transform:uppercase;letter-spacing:-.8px}.subtitle{color:#b8b8bd;text-transform:uppercase;letter-spacing:1px;font-size:clamp(10px,2.5cqi,14px)}.badge{font-size:12px;border:1px solid currentColor;border-radius:30px;padding:7px 10px;white-space:nowrap}.online{color:#39e76d}.offline{color:#ff5a66}.unknown{color:#b2b4bc}.box-stage{height:190px;display:grid;place-items:center;position:relative}.box-stage img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 12px 18px color-mix(in srgb,var(--accent) 30%,transparent))}.placeholder{display:flex;align-items:center;gap:12px;color:#aaaeb7;font-size:13px;text-align:left;max-width:280px;line-height:1.6}.placeholder .icon{color:var(--accent);width:56px;height:56px;flex-shrink:0}.tile{padding:18px;display:flex;gap:16px;align-items:center}.icon{width:40px;height:40px;flex-shrink:0;filter:drop-shadow(0 0 7px color-mix(in srgb,currentColor 25%,transparent))}.blue{color:#16b6ff}.green{color:#32e86a}.amber{color:#ffab2d}.content{min-width:0}.label{font-size:13px;color:#c3c4c9;margin-bottom:6px;line-height:1.35}.value{font-size:21px;font-weight:650;overflow-wrap:anywhere;line-height:1.25}.detail{font-size:12px;color:#a7a9b2;margin-top:5px}.gauge{display:block;text-align:center;padding:16px 12px 12px}.dial{position:relative;max-width:240px;margin:0 auto}.dial svg{display:block;width:100%;height:auto}.dial path{fill:none;stroke-width:16}.dial .track{stroke:#303236}.dial .arc{stroke:var(--gauge);stroke-linecap:butt}.reading{position:absolute;inset:45% 0 0;display:flex;flex-direction:column;justify-content:center;font-size:clamp(25px,6cqi,43px);font-weight:700;line-height:1.1}.reading small{font-size:13px;font-weight:500;margin-top:4px}.wide{grid-column:1/-1}.ports{display:block}.section-title{display:flex;align-items:center;gap:12px;font-weight:650;margin-bottom:16px;font-size:17px}.section-title .icon{width:28px;height:28px}.port-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:12px}.port{border-left:1px solid #36373a;padding-left:14px;font-size:13px;line-height:1.8;overflow-wrap:anywhere}.port-name{color:#c3c4c9}.wifi-panel{display:block}.wifi-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-top:1px solid #303033;font-size:13px}.wifi-row:first-of-type{border:0}button{font:inherit;cursor:pointer;color:inherit}button:focus-visible{outline:3px solid #69caff;outline-offset:4px}button:disabled{cursor:not-allowed;opacity:.5}.toggle{border:1px solid #45464a;border-radius:30px;background:#303236;min-width:58px;min-height:44px;font-weight:700}.toggle[aria-checked=true]{background:#126b31;border-color:#248e45;color:#bdffcf}.reboot{background:linear-gradient(135deg,#291315,#171011);border:1px solid #d4434e;text-align:left;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;min-height:154px;width:100%}.reboot .icon{color:#ff525e}.reboot strong{font-size:20px}.reboot small{font-size:12px;color:#c1aeb1;line-height:1.5;margin-top:10px}.error{color:#ffadb5;font-size:13px;padding:12px;grid-column:1/-1}.privacy{background:transparent;border:0;text-align:left;padding:0;min-height:44px}.privacy .detail{display:block}.image-error{color:#ffadb5;font-size:12px}.busy{opacity:.6}
@container(max-width:460px){ha-card{padding:8px}.layout{gap:8px}.hero{padding:16px 14px 0}.heading{gap:10px;flex-wrap:wrap}.brand{font-size:14px;padding-right:10px}.badge{font-size:10px;padding:5px 8px}.box-stage{height:150px}.tile{padding:13px;gap:9px}.tile>.icon{width:28px;height:28px}.label{font-size:11px}.value{font-size:17px}.detail{font-size:11px}.reboot strong{font-size:16px}.section-title{font-size:15px}.wifi-row{font-size:11px}}
@container(max-width:310px){.tile:not(.gauge){grid-column:1/-1}.badge{margin-left:auto}.brand{max-width:90px}.gauge{padding:12px 6px}.reading{font-size:25px}.label{font-size:11px}}
.diagnostic-panel{display:block}.diagnostic-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 22px;margin:0}.diagnostic{min-width:0;padding:10px 0;border-top:1px solid #33363a}.diagnostic dt{font-size:12px;color:#bfc3cc;overflow-wrap:anywhere}.diagnostic dd{font-size:18px;font-weight:600;margin:7px 0 0;overflow-wrap:anywhere}
/* Reference composition: illustrated header, compact facts, illuminated dials. */
.hero{background:radial-gradient(ellipse at 50% 85%,color-mix(in srgb,var(--accent) 26%,#090a0b),#0c0d0f 72%);padding-top:24px}.box-stage{height:230px;isolation:isolate}.box-stage:after{content:'';position:absolute;bottom:22px;width:62%;height:16px;border-radius:50%;background:var(--accent);opacity:.24;filter:blur(18px);z-index:-1}.box-stage img{max-width:530px;height:230px;object-fit:contain;filter:drop-shadow(0 20px 16px #0009)}.brand[data-provider=free]{font-family:Georgia,serif;font-style:italic;font-size:32px;letter-spacing:-2px;text-transform:lowercase}.brand[data-provider=orange]{background:#ff7900;color:#070707;border:0;letter-spacing:-1px;padding:14px 6px;align-self:stretch;display:grid;align-items:end}.titles h2{letter-spacing:-1px}.tile{min-height:104px}.gauge{padding-top:19px;min-height:210px}.gauge .label{font-size:15px;color:#f0f0f3;font-weight:500;margin-bottom:14px}.dial .track{stroke:color-mix(in srgb,var(--gauge) 8%,#25272b)}.dial .arc{stroke:var(--gauge)}.ticks{stroke:color-mix(in srgb,var(--gauge) 45%,#42505d);stroke-width:1}.gauge .label{color:var(--gauge)}.reading{inset:45% 0 3%;font-weight:650}.reading small{color:#bcc2cc}.gauge>.detail{margin-top:12px}.privacy{width:100%}.privacy .value{margin-top:6px;white-space:nowrap;font-size:clamp(11px,3.7cqi,21px);letter-spacing:-.35px}.wifi-row small{display:block;font-size:10px}.reboot{display:grid;grid-template-columns:40px minmax(0,1fr) 14px;column-gap:15px;align-content:center;align-items:center}.reboot>.icon{grid-column:1;grid-row:1/3;width:40px;height:40px}.reboot strong{grid-column:2;font-size:18px;line-height:1.35;overflow-wrap:anywhere}.reboot small{grid-column:2;margin-top:6px}.reboot-chevron{grid-column:3;grid-row:1/3;font-size:32px;color:#f5c2c7}.port-grid{gap:10px}.port:first-child{border:0;padding-left:0}.port .port-name{font-weight:600;margin-bottom:7px}.port{line-height:1.9}.wifi-panel{align-content:center}.wifi-row{gap:7px}.toggle{min-height:38px}.detail{overflow-wrap:anywhere}
@container(max-width:460px){.box-stage,.box-stage img{height:180px}.brand[data-provider=free]{font-size:25px}.hero{padding-top:18px}.tile{min-height:96px}.gauge{min-height:166px}.gauge .label{font-size:12px;margin-bottom:12px}.gauge>.detail{font-size:10px;margin-top:8px}.reboot{grid-template-columns:28px minmax(0,1fr);column-gap:8px}.reboot>.icon{width:28px;height:28px}.reboot strong{font-size:14px}.reboot-chevron{display:none}.reboot small{font-size:10px}.reading small{font-size:11px}.toggle{min-width:43px;min-height:44px}.wifi-row{flex-wrap:wrap}.port-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.port{border:0;padding:0}.ip-tile>.blue{display:none}.detail{font-size:12px}.reboot small{font-size:11px}.wifi-row small{font-size:11px}}
`;

export class IspBoxCard extends HTMLElement {
  static get version() { return VERSION; }
  constructor() {
    super(); this.attachShadow({ mode: 'open' }); this._revealed = false; this._busy = false;
    this.shadowRoot.addEventListener('click', event => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      if (target.dataset.action === 'privacy') { this._revealed = !this._revealed; this.render(); }
      else this.execute(target.dataset.action);
    });
  }
  setConfig(config) {
    this.config = validateConfig(config); this._effective = null;
    this._revealed = this.config.hide_public_ip === false;
    // Editing configuration also retries discovery after a permission/network failure.
    if(this._discoveryError)this._registry=null;
    this.render();this._watchRegistry();this._loadRegistry();
  }
  connectedCallback() { this._registry=null;this._watchRegistry();this._loadRegistry(); }
  disconnectedCallback() {
    this._stopWatchingRegistry();this._registry=null;this._registryLoading=false;
    this._registryRequest=(this._registryRequest||0)+1;
  }
  _stopWatchingRegistry() {
    const previous=this._watchedConnection;this._watchedConnection=null;this._watchToken=null;
    clearTimeout(this._registryTimer);
    if(this._readyListener)previous?.removeEventListener?.('ready',this._readyListener);
    this._readyListener=null;
    for(const unsubscribe of this._registryUnsubscribers||[]) {
      try { Promise.resolve(unsubscribe()).catch(()=>{}); } catch {}
    }
    this._registryUnsubscribers=[];
  }
  _watchRegistry() {
    const connection=this._hass?.connection;
    if(!this.isConnected||!this.config||this.config.auto_detect===false||!INTEGRATION_PROFILES[this.config.provider].automatic||typeof connection?.subscribeEvents!=='function') {
      this._stopWatchingRegistry();return;
    }
    if(this._watchedConnection===connection)return;
    this._stopWatchingRegistry();this._watchedConnection=connection;this._registryDirty=true;
    const token=this._watchToken={};
    const invalidate=()=>{
      if(this._watchedConnection!==connection||this._watchToken!==token)return;
      this._registryDirty=true;
      clearTimeout(this._registryTimer);
      // Coalesce event bursts; never poll the registries on every state update.
      this._registryTimer=setTimeout(()=>{
        if(this._watchedConnection!==connection||this._watchToken!==token)return;
        this._registry=null;this._loadRegistry();
      },100);
    };
    this._readyListener=invalidate;connection.addEventListener?.('ready',invalidate);
    for(const type of ['entity_registry_updated','device_registry_updated']) {
      Promise.resolve().then(()=>connection.subscribeEvents(invalidate,type)).then(unsubscribe=>{
        if(this._watchedConnection===connection&&this._watchToken===token)this._registryUnsubscribers.push(unsubscribe);
        else return unsubscribe();
      }).catch(()=>{}); // Explicit mappings remain usable when event access is refused.
    }
  }
  settings() { return this._effective || this.config; }
  async _loadRegistry() {
    const hass=this._hass;
    if (!this.config || this.config.auto_detect === false || !INTEGRATION_PROFILES[this.config.provider].automatic || typeof hass?.callWS !== 'function') return;
    const connection=hass.connection || hass.callWS;
    if(this._discoveryConnection===connection && (this._registryLoading || (this._registry && !this._registryDirty)))return;
    const request=this._registryRequest=(this._registryRequest||0)+1;
    this._discoveryConnection=connection;this._registryLoading=true;this._registryDirty=false;this._registry=null;this._discoveryError=null;
    try {
      const [registry,devices]=await Promise.all([hass.callWS({type:'config/entity_registry/list'}),hass.callWS({type:'config/device_registry/list'})]);
      if(this._registryRequest!==request)return;
      if(!Array.isArray(registry)||!Array.isArray(devices))throw new Error('Invalid registry payload');
      this._registry=registry;this._devices=devices;
    } catch { if(this._registryRequest===request){this._registry=[];this._discoveryError='Détection automatique indisponible : associez les entités manuellement.';} }
    finally {
      if(this._registryRequest===request){
        this._registryLoading=false;this._signature=null;this.render();
        if(this._registryDirty)queueMicrotask(()=>this._loadRegistry());
      }
    }
  }
  set hass(hass) {
    this._hass = hass;
    this._effective = this.config ? resolveProviderConfig(this.config,this._registry||[],hass?.states||{},this._devices||[]) : null;
    this._watchRegistry();this._loadRegistry();
    const effective=this.settings();
    const ids = [...Object.values(effective?.entities || {}), ...(effective?.diagnostics || []).map(item=>item.entity), ...(effective?.ports || []).flatMap(port => [port.download, port.upload])].filter(Boolean);
    const signature = JSON.stringify([Math.floor(Date.now() / 60000), ids.map(id => hass?.states?.[id])]);
    if (signature !== this._signature) { this._signature = signature; this.render(); }
  }
  getCardSize() { return 12; }
  getGridOptions() { return { columns: 12, min_columns: 6 }; }
  static getConfigElement() { return document.createElement('isp-box-card-editor'); }
  static getStubConfig() { return { type: 'custom:isp-box-card', provider: 'free', model: 'Freebox Ultra', auto_detect: true, entities: {}, hide_public_ip: true }; }
  entity(key) {
    const entity = this._hass?.states?.[this.settings()?.entities?.[key]];
    const attribute = this.settings()?.attributes?.[key];
    if (!entity || !attribute) return entity;
    if (missing(entity.state)) return { ...entity, attributes: {} };
    const value = entity.attributes?.[attribute];
    return { ...entity, state: value == null ? 'unavailable' : String(value), attributes: {} };
  }
  text(key) {
    const state = this.entity(key);
    if (!state || missing(state.state)) return 'Indisponible';
    if (key === 'uptime') {
      const startup = startupMilliseconds(state.state, this._hass?.config?.time_zone);
      if (startup != null) return durationLabel(Date.now()-startup);
      const localTimestamp = state.state.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}(?:\.\d+)?$/);
      // A timestamp without a zone is HA-local wall time, not necessarily browser-local time.
      if (localTimestamp) {
        const [, year, month, day, hour, minute] = localTimestamp;
        return `Depuis le ${day}/${month}/${year} à ${hour}:${minute}`;
      }
      if (state.attributes?.device_class === 'timestamp' || /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(state.state)) {
        const timestamp = Date.parse(state.state);
        return Number.isFinite(timestamp) && timestamp <= Date.now() ? `${number((Date.now() - timestamp) / 86400000)} jours` : 'Indisponible';
      }
      const factors = { s: 1/86400, min: 1/1440, h: 1/24, d: 1 };
      const unit = state.attributes?.unit_of_measurement;
      if (Object.hasOwn(factors, unit) && Number.isFinite(Number(state.state))) return `${number(Number(state.state) * factors[unit])} jours`;
    }
    const numeric = Number(state.state);
    return `${state.state.trim() !== '' && Number.isFinite(numeric) ? number(numeric) : state.state}${state.attributes?.unit_of_measurement ? ` ${state.attributes.unit_of_measurement}` : ''}`;
  }
  tile(key, glyph, color, detail = '') {
    const configured = Boolean(this.settings().entities?.[key]);
    if (!configured) detail = 'Source non associée';
    return `<section class="tile"><span class="${color}">${icon(glyph)}</span><div class="content"><div class="label">${LABELS[key]}</div><div class="value">${escape(configured ? this.text(key) : '—')}</div>${detail ? `<div class="detail">${escape(detail)}</div>` : ''}</div></section>`;
  }
  gauge(key, color) {
    const state = this.entity(key);
    const mbps = state ? rateMbps(state.state, state.attributes?.unit_of_measurement) : null;
    const limit=this.entity(`${key}_limit`);
    const maximum = this.settings()[`${key}_max`] ?? rateMbps(limit?.state,limit?.attributes?.unit_of_measurement);
    const percent = mbps == null || !maximum ? 0 : Math.min(100, mbps / maximum * 100);
    const ticks = Array.from({length:21}, (_, index) => {const angle=Math.PI-index*Math.PI/20;const inner=index%5===0?75:79;return `<line x1="${100+inner*Math.cos(angle)}" y1="${100-inner*Math.sin(angle)}" x2="${100+84*Math.cos(angle)}" y2="${100-84*Math.sin(angle)}"/>`;}).join('');
    const value = mbps == null ? '—' : number(mbps >= 1000 ? mbps / 1000 : mbps);
    const unit = mbps == null ? 'Indisponible / unité non reconnue' : mbps >= 1000 ? 'Gbit/s' : 'Mbit/s';
    return `<section class="tile gauge" style="--gauge:${color}"><div class="label">${LABELS[key]}</div><div class="dial"><svg viewBox="0 0 200 112" aria-hidden="true"><path class="track" d="M12 100a88 88 0 0 1 176 0"/><path class="arc" d="M12 100a88 88 0 0 1 176 0" pathLength="100" stroke-dasharray="${percent} 100"/><g class="ticks">${ticks}</g></svg><div class="reading">${value}<small>${unit}</small></div></div>${!maximum ? '<div class="detail">Trafic instantané</div>' : `<div class="detail">Échelle : ${number(maximum >= 1000 ? maximum/1000 : maximum)} ${maximum >= 1000 ? 'Gbit/s' : 'Mbit/s'}</div>`}</section>`;
  }
  async execute(key) {
    if (this._busy || (this._watchedConnection && (this._registryDirty||this._registryLoading)) || this.config.show_controls === false || !['wifi', 'guest_wifi', 'reboot'].includes(key)) return;
    const state = this.entity(key), entityId = this.settings().entities?.[key];
    if (!state || state.state === 'unavailable' || (key !== 'reboot' && missing(state.state)) || !this._hass?.callService) return;
    if (key !== 'reboot' && !['on', 'off'].includes(state.state)) return;
    const prompt = key === 'reboot' ? 'Redémarrer la box ? Internet sera momentanément interrompu.' : state.state === 'on' ? 'Désactiver ce Wi-Fi ? Les appareils connectés à ce réseau seront déconnectés.' : null;
    if (prompt && !window.confirm(prompt)) return;
    this._busy = true; this._error = ''; this.render();
    try { await this._hass.callService(key === 'reboot' ? 'button' : 'switch', key === 'reboot' ? 'press' : state.state === 'on' ? 'turn_off' : 'turn_on', { entity_id: entityId }); }
    catch { this._error = 'Commande refusée ou connexion perdue. Vérifiez les permissions et réessayez.'; }
    finally { this._busy = false; this.render(); }
  }
  render() {
    if (!this.config) return;
    this._effective=resolveProviderConfig(this.config,this._registry||[],this._hass?.states||{},this._devices||[]);
    const c = this.settings(), p = PROVIDERS[c.provider], has = key => Boolean(c.entities?.[key]);
    const show = key => has(key) || (c.show_missing && INTEGRATION_PROFILES[c.provider].fields.includes(key));
    const controls = c.show_controls !== false;
    const status = connectionState(this.entity('connection')?.state);
    const statusLabel = { online: 'Connectée', offline: 'Déconnectée', unknown: 'État inconnu' }[status];
    const content = [];
    content.push(`<header class="hero"><div class="heading"><div class="brand" data-provider="${c.provider}">${escape(p.name)}</div><div class="titles"><h2>${escape(c.title || c.model || p.model)}</h2><div class="subtitle">${escape(c.technology || 'Connexion Internet')}</div></div>${has('connection') ? `<span class="badge ${status}">● ${statusLabel}</span>` : `<span class="badge unknown">${escape(c._integration)}</span>`}</div><div class="box-stage">${c.image ? `<img src="${escape(c.image)}" alt="${escape(c.model || p.model)}">` : `<div class="placeholder">${icon('port')}<span>${escape(c.model || p.model)}<br>Ajoutez votre visuel de box<br>dans la configuration.</span></div>`}</div></header>`);
    if (show('connection')) content.push(`<section class="tile"><span class="${status}">${icon('wifi')}</span><div><div class="label">Connexion Internet</div><div class="value ${status}">${statusLabel}</div><div class="detail">${escape(c.technology || '')}</div></div></section>`);
    if (show('devices')) content.push(this.tile('devices', 'devices', 'blue', ['ethernet_devices', 'wifi_devices'].filter(has).map(key => `${this.text(key)} ${key === 'wifi_devices' ? 'Wi-Fi' : 'Ethernet'}`).join(' · ')));
    if (show('public_ip')) content.push(`<section class="tile ip-tile"><span class="blue">${icon('globe')}</span><button class="privacy content" data-action="privacy" aria-label="Afficher ou masquer l’adresse IP publique" aria-pressed="${this._revealed}"><span class="label">IP publique</span><div class="value">${escape(!this._revealed ? '••• ••• ••• •••' : this.text('public_ip'))}</div><span class="detail">Cliquer pour ${this._revealed ? 'masquer' : 'afficher'}</span></button></section>`);
    if (show('uptime')) content.push(this.tile('uptime', 'clock', 'amber', this.entity('uptime') && /^\d{4}-/.test(this.entity('uptime').state) ? `Démarrage : ${this.entity('uptime').state.replace('T', ' ')}` : ''));
    if (show('optical_rx')) content.push(this.tile('optical_rx', 'down', 'blue'));
    if (show('optical_tx')) content.push(this.tile('optical_tx', 'up', 'amber'));
    if (show('download')) content.push(this.gauge('download', '#10b5ff'));
    if (show('upload')) content.push(this.gauge('upload', '#2ce56b'));
    if (c.ports?.some(port=>port.download||port.upload)) {
      const rate = id => { const state = this._hass?.states?.[id]; const value = rateMbps(state?.state, state?.attributes?.unit_of_measurement); return value == null ? '—' : `${number(value)} Mbit/s`; };
      content.push(`<section class="tile wide ports"><div class="section-title"><span class="blue">${icon('port')}</span>Débits Ethernet</div><div class="port-grid">${(c.ports || [{name:'Ports non configurés'}]).map(port => `<div class="port"><div class="port-name">${escape(port.name)}</div><div><span class="blue">↓</span> ${rate(port.download)}</div><div><span class="amber">↑</span> ${rate(port.upload)}</div></div>`).join('')}</div></section>`);
    }
    if (c.diagnostics?.length || c._device_info?.length) content.push(`<section class="tile wide diagnostic-panel"><div class="section-title"><span class="amber">${icon('devices')}</span>Informations de la box</div><dl class="diagnostic-grid">${c.diagnostics.map(item => `<div class="diagnostic"><dt>${escape(item.name || this._hass?.states?.[item.entity]?.attributes?.friendly_name || item.entity)}</dt><dd>${escape(diagnosticValue(item, this._hass?.states))}</dd></div>`).join('')}${c._device_info.map(item=>`<div class="diagnostic"><dt>${escape(item.name)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl>${c.provider==='orange' ? `<p class="detail">${escape(INTEGRATION_PROFILES.orange.note)}</p>` : ''}</section>`);
    if (controls && (show('wifi') || show('guest_wifi'))) content.push(`<section class="tile wifi-panel"><div class="section-title"><span class="green">${icon('wifi')}</span>Réseau Wi-Fi</div>${['wifi', 'guest_wifi'].filter(show).map(key => { const value = this.entity(key)?.state; return `<div class="wifi-row"><span>${LABELS[key]}${has(key) ? '' : '<small class="detail">Source non associée</small>'}</span><button class="toggle" role="switch" aria-label="${LABELS[key]}" aria-checked="${value === 'on'}" data-action="${key}" ${this._busy || !['on', 'off'].includes(value) ? 'disabled' : ''}>${value === 'on' ? 'ON' : value === 'off' ? 'OFF' : '—'}</button></div>`; }).join('')}</section>`);
    if (controls && show('reboot')) content.push(`<button class="tile reboot" data-action="reboot" ${this._busy || !this.entity('reboot') || this.entity('reboot').state === 'unavailable' ? 'disabled' : ''}>${icon('reboot')}<strong>Redémarrer<br>${escape(c.model || p.model)}</strong><small>${has('reboot') ? 'Internet sera momentanément interrompu.' : 'Commande non associée'}</small><span class="reboot-chevron" aria-hidden="true">›</span></button>`);
    if (!Object.keys(c.entities || {}).length && !c.show_missing) content.push('<div class="tile wide detail">Associez les entités de votre intégration dans l’éditeur de la carte.</div>');
    if(c._notice || (this._discoveryError && !Object.keys(c.entities).length))content.push(`<div class="detail wide" role="status">${escape(c._notice||this._discoveryError)}</div>`);
    if (this._error) content.push(`<div class="error" role="alert">${escape(this._error)}</div>`);
    const focusedAction = this.shadowRoot.activeElement?.dataset.action;
    this.shadowRoot.innerHTML = `<style>${CSS}</style><ha-card style="--accent:${p.color}"><div class="layout" aria-busy="${this._busy}">${content.join('')}</div></ha-card>`;
    if (focusedAction) this.shadowRoot.querySelector(`[data-action="${focusedAction}"]`)?.focus();
    const image = this.shadowRoot.querySelector('img');
    if (image) image.addEventListener('error', () => { const text = document.createElement('span'); text.className = 'image-error'; text.textContent = 'Visuel introuvable — vérifiez le chemin local.'; image.replaceWith(text); }, { once: true });
  }
}

class IspBoxCardEditor extends HTMLElement {
  constructor() { super(); this.attachShadow({ mode: 'open' }); }
  setConfig(config) { this.config = structuredClone(config); this.render(); }
  set hass(hass) { this._hass = hass; const form = this.shadowRoot.querySelector('ha-form'); if (form) form.hass = hass; }
  render() {
    if (!this.config) return;
    this.shadowRoot.innerHTML = `<ha-form></ha-form><p>ISP Box Card ${VERSION} · Diagnostics additionnels et ports Ethernet : configuration YAML (voir README).</p>`;
    const form = this.shadowRoot.querySelector('ha-form');
    form.hass = this._hass;
    form.data = {auto_detect:true,show_controls:true,show_missing:false,hide_public_ip:true,...this.config};
    form.schema = [
      { name: 'provider', selector: { select: { options: Object.entries(PROVIDERS).map(([value, p]) => ({ value, label: p.name })) } } },
      ...(INTEGRATION_PROFILES[this.config.provider||'free'].automatic ? [{name:'device_id',selector:{device:{integration:INTEGRATION_PROFILES[this.config.provider||'free'].domain}}}] : []),
      ...['title', 'model', 'technology', 'image'].map(name => ({ name, selector: { text: {} } })),
      ...[...(INTEGRATION_PROFILES[this.config.provider||'free'].automatic ? ['auto_detect'] : []), 'hide_public_ip', 'show_missing', 'show_controls'].map(name => ({name,selector:{boolean:{}}})),
      ...['download_max', 'upload_max'].map(name => ({ name, selector: { number: { min: 1, mode: 'box', unit_of_measurement: 'Mbit/s' } } })),
      { name: 'attributes', type: 'expandable', title: 'Attributs optionnels (IP et démarrage)', schema: ['public_ip', 'uptime', 'ethernet_devices', 'wifi_devices'].filter(name=>INTEGRATION_PROFILES[this.config.provider||'free'].fields.includes(name)||this.config.attributes?.[name]).map(name => ({ name, selector: { text: {} } })) },
      { name: 'entities', type: 'expandable', title: 'Entités Home Assistant', schema: [...new Set([...INTEGRATION_PROFILES[this.config.provider||'free'].fields,...Object.keys(this.config.entities||{})])].map(name => ({ name, selector: { entity: ['wifi', 'guest_wifi'].includes(name) ? { domain: 'switch' } : name === 'reboot' ? { domain: 'button' } : {} } })) },
    ];
    const labels = { auto_detect:'Détecter les données de l’intégration', device_id:'Appareil box (requis si plusieurs)', provider: 'Opérateur', title: 'Titre personnalisé', model: 'Modèle de box', technology: 'Technologie (ex. Fibre XGS-PON)', image: 'Visuel local (ex. /local/freebox-ultra.webp)', show_missing: 'Afficher aussi les blocs non renseignés de la référence', show_controls: 'Afficher les commandes réseau', hide_public_ip: 'Masquer l’IP publique par défaut', download_max: 'Maximum descendant', upload_max: 'Maximum montant', entities: 'Entités', ...LABELS };
    form.computeLabel = field => labels[field.name] || field.name;
    form.addEventListener('value-changed', event => {
      event.stopPropagation();
      const next = { ...this.config, ...event.detail.value };
      const changedProvider=next.provider!==this.config.provider;
      if(changedProvider){next.entities={};next.attributes={};next.diagnostics=[];next.ports=[];next.model=PROVIDERS[next.provider].model;delete next.device_id;delete next.image;delete next.technology;delete next.download_max;delete next.upload_max;}
      next.entities = Object.fromEntries(Object.entries(next.entities || {}).filter(([, value]) => value));
      if (next.attributes) next.attributes = Object.fromEntries(Object.entries(next.attributes).filter(([, value]) => value));
      for (const key of ['download_max', 'upload_max']) if (next[key] === '' || next[key] == null) delete next[key];
      this.config = next;
      if(changedProvider)this.render();
      this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: next }, bubbles: true, composed: true }));
    });
  }
}
if (!customElements.get('isp-box-card')) customElements.define('isp-box-card', IspBoxCard);
if (!customElements.get('isp-box-card-editor')) customElements.define('isp-box-card-editor', IspBoxCardEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === 'isp-box-card')) window.customCards.push({ type: 'isp-box-card', name: 'ISP Box Card', description: 'Box Internet française : Free, Orange, Bouygues et SFR.', preview: true });
