import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.HTMLElement=class{};globalThis.customElements={get:()=>true};globalThis.window={};
const {validateConfig,appearanceStyle,PROVIDERS,COLOR_ROLES}=await import('../dist/isp-box-card.js');
test('Existing configurations inherit their provider palette without new overrides',()=>{
 for(const [provider,p] of Object.entries(PROVIDERS))assert.equal(appearanceStyle(validateConfig({provider})),`--accent:${p.color}`);
});
test('Layouts and bounded zero-valued spacing are copied without mutating the caller',()=>{
 const input={provider:'free',layout:'compact',appearance:{radius:0,gap:0,padding:0,colors:{accent:'#ABC',background:'#102030'}}};
 const config=validateConfig(input);config.appearance.colors.accent='#fff';assert.equal(input.appearance.colors.accent,'#ABC');
 assert.match(appearanceStyle(input),/--isp-radius:0px;--isp-gap:0px;--isp-padding:0px/);
 assert.match(appearanceStyle(input),/--accent:#ABC/);
});
test('Appearance rejects arbitrary CSS, unknown roles and invalid geometry',()=>{
 for(const layout of ['horizontal','',{},true])assert.throws(()=>validateConfig({provider:'free',layout}));
 for(const appearance of [true,[],{unknown:1},{radius:-1},{radius:41},{gap:25},{padding:33},{gap:1.5},{padding:'4'},{radius:Infinity},{colors:[]},{colors:{unknown:'#fff'}}])assert.throws(()=>validateConfig({provider:'free',appearance}));
 for(const color of ['red','var(--x)','url(https://example.com)','rgb(0,0,0)','#123;display:none','</style>','#1234','#12345678',[],12])assert.throws(()=>validateConfig({provider:'free',appearance:{colors:{accent:color}}}));
});
test('Every documented color role is accepted and custom colors are card-scoped declarations',()=>{
 const colors=Object.fromEntries(Object.keys(COLOR_ROLES).map(key=>[key,'#abcDEF']));
 const style=appearanceStyle(validateConfig({provider:'orange',appearance:{colors,radius:40,gap:24,padding:32}}));
 for(const key of Object.keys(colors))assert(style.includes(`${key==='accent'?'--accent':'--isp-'+key}:#abcDEF`));
 assert.match(style,/--isp-danger-surface:color-mix/);assert.match(style,/--isp-success-surface:color-mix/);
});
