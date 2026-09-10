(()=>{
'use strict';

if(!window.supabase)return;

const URL='https://dxrnijmpnjegsxaliwmc.supabase.co';
const KEY='sb_publishable_7goMLYW4rP04ZgYZiKr3Hg_RT12TvED';
const WORKSPACE='lpp.workspace.v1';
const QUOTES='lpp.quotes.v1';
const ACTIVE='lpp.activeQuote.v1';
const LEGACY='lpp.quote.v1';
const PRICES='lpp.prices.v1';
const CUSTOM='lpp.custom.v1';
const sbLive=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

let busy=false;
let lastApplied='';

function parse(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function stable(v){return JSON.stringify(v)}

function applyToView(remote){
  const quotes=Array.isArray(remote?.quotes)?remote.quotes:[];
  const activeId=remote?.active_quote_id||localStorage.getItem(ACTIVE)||quotes[0]?.id||'';
  const active=quotes.find(q=>q?.id===activeId)||quotes[0]||null;
  const items=Array.isArray(active?.items)?active.items:[];
  const prices=remote?.prices&&typeof remote.prices==='object'?remote.prices:{};
  const custom=Array.isArray(remote?.custom_items)?remote.custom_items:[];

  localStorage.setItem(QUOTES,JSON.stringify(quotes));
  if(activeId)localStorage.setItem(ACTIVE,activeId);
  localStorage.setItem(LEGACY,JSON.stringify(items));
  localStorage.setItem(PRICES,JSON.stringify(prices));
  localStorage.setItem(CUSTOM,JSON.stringify(custom));

  try{
    if(typeof state!=='undefined'){
      state.quote=JSON.parse(JSON.stringify(items));
      state.prices={...prices};
      state.custom=JSON.parse(JSON.stringify(custom));
      if(typeof renderQuote==='function')renderQuote();
    }
  }catch(err){console.error('live-view-sync render:',err)}

  const title=document.getElementById('activeQuoteName');
  if(title&&active?.name)title.textContent=active.name;
  const badge=document.getElementById('activeQuoteStatus');
  if(badge&&active){
    const done=active.status==='done';
    badge.textContent=done?'ZREALIZOWANO':'W TRAKCIE';
    badge.className='quote-status '+(done?'done':'active');
  }
}

async function pull(){
  if(busy)return;
  const workspaceId=localStorage.getItem(WORKSPACE);
  if(!workspaceId)return;
  const {data:{session}}=await sbLive.auth.getSession();
  if(!session?.user)return;

  busy=true;
  try{
    const {data,error}=await sbLive.from('workspace_state').select('quotes,prices,custom_items,active_quote_id,updated_at').eq('workspace_id',workspaceId).maybeSingle();
    if(error)throw error;
    if(!data)return;
    const snap=stable({quotes:data.quotes||[],prices:data.prices||{},custom_items:data.custom_items||[],active_quote_id:data.active_quote_id||null,updated_at:data.updated_at||null});
    if(snap===lastApplied)return;
    lastApplied=snap;
    applyToView(data);
  }catch(err){console.error('live-view-sync:',err)}
  finally{busy=false}
}

setTimeout(pull,100);
setInterval(pull,700);
window.addEventListener('focus',pull);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pull()});
})();
