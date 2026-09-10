const VERSION='1.0.0-web';
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

const LS={prices:'lpp.prices.v1',quote:'lpp.quote.v1',custom:'lpp.custom.v1'};
const state={items:[],quote:loadJSON(LS.quote,[]),prices:loadJSON(LS.prices,{}),custom:loadJSON(LS.custom,[]),selected:null,lang:{}};
const $=s=>document.querySelector(s);
const els={dbStatus:$('#dbStatus'),quoteList:$('#quoteList'),lineCount:$('#lineCount'),itemCount:$('#itemCount'),grandTotal:$('#grandTotal'),itemDialog:$('#itemDialog'),itemForm:$('#itemForm'),itemSearch:$('#itemSearch'),suggestions:$('#suggestions'),selectedPreview:$('#selectedPreview'),stacks:$('#stacksInput'),pieces:$('#piecesInput'),unitPrice:$('#unitPriceInput'),recipeBox:$('#recipeBox'),priceDialog:$('#priceLibraryDialog'),priceSearch:$('#priceLibrarySearch'),priceList:$('#priceLibraryList')};

function loadJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function saveJSON(key,value){localStorage.setItem(key,JSON.stringify(value))}
function money(n){return Number(n||0).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})}
function safeText(v){return String(v??'').replace(/[<>]/g,'')}
function normalize(v){return String(v||'').toLocaleLowerCase('pl').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[_-]+/g,' ').trim()}
function prettyId(id){return String(id||'').split('_').map(x=>x.charAt(0).toUpperCase()+x.slice(1)).join(' ')}
function fallbackIconData(name){const label=safeText((name||'?').split('_').map(x=>x[0]).join('').slice(0,3).toUpperCase());return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect rx="12" width="64" height="64" fill="#18202b"/><text x="32" y="38" text-anchor="middle" fill="#8fbaff" font-family="Arial" font-size="18" font-weight="700">${label}</text></svg>`)}`}
function attachIcon(img,name){const candidates=[`https://mcasset.cloud/1.21.11/assets/minecraft/textures/item/${name}.png`,`https://mcasset.cloud/1.21.11/assets/minecraft/textures/block/${name}.png`];let i=0;img.onerror=()=>{i++;img.src=i<candidates.length?candidates[i]:fallbackIconData(name);if(i>=candidates.length)img.onerror=null};img.src=candidates[0]}
async function fetchJSON(url,timeout=12000){const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),timeout);try{const r=await fetch(url,{cache:'force-cache',signal:ctrl.signal});if(!r.ok)throw new Error(`${r.status}`);return await r.json()}finally{clearTimeout(t)}}
async function firstJSON(urls){let last;for(const url of urls){try{return await fetchJSON(url)}catch(e){last=e}}throw last||new Error('Brak źródła')}

async function loadDatabase(){
  els.dbStatus.textContent='Pobieram bazę Minecraft Java 1.21.11…';
  let base;
  try{base=await firstJSON(ITEM_SOURCES)}catch{base=FALLBACK_ITEMS}
  try{state.lang=await firstJSON(LANG_SOURCES)}catch{state.lang={}}
  state.items=(Array.isArray(base)?base:[]).filter(x=>x&&x.name&&x.name!=='air').map(x=>{
    const keyBlock=`block.minecraft.${x.name}`;const keyItem=`item.minecraft.${x.name}`;
    return {...x,plName:state.lang[keyBlock]||state.lang[keyItem]||x.plName||''};
  });
  const customNames=new Set(state.items.map(x=>x.name));
  for(const c of state.custom){if(!customNames.has(c.name))state.items.push({...c,custom:true})}
  const sculkNames=['sculk','sculk_vein','sculk_catalyst','sculk_shrieker','sculk_sensor','calibrated_sculk_sensor'];
  for(const fb of FALLBACK_ITEMS.filter(x=>sculkNames.includes(x.name))){if(!state.items.some(x=>x.name===fb.name))state.items.push(fb)}
  state.items.sort((a,b)=>(a.displayName||a.name).localeCompare(b.displayName||b.name,'en'));
  const source=base===FALLBACK_ITEMS?'tryb awaryjny':'pełna baza';
  els.dbStatus.textContent=`Minecraft 1.21.11 • ${state.items.length} przedmiotów • ${source}`;
  renderQuote();
}

function searchItems(q){const n=normalize(q);if(!n)return [];return state.items.map(item=>{const hay=[item.name,item.displayName,item.plName].map(normalize);let score=99;for(const h of hay){if(h===n)score=Math.min(score,0);else if(h.startsWith(n))score=Math.min(score,1);else if(h.includes(n))score=Math.min(score,2)}return {item,score}}).filter(x=>x.score<99).sort((a,b)=>a.score-b.score||String(a.item.displayName).localeCompare(String(b.item.displayName))).slice(0,30).map(x=>x.item)}
function renderSuggestions(){
  const q=els.itemSearch.value.trim();const matches=searchItems(q);els.suggestions.innerHTML='';
  for(const item of matches){const row=document.createElement('div');row.className='suggestion';const img=document.createElement('img');attachIcon(img,item.name);const text=document.createElement('div');text.innerHTML=`<strong>${safeText(item.displayName||prettyId(item.name))}</strong><small>${safeText(item.plName||item.name)}</small>`;const meta=document.createElement('small');meta.textContent=`stack ${item.stackSize||64}`;row.append(img,text,meta);row.onclick=()=>selectItem(item);els.suggestions.append(row)}
  if(q&&!matches.length){const row=document.createElement('div');row.className='suggestion';row.innerHTML=`<div></div><div><strong>Dodaj „${safeText(q)}” jako własny przedmiot</strong><small>Nie znaleziono w bazie. Domyślny stack: 64</small></div><span class="custom-badge">WŁASNY</span>`;row.onclick=()=>selectCustomFromInput();els.suggestions.append(row)}
}
function selectItem(item){state.selected=item;els.itemSearch.value=item.displayName||prettyId(item.name);els.suggestions.innerHTML='';els.selectedPreview.classList.remove('hidden');els.selectedPreview.innerHTML=`<strong>${safeText(item.displayName||prettyId(item.name))}</strong>${item.plName?` • ${safeText(item.plName)}`:''}<br><small>ID: ${safeText(item.name)} • stack: ${item.stackSize||64}</small>`;els.unitPrice.value=state.prices[item.name]??0;loadRecipe(item.name)}
function selectCustomFromInput(){const raw=els.itemSearch.value.trim();if(!raw)return;const name=normalize(raw).replace(/\s+/g,'_').replace(/[^a-z0-9_ąćęłńóśźż]/gi,'').toLowerCase()||`custom_${Date.now()}`;const custom={id:`custom-${Date.now()}`,name,displayName:raw,plName:raw,stackSize:64,custom:true};state.custom.push(custom);state.items.push(custom);saveJSON(LS.custom,state.custom);selectItem(custom)}
async function loadRecipe(name){els.recipeBox.classList.add('hidden');els.recipeBox.textContent='';if(state.selected?.custom)return;for(const base of RECIPE_BASES){try{const data=await fetchJSON(`${base}${encodeURIComponent(name)}.json`,6000);const text=recipeSummary(data);if(text){els.recipeBox.textContent=text;els.recipeBox.classList.remove('hidden')}return}catch{}}}
function recipeSummary(r){if(!r||typeof r!=='object')return'';if(r.type?.includes('crafting_shaped')&&r.pattern&&r.key){const counts={};for(const line of r.pattern)for(const ch of line){if(ch===' ')continue;const ing=r.key[ch];const id=ingredientId(ing);if(id)counts[id]=(counts[id]||0)+1}return 'Receptura: '+Object.entries(counts).map(([k,v])=>`${v}× ${prettyId(k)}`).join(', ')}if(r.type?.includes('crafting_shapeless')&&Array.isArray(r.ingredients)){const counts={};for(const ing of r.ingredients){const id=ingredientId(ing);if(id)counts[id]=(counts[id]||0)+1}return 'Receptura: '+Object.entries(counts).map(([k,v])=>`${v}× ${prettyId(k)}`).join(', ')}return''}
function ingredientId(v){if(Array.isArray(v))v=v[0];if(typeof v==='string')return v.replace('minecraft:','');if(v?.item)return String(v.item).replace('minecraft:','');return''}

function openAdd(){state.selected=null;els.itemForm.reset();els.stacks.value=0;els.pieces.value=1;els.unitPrice.value=0;els.itemSearch.value='';els.suggestions.innerHTML='';els.selectedPreview.classList.add('hidden');els.recipeBox.classList.add('hidden');els.itemDialog.showModal();setTimeout(()=>els.itemSearch.focus(),50)}
function confirmAdd(ev){ev.preventDefault();if(!state.selected){if(els.itemSearch.value.trim())selectCustomFromInput();else return}const item=state.selected;const stacks=Math.max(0,Math.floor(Number(els.stacks.value)||0));const pieces=Math.max(0,Math.floor(Number(els.pieces.value)||0));const qty=stacks*(item.stackSize||64)+pieces;if(qty<=0){els.pieces.value=1;return}const unit=Math.max(0,Number(els.unitPrice.value)||0);state.quote.push({key:`${Date.now()}-${Math.random()}`,name:item.name,displayName:item.displayName||prettyId(item.name),plName:item.plName||'',stackSize:item.stackSize||64,qty,unit,custom:!!item.custom});state.prices[item.name]=unit;saveJSON(LS.prices,state.prices);saveJSON(LS.quote,state.quote);els.itemDialog.close();renderQuote()}
function renderQuote(){
  els.quoteList.innerHTML='';if(!state.quote.length){els.quoteList.className='quote-list empty-state';els.quoteList.textContent='Brak przedmiotów. Dodaj pierwszy element do wyceny.'}else{els.quoteList.className='quote-list';for(const line of state.quote){const node=$('#quoteTemplate').content.firstElementChild.cloneNode(true);attachIcon(node.querySelector('.item-icon'),line.name);node.querySelector('.item-name').textContent=line.displayName+(line.plName&&line.plName!==line.displayName?` • ${line.plName}`:'');node.querySelector('.item-id').textContent=line.custom?`${line.name} • własny`:`minecraft:${line.name}`;const stack=line.stackSize||64;const full=Math.floor(line.qty/stack),rem=line.qty%stack;node.querySelector('.item-qty').textContent=`${line.qty} szt. • ${full} stack${full===1?'':'i'}${rem?` + ${rem}`:''} • ${money(line.unit)} / szt.`;node.querySelector('.item-price').textContent=money(line.qty*line.unit);node.querySelector('.delete-btn').onclick=()=>{state.quote=state.quote.filter(x=>x.key!==line.key);saveJSON(LS.quote,state.quote);renderQuote()};els.quoteList.append(node)}}const totalQty=state.quote.reduce((s,x)=>s+x.qty,0);const total=state.quote.reduce((s,x)=>s+x.qty*x.unit,0);els.lineCount.textContent=state.quote.length;els.itemCount.textContent=totalQty.toLocaleString('pl-PL');els.grandTotal.textContent=money(total)}

function renderPriceLibrary(){const q=normalize(els.priceSearch.value);const rows=Object.entries(state.prices).map(([name,price])=>{const item=state.items.find(x=>x.name===name);return {name,price,item,display:item?.displayName||prettyId(name),pl:item?.plName||''}}).filter(x=>!q||normalize(`${x.name} ${x.display} ${x.pl}`).includes(q)).sort((a,b)=>a.display.localeCompare(b.display,'pl'));els.priceList.innerHTML='';if(!rows.length){els.priceList.innerHTML='<div class="empty-state" style="min-height:180px">Brak zapisanych cen.</div>';return}for(const r of rows){const row=document.createElement('div');row.className='price-row';const name=document.createElement('div');name.innerHTML=`<strong>${safeText(r.display)}</strong><small>${safeText(r.pl||r.name)}</small>`;const input=document.createElement('input');input.type='number';input.min='0';input.step='0.01';input.value=r.price;input.onchange=()=>{state.prices[r.name]=Math.max(0,Number(input.value)||0);saveJSON(LS.prices,state.prices);for(const line of state.quote)if(line.name===r.name)line.unit=state.prices[r.name];saveJSON(LS.quote,state.quote);renderQuote()};const del=document.createElement('button');del.className='delete-btn danger';del.textContent='×';del.onclick=()=>{delete state.prices[r.name];saveJSON(LS.prices,state.prices);renderPriceLibrary()};row.append(name,input,del);els.priceList.append(row)}}

$('#addBtn').onclick=openAdd;$('#clearBtn').onclick=()=>{if(state.quote.length&&confirm('Wyczyścić całą wycenę?')){state.quote=[];saveJSON(LS.quote,state.quote);renderQuote()}};els.itemSearch.addEventListener('input',()=>{state.selected=null;els.selectedPreview.classList.add('hidden');renderSuggestions()});els.itemSearch.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();const first=searchItems(els.itemSearch.value)[0];first?selectItem(first):selectCustomFromInput()}});$('#confirmAddBtn').onclick=confirmAdd;els.itemForm.addEventListener('submit',confirmAdd);$('#priceLibraryBtn').onclick=()=>{renderPriceLibrary();els.priceDialog.showModal()};$('#closePriceLibrary').onclick=()=>els.priceDialog.close();els.priceSearch.addEventListener('input',renderPriceLibrary);
window.addEventListener('load',()=>{loadDatabase();if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{})});
