(()=>{
'use strict';

const VERSION='1.1.0';
const KEYS={
  prices:'lpp.prices.v1',
  legacyQuote:'lpp.quote.v1',
  custom:'lpp.custom.v1',
  quotes:'lpp.quotes.v1',
  active:'lpp.activeQuote.v1'
};
const ITEM_SOURCES=[
  'https://cdn.jsdelivr.net/gh/PrismarineJS/minecraft-data@master/data/pc/1.21.11/items.json',
  'https://raw.githubusercontent.com/PrismarineJS/minecraft-data/master/data/pc/1.21.11/items.json'
];
const LANG_SOURCES=[
  'https://mcasset.cloud/1.21.11/assets/minecraft/lang/pl_pl.json',
  'https://cdn.jsdelivr.net/gh/InventivetalentDev/minecraft-assets@1.21.11/assets/minecraft/lang/pl_pl.json'
];
const RECIPE_BASES=[
  'https://cdn.jsdelivr.net/gh/un-pogaz/MC-generated-data@1.21.11/data/minecraft/recipe/',
  'https://raw.githubusercontent.com/un-pogaz/MC-generated-data/1.21.11/data/minecraft/recipe/'
];
const FALLBACK_ITEMS=[
  ['stone','Stone','Kamień',64],['granite','Granite','Granit',64],['diorite','Diorite','Dioryt',64],['andesite','Andesite','Andezyt',64],['deepslate','Deepslate','Łupek',64],['cobbled_deepslate','Cobbled Deepslate','Brukowany łupek',64],['calcite','Calcite','Kalcyt',64],['tuff','Tuff','Tuf',64],['cobblestone','Cobblestone','Bruk',64],['dirt','Dirt','Ziemia',64],['sand','Sand','Piasek',64],['gravel','Gravel','Żwir',64],['coal','Coal','Węgiel',64],['iron_ingot','Iron Ingot','Sztabka żelaza',64],['gold_ingot','Gold Ingot','Sztabka złota',64],['diamond','Diamond','Diament',64],['emerald','Emerald','Szmaragd',64],['redstone','Redstone Dust','Redstone',64],['oak_log','Oak Log','Dębowa kłoda',64],['spruce_log','Spruce Log','Świerkowa kłoda',64],['oak_planks','Oak Planks','Dębowe deski',64],['spruce_planks','Spruce Planks','Świerkowe deski',64],['sculk','Sculk','Sculk',64],['sculk_vein','Sculk Vein','Żyła sculku',64],['sculk_catalyst','Sculk Catalyst','Katalizator sculku',64],['sculk_shrieker','Sculk Shrieker','Wrzeszczący sculk',64],['sculk_sensor','Sculk Sensor','Czujnik sculku',64],['calibrated_sculk_sensor','Calibrated Sculk Sensor','Skalibrowany czujnik sculku',64]
].map(([name,displayName,plName,stackSize],id)=>({id,name,displayName,plName,stackSize,fallback:true}));

const $=s=>document.querySelector(s);
const els={
  dbStatus:$('#dbStatus'),quoteList:$('#quoteList'),lineCount:$('#lineCount'),itemCount:$('#itemCount'),grandTotal:$('#grandTotal'),
  itemDialog:$('#itemDialog'),itemForm:$('#itemForm'),itemSearch:$('#itemSearch'),suggestions:$('#suggestions'),selectedPreview:$('#selectedPreview'),
  stacks:$('#stacksInput'),pieces:$('#piecesInput'),unitPrice:$('#unitPriceInput'),recipeBox:$('#recipeBox'),
  priceDialog:$('#priceLibraryDialog'),priceSearch:$('#priceLibrarySearch'),priceList:$('#priceLibraryList')
};
const state={catalog:[],lang:{},prices:{},custom:[],quotes:[],activeId:'',selected:null,applyingRemote:false};

function parseJSON(raw,fallback){try{return JSON.parse(raw)??fallback}catch{return fallback}}
function load(key,fallback){return parseJSON(localStorage.getItem(key),fallback)}
function clone(v){return JSON.parse(JSON.stringify(v??null))}
function now(){return new Date().toISOString()}
function uid(){return 'q-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function money(n){return Number(n||0).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})}
function normalize(v){return String(v||'').toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]+/g,' ').trim()}
function prettyId(id){return String(id||'').split('_').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ')}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function activeQuote(){return state.quotes.find(q=>q&&q.id===state.activeId)||state.quotes[0]||null}
function activeItems(){const q=activeQuote();return Array.isArray(q?.items)?q.items:[]}
function ensureQuotes(){
  if(!Array.isArray(state.quotes)||!state.quotes.length){
    const legacy=load(KEYS.legacyQuote,[]);
    state.quotes=[{id:uid(),name:'Wycena 1',status:'active',items:Array.isArray(legacy)?legacy:[],createdAt:now(),updatedAt:now(),completedAt:null}];
  }
  if(!state.quotes.some(q=>q&&q.id===state.activeId))state.activeId=state.quotes[0].id;
  for(const q of state.quotes){
    if(!Array.isArray(q.items))q.items=[];
    if(!q.name)q.name='Wycena';
    if(q.status!=='done')q.status='active';
    if(!q.createdAt)q.createdAt=now();
    if(!q.updatedAt)q.updatedAt=q.createdAt;
    if(q.completedAt===undefined)q.completedAt=null;
  }
}
function emitChange(){if(!state.applyingRemote)window.dispatchEvent(new CustomEvent('lpp:data-changed'))}
function persist(notify=true){
  ensureQuotes();
  localStorage.setItem(KEYS.prices,JSON.stringify(state.prices));
  localStorage.setItem(KEYS.custom,JSON.stringify(state.custom));
  localStorage.setItem(KEYS.quotes,JSON.stringify(state.quotes));
  localStorage.setItem(KEYS.active,state.activeId);
  localStorage.setItem(KEYS.legacyQuote,JSON.stringify(activeItems()));
  if(notify)emitChange();
}
function loadLocal(){
  state.prices=load(KEYS.prices,{});if(!state.prices||typeof state.prices!=='object'||Array.isArray(state.prices))state.prices={};
  state.custom=load(KEYS.custom,[]);if(!Array.isArray(state.custom))state.custom=[];
  state.quotes=load(KEYS.quotes,[]);if(!Array.isArray(state.quotes))state.quotes=[];
  state.activeId=localStorage.getItem(KEYS.active)||'';
  ensureQuotes();persist(false);
}
function touchQuote(q=activeQuote()){if(q)q.updatedAt=now()}
function getCloudState(){return{quotes:clone(state.quotes),prices:clone(state.prices),custom_items:clone(state.custom),active_quote_id:state.activeId||null}}
function applyRemote(remote){
  state.applyingRemote=true;
  try{
    state.quotes=Array.isArray(remote?.quotes)?clone(remote.quotes):[];
    state.prices=remote?.prices&&typeof remote.prices==='object'&&!Array.isArray(remote.prices)?clone(remote.prices):{};
    state.custom=Array.isArray(remote?.custom_items)?clone(remote.custom_items):[];
    state.activeId=remote?.active_quote_id||'';
    ensureQuotes();persist(false);mergeCustomIntoCatalog();renderAll();
  }finally{state.applyingRemote=false}
}

function fallbackIconData(name){const label=esc((name||'?').split('_').map(x=>x[0]).join('').slice(0,3).toUpperCase());return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect rx="12" width="64" height="64" fill="#18202b"/><text x="32" y="38" text-anchor="middle" fill="#8fbaff" font-family="Arial" font-size="18" font-weight="700">${label}</text></svg>`)}`}
function attachIcon(img,name){const candidates=[`https://mcasset.cloud/1.21.11/assets/minecraft/textures/item/${name}.png`,`https://mcasset.cloud/1.21.11/assets/minecraft/textures/block/${name}.png`];let i=0;img.onerror=()=>{i++;img.src=i<candidates.length?candidates[i]:fallbackIconData(name);if(i>=candidates.length)img.onerror=null};img.src=candidates[0]}
async function fetchJSON(url,timeout=12000){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch(url,{cache:'force-cache',signal:ctrl.signal});if(!r.ok)throw new Error(String(r.status));return await r.json()}finally{clearTimeout(t)}}
async function firstJSON(urls){let last;for(const url of urls){try{return await fetchJSON(url)}catch(e){last=e}}throw last||new Error('Brak źródła')}
function mergeCustomIntoCatalog(){
  const names=new Set(state.catalog.map(x=>x.name));
  for(const c of state.custom){if(c?.name&&!names.has(c.name)){state.catalog.push({...c,custom:true});names.add(c.name)}}
  state.catalog.sort((a,b)=>(a.displayName||a.name).localeCompare(b.displayName||b.name,'en'));
}
async function loadDatabase(){
  els.dbStatus.textContent='Pobieram bazę Minecraft Java 1.21.11…';
  let base;try{base=await firstJSON(ITEM_SOURCES)}catch{base=FALLBACK_ITEMS}
  try{state.lang=await firstJSON(LANG_SOURCES)}catch{state.lang={}}
  state.catalog=(Array.isArray(base)?base:[]).filter(x=>x&&x.name&&x.name!=='air').map(x=>{
    const keyBlock=`block.minecraft.${x.name}`,keyItem=`item.minecraft.${x.name}`;
    return {...x,plName:state.lang[keyBlock]||state.lang[keyItem]||x.plName||''};
  });
  for(const fb of FALLBACK_ITEMS){if(!state.catalog.some(x=>x.name===fb.name))state.catalog.push(fb)}
  mergeCustomIntoCatalog();
  const source=base===FALLBACK_ITEMS?'tryb awaryjny':'pełna baza';
  els.dbStatus.textContent=`Minecraft 1.21.11 • ${state.catalog.length} przedmiotów • ${source}`;
  renderAll();
}

function searchItems(q){
  const n=normalize(q);if(!n)return [];
  return state.catalog.map(item=>{const hay=[item.name,item.displayName,item.plName].map(normalize);let score=99;for(const h of hay){if(h===n)score=Math.min(score,0);else if(h.startsWith(n))score=Math.min(score,1);else if(h.includes(n))score=Math.min(score,2)}return{item,score}})
    .filter(x=>x.score<99).sort((a,b)=>a.score-b.score||String(a.item.displayName||'').localeCompare(String(b.item.displayName||''))).slice(0,30).map(x=>x.item);
}
function renderSuggestions(){
  const q=els.itemSearch.value.trim(),matches=searchItems(q);els.suggestions.innerHTML='';
  for(const item of matches){
    const row=document.createElement('div');row.className='suggestion';const img=document.createElement('img');attachIcon(img,item.name);
    const text=document.createElement('div');const strong=document.createElement('strong');strong.textContent=item.displayName||prettyId(item.name);const small=document.createElement('small');small.textContent=item.plName||item.name;text.append(strong,small);
    const meta=document.createElement('small');meta.textContent=`stack ${item.stackSize||64}`;row.append(img,text,meta);row.onclick=()=>selectItem(item);els.suggestions.append(row);
  }
  if(q&&!matches.length){const row=document.createElement('div');row.className='suggestion';const spacer=document.createElement('div'),text=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small'),badge=document.createElement('span');strong.textContent=`Dodaj „${q}” jako własny przedmiot`;small.textContent='Nie znaleziono w bazie. Domyślny stack: 64';badge.className='custom-badge';badge.textContent='WŁASNY';text.append(strong,small);row.append(spacer,text,badge);row.onclick=selectCustomFromInput;els.suggestions.append(row)}
}
function selectItem(item){
  state.selected=item;els.itemSearch.value=item.displayName||prettyId(item.name);els.suggestions.innerHTML='';els.selectedPreview.classList.remove('hidden');
  els.selectedPreview.textContent='';const strong=document.createElement('strong');strong.textContent=item.displayName||prettyId(item.name);els.selectedPreview.append(strong,document.createTextNode(item.plName?` • ${item.plName}`:''),document.createElement('br'));const small=document.createElement('small');small.textContent=`ID: ${item.name} • stack: ${item.stackSize||64}`;els.selectedPreview.append(small);
  els.unitPrice.value=state.prices[item.name]??0;loadRecipe(item.name);
}
function selectCustomFromInput(){
  const raw=els.itemSearch.value.trim();if(!raw)return;
  const slug=normalize(raw).replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,'').slice(0,80)||`custom_${Date.now()}`;
  let name=slug,i=2;while(state.catalog.some(x=>x.name===name)&&!state.custom.some(x=>x.name===name))name=`${slug}_${i++}`;
  let custom=state.custom.find(x=>x.name===name);
  if(!custom){custom={id:`custom-${Date.now()}`,name,displayName:raw,plName:raw,stackSize:64,custom:true};state.custom.push(custom);state.catalog.push(custom);persist();}
  selectItem(custom);
}
async function loadRecipe(name){els.recipeBox.classList.add('hidden');els.recipeBox.textContent='';if(state.selected?.custom)return;for(const base of RECIPE_BASES){try{const data=await fetchJSON(`${base}${encodeURIComponent(name)}.json`,6000);const text=recipeSummary(data);if(text){els.recipeBox.textContent=text;els.recipeBox.classList.remove('hidden')}return}catch{}}}
function ingredientId(v){if(Array.isArray(v))v=v[0];if(typeof v==='string')return v.replace('minecraft:','');if(v?.item)return String(v.item).replace('minecraft:','');return''}
function recipeSummary(r){
  if(!r||typeof r!=='object')return'';
  if(r.type?.includes('crafting_shaped')&&r.pattern&&r.key){const counts={};for(const line of r.pattern)for(const ch of line){if(ch===' ')continue;const id=ingredientId(r.key[ch]);if(id)counts[id]=(counts[id]||0)+1}return 'Receptura: '+Object.entries(counts).map(([k,v])=>`${v}× ${prettyId(k)}`).join(', ')}
  if(r.type?.includes('crafting_shapeless')&&Array.isArray(r.ingredients)){const counts={};for(const ing of r.ingredients){const id=ingredientId(ing);if(id)counts[id]=(counts[id]||0)+1}return 'Receptura: '+Object.entries(counts).map(([k,v])=>`${v}× ${prettyId(k)}`).join(', ')}
  return'';
}

function openAdd(){state.selected=null;els.itemForm.reset();els.stacks.value=0;els.pieces.value=1;els.unitPrice.value=0;els.itemSearch.value='';els.suggestions.innerHTML='';els.selectedPreview.classList.add('hidden');els.recipeBox.classList.add('hidden');els.itemDialog.showModal();setTimeout(()=>els.itemSearch.focus(),50)}
function confirmAdd(ev){
  ev.preventDefault();if(!state.selected){if(els.itemSearch.value.trim())selectCustomFromInput();else return}
  const item=state.selected,stacks=Math.max(0,Math.floor(Number(els.stacks.value)||0)),pieces=Math.max(0,Math.floor(Number(els.pieces.value)||0)),qty=stacks*(item.stackSize||64)+pieces;
  if(qty<=0){els.pieces.value=1;return}
  const unit=Math.max(0,Number(els.unitPrice.value)||0),q=activeQuote();if(!q)return;
  q.items.push({key:`${Date.now()}-${Math.random()}`,name:item.name,displayName:item.displayName||prettyId(item.name),plName:item.plName||'',stackSize:item.stackSize||64,qty,unit,custom:!!item.custom});
  state.prices[item.name]=unit;touchQuote(q);persist();els.itemDialog.close();renderAll();
}
function removeLine(key){const q=activeQuote();if(!q)return;q.items=q.items.filter(x=>x.key!==key);touchQuote(q);persist();renderAll()}
function clearQuote(){const q=activeQuote();if(!q||!q.items.length)return;if(confirm('Wyczyścić całą wycenę?')){q.items=[];touchQuote(q);persist();renderAll()}}
function renderQuote(){
  const items=activeItems();els.quoteList.innerHTML='';
  if(!items.length){els.quoteList.className='quote-list empty-state';els.quoteList.textContent='Brak przedmiotów. Dodaj pierwszy element do wyceny.'}
  else{
    els.quoteList.className='quote-list';
    for(const line of items){const node=$('#quoteTemplate').content.firstElementChild.cloneNode(true);attachIcon(node.querySelector('.item-icon'),line.name);node.querySelector('.item-name').textContent=line.displayName+(line.plName&&line.plName!==line.displayName?` • ${line.plName}`:'');node.querySelector('.item-id').textContent=line.custom?`${line.name} • własny`:`minecraft:${line.name}`;const stack=line.stackSize||64,full=Math.floor(line.qty/stack),rem=line.qty%stack;node.querySelector('.item-qty').textContent=`${line.qty} szt. • ${full} stack${full===1?'':'i'}${rem?` + ${rem}`:''} • ${money(line.unit)} / szt.`;node.querySelector('.item-price').textContent=money(line.qty*line.unit);node.querySelector('.delete-btn').onclick=()=>removeLine(line.key);els.quoteList.append(node)}
  }
  const totalQty=items.reduce((s,x)=>s+(Number(x.qty)||0),0),total=items.reduce((s,x)=>s+(Number(x.qty)||0)*(Number(x.unit)||0),0);els.lineCount.textContent=items.length;els.itemCount.textContent=totalQty.toLocaleString('pl-PL');els.grandTotal.textContent=money(total);
}

function renderPriceLibrary(){
  const q=normalize(els.priceSearch.value);const rows=Object.entries(state.prices).map(([name,price])=>{const item=state.catalog.find(x=>x.name===name);return{name,price,item,display:item?.displayName||prettyId(name),pl:item?.plName||''}}).filter(x=>!q||normalize(`${x.name} ${x.display} ${x.pl}`).includes(q)).sort((a,b)=>a.display.localeCompare(b.display,'pl'));
  els.priceList.innerHTML='';if(!rows.length){els.priceList.innerHTML='<div class="empty-state" style="min-height:180px">Brak zapisanych cen.</div>';return}
  for(const r of rows){const row=document.createElement('div');row.className='price-row';const name=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=r.display;small.textContent=r.pl||r.name;name.append(strong,small);const input=document.createElement('input');input.type='number';input.min='0';input.step='0.01';input.value=r.price;input.onchange=()=>{state.prices[r.name]=Math.max(0,Number(input.value)||0);const aq=activeQuote();for(const line of aq?.items||[])if(line.name===r.name)line.unit=state.prices[r.name];touchQuote(aq);persist();renderAll()};const del=document.createElement('button');del.className='delete-btn danger';del.textContent='×';del.onclick=()=>{delete state.prices[r.name];persist();renderPriceLibrary()};row.append(name,input,del);els.priceList.append(row)}
}

function quoteTotal(q){return(q?.items||[]).reduce((s,x)=>s+(Number(x.qty)||0)*(Number(x.unit)||0),0)}
function quoteQty(q){return(q?.items||[]).reduce((s,x)=>s+(Number(x.qty)||0),0)}
function fmtDate(v){if(!v)return'—';try{return new Date(v).toLocaleString('pl-PL',{dateStyle:'short',timeStyle:'short'})}catch{return String(v)}}
function updateQuoteHeader(){const q=activeQuote();const title=$('#activeQuoteName'),badge=$('#activeQuoteStatus');if(title)title.textContent=q?.name||'Wycena';if(badge){const done=q?.status==='done';badge.textContent=done?'ZREALIZOWANO':'W TRAKCIE';badge.className='quote-status '+(done?'done':'active')}}
function createQuote(){const suggested=`Wycena ${state.quotes.length+1}`,name=prompt('Nazwa nowej wyceny:',suggested);if(name===null)return;const q={id:uid(),name:name.trim()||suggested,status:'active',items:[],createdAt:now(),updatedAt:now(),completedAt:null};state.quotes.unshift(q);state.activeId=q.id;persist();renderAll()}
function renameQuote(id){const q=state.quotes.find(x=>x.id===id);if(!q)return;const name=prompt('Nowa nazwa wyceny:',q.name);if(name===null||!name.trim())return;q.name=name.trim();touchQuote(q);persist();renderAll();if($('#quoteLibraryDialog')?.open)renderQuoteLibrary()}
function setActiveQuote(id){if(!state.quotes.some(q=>q.id===id))return;state.activeId=id;persist();renderAll();$('#quoteLibraryDialog')?.close()}
function toggleDone(id){const q=state.quotes.find(x=>x.id===id);if(!q)return;if(q.status==='done'){q.status='active';q.completedAt=null}else{q.status='done';q.completedAt=now()}touchQuote(q);persist();renderAll();renderQuoteLibrary()}
function deleteQuote(id){if(state.quotes.length<=1){alert('Musi zostać przynajmniej jedna wycena.');return}const q=state.quotes.find(x=>x.id===id);if(!q||!confirm(`Usunąć wycenę „${q.name}”?`))return;state.quotes=state.quotes.filter(x=>x.id!==id);if(state.activeId===id)state.activeId=state.quotes[0].id;persist();renderAll();renderQuoteLibrary()}
function renderQuoteLibrary(){
  const list=$('#quoteLibraryList');if(!list)return;const query=($('#quoteLibrarySearch')?.value||'').toLocaleLowerCase('pl').trim(),filter=$('#quoteLibraryFilter')?.value||'all';const rows=state.quotes.filter(q=>(!query||q.name.toLocaleLowerCase('pl').includes(query))&&(filter==='all'||q.status===filter)).sort((a,b)=>a.status===b.status?new Date(b.updatedAt||0)-new Date(a.updatedAt||0):(a.status==='done'?1:-1));
  if(!rows.length){list.innerHTML='<div class="ql-empty">Brak wycen pasujących do filtrów.</div>';return}
  list.innerHTML=rows.map(q=>`<article class="ql-card ${q.status==='done'?'is-done':''} ${q.id===state.activeId?'is-current':''}"><div class="ql-main"><div class="ql-title-row"><strong>${esc(q.name)}</strong><span class="ql-badge ${q.status==='done'?'done':'active'}">${q.status==='done'?'ZREALIZOWANO':'W TRAKCIE'}</span>${q.id===state.activeId?'<span class="ql-current">AKTUALNA</span>':''}</div><div class="ql-meta">${q.items.length} pozycji • ${quoteQty(q).toLocaleString('pl-PL')} szt. • ${money(quoteTotal(q))}</div><div class="ql-date">Ostatnia zmiana: ${fmtDate(q.updatedAt)}${q.completedAt?` • Zrealizowano: ${fmtDate(q.completedAt)}`:''}</div></div><div class="ql-actions"><button class="secondary ql-open" data-id="${esc(q.id)}">${q.id===state.activeId?'Otwarta':'Otwórz'}</button><button class="secondary ql-done" data-id="${esc(q.id)}">${q.status==='done'?'Przywróć':'Zrealizowano'}</button><button class="ghost ql-rename" data-id="${esc(q.id)}">Zmień nazwę</button><button class="delete-btn danger ql-delete" data-id="${esc(q.id)}">×</button></div></article>`).join('');
  list.querySelectorAll('.ql-open').forEach(b=>b.onclick=()=>setActiveQuote(b.dataset.id));list.querySelectorAll('.ql-done').forEach(b=>b.onclick=()=>toggleDone(b.dataset.id));list.querySelectorAll('.ql-rename').forEach(b=>b.onclick=()=>renameQuote(b.dataset.id));list.querySelectorAll('.ql-delete').forEach(b=>b.onclick=()=>deleteQuote(b.dataset.id));
}
function installQuoteUI(){
  const top=$('.top-actions');if(top){const lib=document.createElement('button');lib.id='quoteLibraryBtn';lib.className='secondary';lib.textContent='Biblioteka wycen';lib.onclick=()=>{renderQuoteLibrary();$('#quoteLibraryDialog').showModal()};const add=document.createElement('button');add.id='newQuoteBtn';add.className='secondary';add.textContent='+ Nowa wycena';add.onclick=createQuote;top.prepend(add);top.prepend(lib)}
  const head=$('.panel .section-head > div');if(head){const oldH=head.querySelector('h2');if(oldH)oldH.style.display='none';const wrap=document.createElement('div');wrap.className='active-quote-head';wrap.innerHTML='<div><h2 id="activeQuoteName">Wycena</h2><span id="activeQuoteStatus" class="quote-status active">W TRAKCIE</span><button id="renameActiveQuoteBtn" type="button" class="ghost">Zmień nazwę</button></div>';head.prepend(wrap);wrap.querySelector('#renameActiveQuoteBtn').onclick=()=>renameQuote(state.activeId)}
  const d=document.createElement('dialog');d.id='quoteLibraryDialog';d.className='modal';d.innerHTML=`<div class="modal-card glass modal-large ql-modal"><div class="modal-head"><div><div class="eyebrow">Wyceny</div><h2>Biblioteka wycen</h2></div><button id="closeQuoteLibrary" class="icon-btn">×</button></div><div class="ql-toolbar"><input id="quoteLibrarySearch" class="search-input" placeholder="Szukaj wyceny…"><select id="quoteLibraryFilter" class="ql-filter"><option value="all">Wszystkie</option><option value="active">W trakcie</option><option value="done">Zrealizowane</option></select><button id="newQuoteInLibrary" class="primary">+ Nowa wycena</button></div><div id="quoteLibraryList" class="ql-list"></div></div>`;document.body.append(d);d.querySelector('#closeQuoteLibrary').onclick=()=>d.close();d.querySelector('#newQuoteInLibrary').onclick=()=>{d.close();createQuote()};d.querySelector('#quoteLibrarySearch').oninput=renderQuoteLibrary;d.querySelector('#quoteLibraryFilter').onchange=renderQuoteLibrary;
  const style=document.createElement('style');style.textContent=`.active-quote-head>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.active-quote-head h2{margin:0}.quote-status,.ql-badge,.ql-current{font-size:10px;font-weight:800;letter-spacing:.08em;padding:5px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.12)}.quote-status.active,.ql-badge.active{background:rgba(86,156,255,.12);color:#9dc3ff}.quote-status.done,.ql-badge.done{background:rgba(117,129,145,.12);color:#a7b0bd}.ql-current{background:rgba(127,92,255,.16);color:#c7b9ff}.ql-modal{width:min(1050px,94vw);max-height:88vh}.ql-toolbar{display:grid;grid-template-columns:1fr 170px auto;gap:10px;margin-bottom:14px}.ql-filter{background:#0e1420;color:#e8edf5;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:0 12px}.ql-list{display:flex;flex-direction:column;gap:10px;overflow:auto;min-height:240px;max-height:60vh;padding-right:4px}.ql-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:16px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.035)}.ql-card.is-current{border-color:rgba(127,92,255,.55)}.ql-card.is-done{opacity:.58}.ql-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ql-title-row strong{font-size:17px}.ql-meta{margin-top:7px;color:#c3cad5}.ql-date{margin-top:4px;font-size:12px;color:#7f8999}.ql-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.ql-empty{display:grid;place-items:center;min-height:220px;color:#7f8999}#renameActiveQuoteBtn{padding:7px 10px;font-size:12px}@media(max-width:760px){.top-actions{flex-wrap:wrap}.ql-toolbar{grid-template-columns:1fr}.ql-filter{min-height:44px}.ql-card{grid-template-columns:1fr}.ql-actions{justify-content:flex-start}.active-quote-head>div{align-items:flex-start}}`;document.head.append(style);
}
function renderAll(){renderQuote();updateQuoteHeader();if(els.priceDialog?.open)renderPriceLibrary();if($('#quoteLibraryDialog')?.open)renderQuoteLibrary()}

loadLocal();installQuoteUI();renderAll();
$('#addBtn').onclick=openAdd;$('#clearBtn').onclick=clearQuote;els.itemSearch.addEventListener('input',()=>{state.selected=null;els.selectedPreview.classList.add('hidden');renderSuggestions()});els.itemSearch.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const first=searchItems(els.itemSearch.value)[0];first?selectItem(first):selectCustomFromInput()}});els.itemForm.addEventListener('submit',confirmAdd);$('#priceLibraryBtn').onclick=()=>{renderPriceLibrary();els.priceDialog.showModal()};$('#closePriceLibrary').onclick=()=>els.priceDialog.close();els.priceSearch.addEventListener('input',renderPriceLibrary);
window.LPPApp={version:VERSION,getCloudState,applyRemote,flush:()=>persist(false),render:renderAll,getActiveId:()=>state.activeId};
window.addEventListener('load',()=>{loadDatabase();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js?v=6',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{})});
})();
