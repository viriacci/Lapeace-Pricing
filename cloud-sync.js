(()=>{
'use strict';

const SUPABASE_URL='https://dxrnijmpnjegsxaliwmc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_7goMLYW4rP04ZgYZiKr3Hg_RT12TvED';
const CLOUD_MARKER_PREFIX='lpp.cloud.bound.';
const KEYS={quotes:'lpp.quotes.v1',active:'lpp.activeQuote.v1',prices:'lpp.prices.v1',custom:'lpp.custom.v1'};

if(!window.supabase){console.error('Supabase JS nie został załadowany.');return;}
const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

let currentUser=null;
let started=false;
let lastLocalSnapshot='';
let lastRemoteSnapshot='';
let pushTimer=null;
let pullTimer=null;
let suppressPush=false;

function parse(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function stateFromLocal(){
  return {
    quotes:parse(KEYS.quotes,[]),
    prices:parse(KEYS.prices,{}),
    custom_items:parse(KEYS.custom,[]),
    active_quote_id:localStorage.getItem(KEYS.active)||null
  };
}
function normalizeState(s){return {
  quotes:Array.isArray(s?.quotes)?s.quotes:[],
  prices:s?.prices&&typeof s.prices==='object'&&!Array.isArray(s.prices)?s.prices:{},
  custom_items:Array.isArray(s?.custom_items)?s.custom_items:[],
  active_quote_id:s?.active_quote_id||null
}}
function stable(s){return JSON.stringify(normalizeState(s))}
function meaningful(s){
  const x=normalizeState(s);
  if(Object.keys(x.prices).length||x.custom_items.length)return true;
  if(x.quotes.length>1)return true;
  const q=x.quotes[0];
  if(!q)return false;
  return (Array.isArray(q.items)&&q.items.length>0)||q.status==='done'||(q.name&&q.name!=='Wycena 1');
}
function applyLocal(s){
  const x=normalizeState(s);suppressPush=true;
  localStorage.setItem(KEYS.quotes,JSON.stringify(x.quotes));
  localStorage.setItem(KEYS.prices,JSON.stringify(x.prices));
  localStorage.setItem(KEYS.custom,JSON.stringify(x.custom_items));
  if(x.active_quote_id)localStorage.setItem(KEYS.active,x.active_quote_id);else localStorage.removeItem(KEYS.active);
  lastLocalSnapshot=stable(x);lastRemoteSnapshot=lastLocalSnapshot;
  setTimeout(()=>{suppressPush=false;location.reload()},120);
}
function setCloudStatus(text,kind='ok'){
  const el=document.getElementById('cloudStatus');if(!el)return;
  el.textContent=text;el.dataset.kind=kind;
}
function toast(text){
  let t=document.getElementById('cloudToast');if(!t){t=document.createElement('div');t.id='cloudToast';document.body.append(t)}
  t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2600);
}
function installStyles(){
  const s=document.createElement('style');s.textContent=`
  #authOverlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px;background:rgba(4,7,12,.92);backdrop-filter:blur(14px)}
  #authOverlay.hidden{display:none!important}.auth-card{width:min(430px,100%);padding:24px;border-radius:22px;background:#111823;border:1px solid rgba(255,255,255,.1);box-shadow:0 24px 80px rgba(0,0,0,.5)}.auth-card h2{margin:5px 0 8px}.auth-card p{color:#95a3b5;line-height:1.45}.auth-card label{display:block;margin:12px 0 6px;color:#c9d4e4;font-size:13px;font-weight:700}.auth-card input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0a1018;color:#eef4ff;outline:none}.auth-card input:focus{border-color:#7c5cff;box-shadow:0 0 0 3px rgba(124,92,255,.15)}.auth-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.auth-msg{min-height:20px;margin-top:12px;font-size:13px;color:#9db0c7}.auth-msg.error{color:#ff9aa6}.auth-msg.ok{color:#8ee6b0}.cloud-user{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cloud-status{font-size:11px;padding:5px 8px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:#9ed7ff;background:rgba(0,198,255,.08)}.cloud-status[data-kind="warn"]{color:#ffd58a;background:rgba(255,180,0,.08)}.cloud-status[data-kind="error"]{color:#ff9aa6;background:rgba(255,95,113,.08)}.cloud-email{font-size:12px;color:#8e9bad;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#cloudToast{position:fixed;right:18px;bottom:18px;z-index:999999;background:#111823;color:#eef4ff;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:11px 14px;box-shadow:0 16px 50px rgba(0,0,0,.4);opacity:0;transform:translateY(8px);pointer-events:none;transition:.18s}#cloudToast.show{opacity:1;transform:none}@media(max-width:700px){.auth-actions{grid-template-columns:1fr}.cloud-user{width:100%}.cloud-email{max-width:150px}}
  `;document.head.append(s);
}
function installUI(){
  installStyles();
  const overlay=document.createElement('div');overlay.id='authOverlay';overlay.innerHTML=`<div class="auth-card"><div class="eyebrow">Synchronizacja chmurowa</div><h2>La Peace Pricing</h2><p>Zaloguj się tym samym kontem na każdym komputerze. Biblioteka wycen i cen będzie wspólna.</p><label>E-mail</label><input id="authEmail" type="email" autocomplete="email" placeholder="adres@email.pl"><label>Hasło</label><input id="authPassword" type="password" autocomplete="current-password" placeholder="minimum 6 znaków"><div class="auth-actions"><button id="authLogin" class="primary">Zaloguj się</button><button id="authSignup" class="secondary">Utwórz konto</button></div><div id="authMsg" class="auth-msg"></div></div>`;document.body.append(overlay);
  const top=document.querySelector('.top-actions');if(top){const wrap=document.createElement('div');wrap.className='cloud-user';wrap.innerHTML='<span id="cloudStatus" class="cloud-status" data-kind="warn">CHMURA: oczekiwanie</span><span id="cloudEmail" class="cloud-email"></span><button id="cloudLogout" class="ghost" style="display:none">Wyloguj</button>';top.prepend(wrap)}
  document.getElementById('authLogin').onclick=login;
  document.getElementById('authSignup').onclick=signup;
  document.getElementById('authPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login()});
  document.getElementById('cloudLogout')?.addEventListener('click',logout);
}
function authMsg(text,type=''){const el=document.getElementById('authMsg');if(!el)return;el.textContent=text;el.className='auth-msg '+type}
async function login(){
  const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;
  if(!email||!password){authMsg('Podaj e-mail i hasło.','error');return}
  authMsg('Logowanie…');const {error}=await sb.auth.signInWithPassword({email,password});if(error){authMsg(error.message,'error');return}authMsg('Zalogowano.','ok');
}
async function signup(){
  const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;
  if(!email||password.length<6){authMsg('Podaj e-mail i hasło mające co najmniej 6 znaków.','error');return}
  authMsg('Tworzę konto…');
  const redirectTo=location.origin+location.pathname;
  const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});
  if(error){authMsg(error.message,'error');return}
  if(data.session)authMsg('Konto utworzone i zalogowane.','ok');else authMsg('Konto utworzone. Sprawdź e-mail i potwierdź rejestrację, potem wróć tutaj i się zaloguj.','ok');
}
async function logout(){await sb.auth.signOut();location.reload()}
function showLoggedIn(user){
  document.getElementById('authOverlay')?.classList.add('hidden');
  const email=document.getElementById('cloudEmail');if(email)email.textContent=user.email||'';
  const btn=document.getElementById('cloudLogout');if(btn)btn.style.display='inline-block';
  setCloudStatus('CHMURA: połączono','ok');
}
function showLoggedOut(){document.getElementById('authOverlay')?.classList.remove('hidden');setCloudStatus('CHMURA: wylogowano','warn')}

async function getRemote(){
  const {data,error}=await sb.from('app_state').select('quotes,prices,custom_items,active_quote_id,updated_at').eq('user_id',currentUser.id).maybeSingle();
  if(error)throw error;return data;
}
async function upsertRemote(local){
  const x=normalizeState(local);setCloudStatus('CHMURA: zapisuję…','warn');
  const {error}=await sb.from('app_state').upsert({user_id:currentUser.id,...x},{onConflict:'user_id'});
  if(error)throw error;lastRemoteSnapshot=stable(x);lastLocalSnapshot=lastRemoteSnapshot;setCloudStatus('CHMURA: zsynchronizowano','ok');
}
async function initialSync(){
  const marker=CLOUD_MARKER_PREFIX+currentUser.id;
  const local=stateFromLocal();
  let remote=await getRemote();
  if(!remote){await upsertRemote(local);localStorage.setItem(marker,'1');toast('Lokalne dane zapisano w chmurze.');return}
  const r=normalizeState(remote),ls=stable(local),rs=stable(r);lastRemoteSnapshot=rs;
  if(ls===rs){lastLocalSnapshot=ls;localStorage.setItem(marker,'1');return}
  const bound=localStorage.getItem(marker)==='1';
  if(!bound&&meaningful(local)&&meaningful(r)){
    const useLocal=confirm('Na tym komputerze są lokalne dane, a w chmurze istnieje już inna biblioteka.\n\nOK = wyślij dane z tego komputera do chmury\nAnuluj = pobierz dane z chmury na ten komputer');
    if(useLocal){await upsertRemote(local);localStorage.setItem(marker,'1');toast('Dane z tego komputera zapisano w chmurze.');return}
  }
  if(!meaningful(r)&&meaningful(local)){await upsertRemote(local);localStorage.setItem(marker,'1');toast('Lokalne dane zapisano w chmurze.');return}
  localStorage.setItem(marker,'1');applyLocal(r);
}
async function pushIfChanged(){
  if(!started||suppressPush||!currentUser)return;
  const local=stateFromLocal(),snap=stable(local);if(snap===lastLocalSnapshot)return;
  lastLocalSnapshot=snap;clearTimeout(pushTimer);pushTimer=setTimeout(async()=>{try{await upsertRemote(stateFromLocal())}catch(e){console.error(e);setCloudStatus('CHMURA: błąd zapisu','error');toast('Nie udało się zapisać zmian w chmurze.')}} ,650);
}
async function pullIfChanged(){
  if(!started||suppressPush||!currentUser)return;
  try{
    const remote=await getRemote();if(!remote)return;
    const rs=stable(remote);if(rs===lastRemoteSnapshot)return;
    const local=stateFromLocal(),ls=stable(local);
    if(ls!==lastLocalSnapshot){return}
    lastRemoteSnapshot=rs;
    if(rs!==ls){setCloudStatus('CHMURA: pobieram zmiany…','warn');applyLocal(remote)}
  }catch(e){console.error(e);setCloudStatus('CHMURA: offline','error')}
}
async function startForUser(user){
  currentUser=user;showLoggedIn(user);if(started)return;started=true;
  try{await initialSync()}catch(e){console.error(e);setCloudStatus('CHMURA: błąd synchronizacji','error');toast('Nie udało się uruchomić synchronizacji chmurowej.');}
  lastLocalSnapshot=stable(stateFromLocal());
  setInterval(pushIfChanged,700);
  pullTimer=setInterval(pullIfChanged,5000);
}

installUI();
sb.auth.onAuthStateChange((_event,session)=>{if(session?.user)startForUser(session.user);else{currentUser=null;showLoggedOut()}});
(async()=>{const {data}=await sb.auth.getSession();if(data.session?.user)await startForUser(data.session.user);else showLoggedOut()})();
})();
