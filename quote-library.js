(()=>{
'use strict';

const QUOTES_KEY='lpp.quotes.v1';
const ACTIVE_KEY='lpp.activeQuote.v1';
let quotes=[];
let activeId='';
let lastSnapshot='';
let applying=false;

function uid(){return 'q-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)}
function now(){return new Date().toISOString()}
function clone(v){return JSON.parse(JSON.stringify(v||[]))}
function load(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function save(){localStorage.setItem(QUOTES_KEY,JSON.stringify(quotes));localStorage.setItem(ACTIVE_KEY,activeId)}
function active(){return quotes.find(q=>q.id===activeId)}
function total(q){return (q.items||[]).reduce((s,x)=>s+(Number(x.qty)||0)*(Number(x.unit)||0),0)}
function qty(q){return (q.items||[]).reduce((s,x)=>s+(Number(x.qty)||0),0)}
function fmtMoney(n){return Number(n||0).toLocaleString('pl-PL',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtDate(v){if(!v)return '—';try{return new Date(v).toLocaleString('pl-PL',{dateStyle:'short',timeStyle:'short'})}catch{return v}}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}

function migrate(){
  quotes=load(QUOTES_KEY,[]);
  activeId=localStorage.getItem(ACTIVE_KEY)||'';
  if(!Array.isArray(quotes)||!quotes.length){
    const old=Array.isArray(state.quote)?clone(state.quote):[];
    const q={id:uid(),name:'Wycena 1',status:'active',items:old,createdAt:now(),updatedAt:now(),completedAt:null};
    quotes=[q];activeId=q.id;save();
  }
  if(!quotes.some(q=>q.id===activeId))activeId=quotes[0].id;
  const q=active();
  applying=true;state.quote=clone(q.items);saveJSON(LS.quote,state.quote);renderQuote();applying=false;
  lastSnapshot=JSON.stringify(state.quote);
}

function syncCurrent(){
  if(applying)return;
  const snap=JSON.stringify(state.quote||[]);
  if(snap===lastSnapshot)return;
  const q=active();if(!q)return;
  q.items=clone(state.quote);q.updatedAt=now();lastSnapshot=snap;save();updateHeader();
}

function setActive(id){
  syncCurrent();
  const q=quotes.find(x=>x.id===id);if(!q)return;
  activeId=id;save();
  applying=true;state.quote=clone(q.items||[]);saveJSON(LS.quote,state.quote);renderQuote();applying=false;
  lastSnapshot=JSON.stringify(state.quote);updateHeader();closeLibrary();
}

function createQuote(){
  syncCurrent();
  const n=quotes.length+1;
  const name=prompt('Nazwa nowej wyceny:',`Wycena ${n}`);
  if(name===null)return;
  const q={id:uid(),name:(name.trim()||`Wycena ${n}`),status:'active',items:[],createdAt:now(),updatedAt:now(),completedAt:null};
  quotes.unshift(q);activeId=q.id;save();
  applying=true;state.quote=[];saveJSON(LS.quote,state.quote);renderQuote();applying=false;
  lastSnapshot='[]';updateHeader();
}

function renameQuote(id){
  const q=quotes.find(x=>x.id===id);if(!q)return;
  const name=prompt('Nowa nazwa wyceny:',q.name);if(name===null||!name.trim())return;
  q.name=name.trim();q.updatedAt=now();save();renderLibrary();updateHeader();
}
function toggleDone(id){
  syncCurrent();const q=quotes.find(x=>x.id===id);if(!q)return;
  if(q.status==='done'){q.status='active';q.completedAt=null}else{q.status='done';q.completedAt=now()}
  q.updatedAt=now();save();renderLibrary();updateHeader();
}
function deleteQuote(id){
  if(quotes.length<=1){alert('Musi zostać przynajmniej jedna wycena.');return}
  const q=quotes.find(x=>x.id===id);if(!q||!confirm(`Usunąć wycenę „${q.name}”?`))return;
  quotes=quotes.filter(x=>x.id!==id);
  if(activeId===id){activeId=quotes[0].id;const a=active();applying=true;state.quote=clone(a.items||[]);saveJSON(LS.quote,state.quote);renderQuote();applying=false;lastSnapshot=JSON.stringify(state.quote)}
  save();renderLibrary();updateHeader();
}

function updateHeader(){
  const q=active();if(!q)return;
  const title=document.getElementById('activeQuoteName');
  const badge=document.getElementById('activeQuoteStatus');
  if(title)title.textContent=q.name;
  if(badge){badge.textContent=q.status==='done'?'ZREALIZOWANO':'W TRAKCIE';badge.className='quote-status '+(q.status==='done'?'done':'active')}
}

function renderLibrary(){
  syncCurrent();
  const list=document.getElementById('quoteLibraryList');if(!list)return;
  const query=(document.getElementById('quoteLibrarySearch')?.value||'').toLocaleLowerCase('pl').trim();
  const filter=document.getElementById('quoteLibraryFilter')?.value||'all';
  const rows=quotes.filter(q=>(!query||q.name.toLocaleLowerCase('pl').includes(query))&&(filter==='all'||q.status===filter))
    .sort((a,b)=>a.status===b.status?new Date(b.updatedAt)-new Date(a.updatedAt):(a.status==='done'?1:-1));
  if(!rows.length){list.innerHTML='<div class="ql-empty">Brak wycen pasujących do filtrów.</div>';return}
  list.innerHTML=rows.map(q=>`<article class="ql-card ${q.status==='done'?'is-done':''} ${q.id===activeId?'is-current':''}" data-id="${q.id}">
    <div class="ql-main">
      <div class="ql-title-row"><strong>${esc(q.name)}</strong><span class="ql-badge ${q.status}">${q.status==='done'?'ZREALIZOWANO':'W TRAKCIE'}</span>${q.id===activeId?'<span class="ql-current">AKTUALNA</span>':''}</div>
      <div class="ql-meta">${(q.items||[]).length} pozycji • ${qty(q).toLocaleString('pl-PL')} szt. • ${fmtMoney(total(q))}</div>
      <div class="ql-date">Ostatnia zmiana: ${fmtDate(q.updatedAt)}${q.completedAt?` • Zrealizowano: ${fmtDate(q.completedAt)}`:''}</div>
    </div>
    <div class="ql-actions">
      <button class="secondary ql-open" data-id="${q.id}">${q.id===activeId?'Otwarta':'Otwórz'}</button>
      <button class="secondary ql-done" data-id="${q.id}">${q.status==='done'?'Przywróć':'Zrealizowano'}</button>
      <button class="ghost ql-rename" data-id="${q.id}">Zmień nazwę</button>
      <button class="delete-btn danger ql-delete" data-id="${q.id}" title="Usuń">×</button>
    </div>
  </article>`).join('');
  list.querySelectorAll('.ql-open').forEach(b=>b.onclick=()=>setActive(b.dataset.id));
  list.querySelectorAll('.ql-done').forEach(b=>b.onclick=()=>toggleDone(b.dataset.id));
  list.querySelectorAll('.ql-rename').forEach(b=>b.onclick=()=>renameQuote(b.dataset.id));
  list.querySelectorAll('.ql-delete').forEach(b=>b.onclick=()=>deleteQuote(b.dataset.id));
}

function openLibrary(){renderLibrary();document.getElementById('quoteLibraryDialog').showModal()}
function closeLibrary(){document.getElementById('quoteLibraryDialog')?.close()}

function installUI(){
  const top=document.querySelector('.top-actions');
  const lib=document.createElement('button');lib.id='quoteLibraryBtn';lib.className='secondary';lib.textContent='Biblioteka wycen';
  const add=document.createElement('button');add.id='newQuoteBtn';add.className='secondary';add.textContent='+ Nowa wycena';
  top.prepend(add);top.prepend(lib);

  const head=document.querySelector('.panel .section-head > div');
  const oldH=head.querySelector('h2');if(oldH)oldH.style.display='none';
  const wrap=document.createElement('div');wrap.className='active-quote-head';wrap.innerHTML='<div><h2 id="activeQuoteName">Wycena</h2><span id="activeQuoteStatus" class="quote-status active">W TRAKCIE</span></div>';
  head.prepend(wrap);

  const d=document.createElement('dialog');d.id='quoteLibraryDialog';d.className='modal';d.innerHTML=`<div class="modal-card glass modal-large ql-modal">
    <div class="modal-head"><div><div class="eyebrow">Wyceny</div><h2>Biblioteka wycen</h2></div><button id="closeQuoteLibrary" class="icon-btn">×</button></div>
    <div class="ql-toolbar"><input id="quoteLibrarySearch" class="search-input" placeholder="Szukaj wyceny…"><select id="quoteLibraryFilter" class="ql-filter"><option value="all">Wszystkie</option><option value="active">W trakcie</option><option value="done">Zrealizowane</option></select><button id="newQuoteInLibrary" class="primary">+ Nowa wycena</button></div>
    <div id="quoteLibraryList" class="ql-list"></div>
  </div>`;
  document.body.append(d);

  lib.onclick=openLibrary;add.onclick=createQuote;
  d.querySelector('#closeQuoteLibrary').onclick=closeLibrary;
  d.querySelector('#newQuoteInLibrary').onclick=()=>{closeLibrary();createQuote()};
  d.querySelector('#quoteLibrarySearch').oninput=renderLibrary;
  d.querySelector('#quoteLibraryFilter').onchange=renderLibrary;

  const style=document.createElement('style');style.textContent=`
  .active-quote-head>div{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.active-quote-head h2{margin:0}.quote-status,.ql-badge,.ql-current{font-size:10px;font-weight:800;letter-spacing:.08em;padding:5px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.12)}.quote-status.active,.ql-badge.active{background:rgba(86,156,255,.12);color:#9dc3ff}.quote-status.done,.ql-badge.done{background:rgba(117,129,145,.12);color:#a7b0bd}.ql-current{background:rgba(127,92,255,.16);color:#c7b9ff}.ql-modal{width:min(1050px,94vw);max-height:88vh}.ql-toolbar{display:grid;grid-template-columns:1fr 170px auto;gap:10px;margin-bottom:14px}.ql-filter{background:#0e1420;color:#e8edf5;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:0 12px}.ql-list{display:flex;flex-direction:column;gap:10px;overflow:auto;min-height:240px;max-height:60vh;padding-right:4px}.ql-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:center;padding:16px;border:1px solid rgba(255,255,255,.09);border-radius:16px;background:rgba(255,255,255,.035)}.ql-card.is-current{border-color:rgba(127,92,255,.55);box-shadow:inset 0 0 0 1px rgba(127,92,255,.12)}.ql-card.is-done{opacity:.58;filter:saturate(.55)}.ql-title-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.ql-title-row strong{font-size:17px}.ql-meta{margin-top:7px;color:#c3cad5}.ql-date{margin-top:4px;font-size:12px;color:#7f8999}.ql-actions{display:flex;align-items:center;gap:7px;flex-wrap:wrap;justify-content:flex-end}.ql-actions button{white-space:nowrap}.ql-empty{display:grid;place-items:center;min-height:220px;color:#7f8999}@media(max-width:760px){.top-actions{flex-wrap:wrap}.ql-toolbar{grid-template-columns:1fr}.ql-filter{min-height:44px}.ql-card{grid-template-columns:1fr}.ql-actions{justify-content:flex-start}.ql-modal{width:96vw}.active-quote-head>div{align-items:flex-start;flex-direction:column;gap:6px}}
  `;document.head.append(style);
}

installUI();migrate();updateHeader();
setInterval(syncCurrent,500);
window.addEventListener('beforeunload',syncCurrent);
})();
