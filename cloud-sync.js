(()=>{
'use strict';

const SUPABASE_URL='https://dxrnijmpnjegsxaliwmc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_7goMLYW4rP04ZgYZiKr3Hg_RT12TvED';
const KEYS={workspace:'lpp.workspace.v1',pendingJoin:'lpp.pendingJoinCode.v1',pendingWrite:'lpp.pendingCloudWrite.v1'};
if(!window.supabase||!window.LPPApp){console.error('Brak Supabase lub LPPApp.');return}

const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
let currentUser=null,currentWorkspace=null,started=false,applyingRemote=false,pushing=false,pulling=false,dirty=false,remotePending=false;
let pushTimer=null,pullTimer=null,realtimeChannel=null,lastRemoteSnapshot='',lastRemoteUpdatedAt='';

function normalizeState(s){return{quotes:Array.isArray(s?.quotes)?s.quotes:[],prices:s?.prices&&typeof s.prices==='object'&&!Array.isArray(s.prices)?s.prices:{},custom_items:Array.isArray(s?.custom_items)?s.custom_items:[],active_quote_id:s?.active_quote_id||null}}
function stable(s){return JSON.stringify(normalizeState(s))}
function stateFromApp(){return normalizeState(window.LPPApp.getCloudState())}
function validUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||'').trim())}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function setCloudStatus(text,kind='ok'){const el=document.getElementById('cloudStatus');if(el){el.textContent=text;el.dataset.kind=kind}}
function toast(text){let t=document.getElementById('cloudToast');if(!t){t=document.createElement('div');t.id='cloudToast';document.body.append(t)}t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2400)}

function rememberInvite(){try{const u=new URL(location.href),code=(u.searchParams.get('join')||'').trim();if(validUuid(code))localStorage.setItem(KEYS.pendingJoin,code)}catch{}}
function pendingInvite(){const code=(localStorage.getItem(KEYS.pendingJoin)||'').trim();return validUuid(code)?code:''}
function clearInvite(){localStorage.removeItem(KEYS.pendingJoin);try{const u=new URL(location.href);if(u.searchParams.has('join')){u.searchParams.delete('join');history.replaceState(null,'',u.pathname+u.search+u.hash)}}catch{}}
function loadPendingWrite(){try{const p=JSON.parse(localStorage.getItem(KEYS.pendingWrite)||'null');return p&&p.workspace_id&&p.state?p:null}catch{return null}}
function savePendingWrite(){if(!currentWorkspace||applyingRemote)return;const payload={workspace_id:currentWorkspace.id,state:stateFromApp(),saved_at:Date.now()};localStorage.setItem(KEYS.pendingWrite,JSON.stringify(payload));return payload}
function clearPendingWrite(){localStorage.removeItem(KEYS.pendingWrite)}

function installStyles(){const s=document.createElement('style');s.textContent=`#authOverlay,#workspaceOverlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:18px;background:rgba(4,7,12,.94);backdrop-filter:blur(14px)}#authOverlay.hidden,#workspaceOverlay.hidden{display:none!important}.auth-card{width:min(470px,100%);padding:24px;border-radius:22px;background:#111823;border:1px solid rgba(255,255,255,.1);box-shadow:0 24px 80px rgba(0,0,0,.5)}.auth-card h2{margin:5px 0 8px}.auth-card p{color:#95a3b5;line-height:1.45}.auth-card label{display:block;margin:12px 0 6px;color:#c9d4e4;font-size:13px;font-weight:700}.auth-card input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.12);background:#0a1018;color:#eef4ff;outline:none}.auth-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px}.auth-msg{min-height:20px;margin-top:12px;font-size:13px;color:#9db0c7}.auth-msg.error{color:#ff9aa6}.auth-msg.ok{color:#8ee6b0}.cloud-user{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.cloud-status{font-size:11px;padding:5px 8px;border:1px solid rgba(255,255,255,.12);border-radius:999px;color:#9ed7ff;background:rgba(0,198,255,.08)}.cloud-status[data-kind="warn"]{color:#ffd58a;background:rgba(255,180,0,.08)}.cloud-status[data-kind="error"]{color:#ff9aa6;background:rgba(255,95,113,.08)}.cloud-email{font-size:12px;color:#8e9bad;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.workspace-choice{display:grid;gap:12px;margin-top:18px}.workspace-choice section{padding:14px;border:1px solid rgba(255,255,255,.1);border-radius:14px;background:rgba(255,255,255,.025)}.workspace-choice section h3{margin:0 0 5px}.workspace-code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;word-break:break-all;padding:10px;border-radius:10px;background:#090e15;border:1px solid rgba(255,255,255,.09);margin:10px 0}.team-card{width:min(560px,calc(100vw - 30px))}.team-row{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.08)}.team-row:last-child{border-bottom:0}.team-member{font-size:13px;color:#cbd6e7}.team-role{font-size:10px;padding:4px 7px;border-radius:999px;background:rgba(124,92,255,.13);color:#c7b9ff}#cloudToast{position:fixed;right:18px;bottom:18px;z-index:999999;background:#111823;color:#eef4ff;border:1px solid rgba(255,255,255,.12);border-radius:12px;padding:11px 14px;box-shadow:0 16px 50px rgba(0,0,0,.4);opacity:0;transform:translateY(8px);pointer-events:none;transition:.18s}#cloudToast.show{opacity:1;transform:none}.skip-invite{margin-top:10px;width:100%}@media(max-width:700px){.auth-actions{grid-template-columns:1fr}.cloud-user{width:100%}.cloud-email{max-width:130px}}`;document.head.append(s)}
function installUI(){
  installStyles();
  const auth=document.createElement('div');auth.id='authOverlay';auth.innerHTML=`<div class="auth-card"><div class="eyebrow">Synchronizacja chmurowa</div><h2>La Peace Pricing</h2><p>Zaloguj się, aby korzystać ze wspólnej bazy wycen i cen.</p><label>E-mail</label><input id="authEmail" type="email" autocomplete="email" placeholder="adres@email.pl"><label>Hasło</label><input id="authPassword" type="password" autocomplete="current-password" placeholder="minimum 6 znaków"><div class="auth-actions"><button id="authLogin" class="primary">Zaloguj się</button><button id="authSignup" class="secondary">Utwórz konto</button></div><div id="authMsg" class="auth-msg"></div></div>`;document.body.append(auth);
  const work=document.createElement('div');work.id='workspaceOverlay';work.className='hidden';work.innerHTML=`<div class="auth-card"><div class="eyebrow">Wspólna baza</div><h2>Wybierz zespół</h2><p>Utwórz nową wspólną przestrzeń albo dołącz do istniejącej kodem otrzymanym od współpracownika.</p><div class="workspace-choice"><section><h3>Utwórz zespół</h3><input id="workspaceName" value="La Peace" placeholder="Nazwa zespołu"><button id="workspaceCreate" class="primary" style="margin-top:10px;width:100%">Utwórz wspólną bazę</button></section><section><h3>Dołącz do zespołu</h3><input id="workspaceJoinCode" placeholder="kod zespołu"><button id="workspaceJoin" class="secondary" style="margin-top:10px;width:100%">Dołącz kodem</button><button id="workspaceSkipInvite" class="ghost skip-invite" style="display:none">Pomiń to zaproszenie</button></section></div><div id="workspaceMsg" class="auth-msg"></div></div>`;document.body.append(work);
  const team=document.createElement('dialog');team.id='teamDialog';team.className='modal';team.innerHTML=`<div class="modal-card glass team-card"><div class="modal-head"><div><div class="eyebrow">Wspólna baza</div><h2 id="teamName">Zespół</h2></div><button id="teamClose" class="icon-btn">×</button></div><p style="color:#8e9bad">Wszyscy członkowie zespołu widzą tę samą bibliotekę wycen i cen.</p><div id="teamInviteWrap"><div class="field-label">Link zaproszenia</div><div id="teamInviteLink" class="workspace-code"></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button id="teamCopy" class="secondary">Kopiuj link</button><button id="teamRotate" class="ghost">Wygeneruj nowy kod</button></div></div><div class="field-label">Członkowie</div><div id="teamMembers"></div></div>`;document.body.append(team);
  const top=document.querySelector('.top-actions');if(top){const wrap=document.createElement('div');wrap.className='cloud-user';wrap.innerHTML='<span id="cloudStatus" class="cloud-status" data-kind="warn">CHMURA: oczekiwanie</span><span id="cloudEmail" class="cloud-email"></span><button id="teamBtn" class="ghost" style="display:none">Zespół</button><button id="cloudLogout" class="ghost" style="display:none">Wyloguj</button>';top.prepend(wrap)}
  document.getElementById('authLogin').onclick=login;document.getElementById('authSignup').onclick=signup;document.getElementById('authPassword').addEventListener('keydown',e=>{if(e.key==='Enter')login()});document.getElementById('workspaceCreate').onclick=createWorkspace;document.getElementById('workspaceJoin').onclick=joinWorkspace;document.getElementById('workspaceSkipInvite').onclick=skipInvite;document.getElementById('cloudLogout').onclick=logout;document.getElementById('teamBtn').onclick=openTeam;document.getElementById('teamClose').onclick=()=>team.close();document.getElementById('teamCopy').onclick=copyInvite;document.getElementById('teamRotate').onclick=rotateInvite;
}
function authMsg(text,type=''){const el=document.getElementById('authMsg');if(el){el.textContent=text;el.className='auth-msg '+type}}
function workspaceMsg(text,type=''){const el=document.getElementById('workspaceMsg');if(el){el.textContent=text;el.className='auth-msg '+type}}
function showLoggedOut(){document.getElementById('authOverlay')?.classList.remove('hidden');document.getElementById('workspaceOverlay')?.classList.add('hidden');document.getElementById('teamBtn').style.display='none';document.getElementById('cloudLogout').style.display='none';setCloudStatus('CHMURA: wylogowano','warn')}
function showLoggedIn(user){document.getElementById('authOverlay')?.classList.add('hidden');document.getElementById('cloudEmail').textContent=user?.email||'';document.getElementById('cloudLogout').style.display='inline-block'}

async function login(){const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;if(!email||!password){authMsg('Podaj e-mail i hasło.','error');return}authMsg('Logowanie…');try{const {error}=await sb.auth.signInWithPassword({email,password});if(error)throw error;authMsg('Zalogowano.','ok')}catch(e){authMsg(e.message||'Nie udało się zalogować.','error')}}
async function signup(){const email=document.getElementById('authEmail').value.trim(),password=document.getElementById('authPassword').value;if(!email||password.length<6){authMsg('Podaj e-mail i hasło mające co najmniej 6 znaków.','error');return}authMsg('Tworzę konto…');try{const redirectTo=location.origin+location.pathname+location.search;const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:redirectTo}});if(error)throw error;authMsg(data.session?'Konto utworzone i zalogowane.':'Konto utworzone. Potwierdź adres e-mail, a potem się zaloguj.','ok')}catch(e){authMsg(e.message||'Nie udało się utworzyć konta.','error')}}
async function logout(){stopSync();try{await sb.auth.signOut()}finally{currentUser=null;currentWorkspace=null;localStorage.removeItem(KEYS.workspace);location.reload()}}

async function memberships(){const {data,error}=await sb.rpc('get_my_workspaces');if(error)throw error;return data||[]}
function setWorkspaceFromMembership(m){currentWorkspace={id:m.workspace_id,name:m.workspace_name||'Zespół',invite_code:m.invite_code||'',owner_id:m.owner_id||'',role:m.role||'member'};localStorage.setItem(KEYS.workspace,currentWorkspace.id)}
async function chooseWorkspace(){
  const list=await memberships(),invite=pendingInvite();
  if(invite){
    const already=list.find(x=>String(x.invite_code||'')===invite);
    if(already){clearInvite();setWorkspaceFromMembership(already);document.getElementById('workspaceOverlay').classList.add('hidden');document.getElementById('teamBtn').style.display='inline-block';return true}
    document.getElementById('workspaceJoinCode').value=invite;document.getElementById('workspaceSkipInvite').style.display=list.length?'block':'none';document.getElementById('workspaceOverlay').classList.remove('hidden');workspaceMsg('Kod z linku jest gotowy. Kliknij „Dołącz kodem”.','ok');setCloudStatus('CHMURA: dołącz do zespołu','warn');return false;
  }
  if(!list.length){currentWorkspace=null;document.getElementById('workspaceSkipInvite').style.display='none';document.getElementById('workspaceOverlay').classList.remove('hidden');setCloudStatus('CHMURA: wybierz zespół','warn');return false}
  const saved=localStorage.getItem(KEYS.workspace),m=list.find(x=>x.workspace_id===saved)||list[0];setWorkspaceFromMembership(m);document.getElementById('workspaceOverlay').classList.add('hidden');document.getElementById('teamBtn').style.display='inline-block';return true;
}
async function skipInvite(){clearInvite();document.getElementById('workspaceJoinCode').value='';document.getElementById('workspaceSkipInvite').style.display='none';try{const ok=await chooseWorkspace();if(ok)await startSync()}catch(e){workspaceMsg(e.message||'Nie udało się wrócić do zespołu.','error')}}
async function createWorkspace(){const name=(document.getElementById('workspaceName').value||'La Peace').trim()||'La Peace';workspaceMsg('Tworzę wspólną bazę…');try{const {data,error}=await sb.rpc('create_workspace',{workspace_name:name});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('Nie udało się utworzyć zespołu.');localStorage.setItem(KEYS.workspace,row.workspace_id);clearInvite();await activateWorkspace(row.workspace_id,row.name||name);workspaceMsg('Utworzono.','ok')}catch(e){workspaceMsg(e.message||'Nie udało się utworzyć zespołu.','error')}}
async function joinWorkspace(){const code=document.getElementById('workspaceJoinCode').value.trim();if(!validUuid(code)){workspaceMsg('Wklej poprawny kod zespołu.','error');return}workspaceMsg('Dołączam…');try{const {data,error}=await sb.rpc('join_workspace',{join_code:code});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('Nie udało się dołączyć.');localStorage.setItem(KEYS.workspace,row.workspace_id);clearInvite();await activateWorkspace(row.workspace_id,row.name||'Zespół');workspaceMsg('Dołączono.','ok')}catch(e){workspaceMsg(e.message||'Nie udało się dołączyć.','error')}}
async function activateWorkspace(id,name){stopSync();currentWorkspace={id,name,invite_code:'',owner_id:'',role:'member'};const list=await memberships(),m=list.find(x=>x.workspace_id===id);if(m)setWorkspaceFromMembership(m);document.getElementById('workspaceOverlay').classList.add('hidden');document.getElementById('workspaceSkipInvite').style.display='none';document.getElementById('teamBtn').style.display='inline-block';await startSync();toast(`Wspólna baza: ${currentWorkspace.name}`)}

function applyRemote(row){applyingRemote=true;try{window.LPPApp.applyRemote(normalizeState(row));lastRemoteSnapshot=stable(row);dirty=false;clearPendingWrite()}finally{applyingRemote=false}}
async function fetchRemote(){const {data,error}=await sb.from('workspace_state').select('quotes,prices,custom_items,active_quote_id,updated_at,updated_by').eq('workspace_id',currentWorkspace.id).maybeSingle();if(error)throw error;return data}
function schedulePush(delay=80){if(!started||applyingRemote)return;dirty=true;savePendingWrite();clearTimeout(pushTimer);pushTimer=setTimeout(pushNow,delay)}
async function pushState(local){setCloudStatus('CHMURA: zapisuję…','warn');const {data,error}=await sb.from('workspace_state').upsert({workspace_id:currentWorkspace.id,...normalizeState(local),updated_by:currentUser.id},{onConflict:'workspace_id'}).select('updated_at').single();if(error)throw error;const snap=stable(local);lastRemoteSnapshot=snap;lastRemoteUpdatedAt=data?.updated_at||'';dirty=false;clearPendingWrite();setCloudStatus(`CHMURA: ${currentWorkspace.name}`,'ok')}
async function pushNow(){
  clearTimeout(pushTimer);pushTimer=null;if(!started||!currentUser||!currentWorkspace||applyingRemote||pushing)return;
  pushing=true;try{const local=stateFromApp();if(stable(local)===lastRemoteSnapshot){dirty=false;clearPendingWrite();return}await pushState(local)}catch(e){dirty=true;setCloudStatus('CHMURA: błąd zapisu','error');console.error('cloud push:',e);savePendingWrite();if(started&&!pushTimer)pushTimer=setTimeout(pushNow,1200)}finally{pushing=false;if(remotePending){remotePending=false;setTimeout(pullNow,0)}}
}
async function pullNow(){
  if(!started||pulling||pushing||dirty||pushTimer||!currentWorkspace)return;pulling=true;
  try{const row=await fetchRemote();if(!row)return;const rs=stable(row);lastRemoteUpdatedAt=row.updated_at||lastRemoteUpdatedAt;if(rs===lastRemoteSnapshot)return;const local=stateFromApp();if(rs===stable(local)){lastRemoteSnapshot=rs;return}applyRemote(row);setCloudStatus(`CHMURA: ${currentWorkspace.name}`,'ok')}
  catch(e){setCloudStatus('CHMURA: błąd odczytu','error');console.error('cloud pull:',e)}finally{pulling=false}
}
function handleRealtime(row){
  if(!started||!row||row.workspace_id!==currentWorkspace?.id)return;
  if(pushing||dirty||pushTimer){remotePending=true;return}
  const rs=stable(row);if(rs===lastRemoteSnapshot)return;
  const local=stateFromApp();if(rs===stable(local)){lastRemoteSnapshot=rs;lastRemoteUpdatedAt=row.updated_at||lastRemoteUpdatedAt;return}
  lastRemoteUpdatedAt=row.updated_at||lastRemoteUpdatedAt;applyRemote(row);setCloudStatus(`CHMURA: ${currentWorkspace.name}`,'ok');
}
function subscribeRealtime(){
  if(realtimeChannel){sb.removeChannel(realtimeChannel).catch(()=>{});realtimeChannel=null}
  if(!currentWorkspace)return;
  realtimeChannel=sb.channel(`workspace-state-${currentWorkspace.id}`)
    .on('postgres_changes',{event:'*',schema:'public',table:'workspace_state',filter:`workspace_id=eq.${currentWorkspace.id}`},payload=>handleRealtime(payload.new))
    .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')setCloudStatus('CHMURA: tryb awaryjny','warn')});
}
async function initialSync(){
  const local=stateFromApp(),remote=await fetchRemote(),pending=loadPendingWrite();
  if(!remote){lastRemoteSnapshot='';await pushState(pending?.workspace_id===currentWorkspace.id?pending.state:local);return}
  const rs=stable(remote);lastRemoteUpdatedAt=remote.updated_at||'';
  if(pending&&pending.workspace_id===currentWorkspace.id){
    const ps=stable(pending.state);
    if(ps===rs){lastRemoteSnapshot=rs;clearPendingWrite();if(stable(local)!==rs)applyRemote(remote);return}
    const remoteMs=Date.parse(remote.updated_at||'')||0;
    if(Number(pending.saved_at||0)>=remoteMs-1500){window.LPPApp.applyRemote(pending.state);await pushState(pending.state);return}
    clearPendingWrite();
  }
  if(stable(local)===rs){lastRemoteSnapshot=rs;return}
  applyRemote(remote);
}
async function startSync(){if(!currentWorkspace||!currentUser)return;stopSync();started=true;setCloudStatus('CHMURA: synchronizacja…','warn');try{await initialSync();subscribeRealtime();pullTimer=setInterval(pullNow,15000);setCloudStatus(`CHMURA: ${currentWorkspace.name}`,'ok')}catch(e){setCloudStatus('CHMURA: błąd synchronizacji','error');console.error('cloud start:',e);pullTimer=setInterval(pullNow,5000)}}
function stopSync(){started=false;clearInterval(pullTimer);clearTimeout(pushTimer);pullTimer=pushTimer=null;dirty=false;pushing=false;pulling=false;remotePending=false;if(realtimeChannel){sb.removeChannel(realtimeChannel).catch(()=>{});realtimeChannel=null}}

async function openTeam(){
  if(!currentWorkspace)return;document.getElementById('teamName').textContent=currentWorkspace.name;const link=`${location.origin}${location.pathname}?join=${currentWorkspace.invite_code}`;document.getElementById('teamInviteLink').textContent=link;document.getElementById('teamInviteWrap').style.display=currentWorkspace.role==='owner'?'block':'none';const membersEl=document.getElementById('teamMembers');membersEl.textContent='Ładowanie…';
  try{const {data,error}=await sb.rpc('workspace_member_directory',{wid:currentWorkspace.id});if(error)throw error;membersEl.innerHTML=(data||[]).map(m=>`<div class="team-row"><span class="team-member">${esc(m.email||m.user_id)}</span><span class="team-role">${m.role==='owner'?'WŁAŚCICIEL':'CZŁONEK'}</span></div>`).join('')||'<div class="team-member">Brak członków.</div>'}catch{membersEl.textContent='Nie udało się pobrać listy członków.'}
  document.getElementById('teamDialog').showModal();
}
async function copyInvite(){const text=document.getElementById('teamInviteLink').textContent||'';try{await navigator.clipboard.writeText(text);toast('Skopiowano link zaproszenia.')}catch{prompt('Skopiuj link:',text)}}
async function rotateInvite(){if(currentWorkspace?.role!=='owner'||!confirm('Wygenerować nowy kod? Stary link przestanie działać.'))return;try{const {data,error}=await sb.rpc('rotate_workspace_invite',{wid:currentWorkspace.id});if(error)throw error;currentWorkspace.invite_code=Array.isArray(data)?data[0]:data;document.getElementById('teamInviteLink').textContent=`${location.origin}${location.pathname}?join=${currentWorkspace.invite_code}`;toast('Wygenerowano nowy link.')}catch{toast('Nie udało się zmienić kodu.')}}

async function bootUser(user){currentUser=user;if(!user){showLoggedOut();return}showLoggedIn(user);try{const ok=await chooseWorkspace();if(ok)await startSync()}catch(e){setCloudStatus('CHMURA: błąd','error');console.error('cloud boot:',e)}}

rememberInvite();installUI();
sb.auth.getSession().then(({data})=>bootUser(data.session?.user||null));
sb.auth.onAuthStateChange((_event,session)=>{const user=session?.user||null;if(user?.id===currentUser?.id)return;stopSync();currentUser=null;currentWorkspace=null;setTimeout(()=>bootUser(user),0)});
window.addEventListener('lpp:data-changed',()=>schedulePush(80));window.addEventListener('focus',pullNow);window.addEventListener('pageshow',pullNow);document.addEventListener('visibilitychange',()=>{if(!document.hidden)pullNow()});window.addEventListener('beforeunload',()=>{if(started&&dirty)savePendingWrite()});
})();
