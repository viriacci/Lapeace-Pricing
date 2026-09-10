(()=>{
'use strict';

const SUPABASE_URL='https://dxrnijmpnjegsxaliwmc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_7goMLYW4rP04ZgYZiKr3Hg_RT12TvED';
const KEYS={
  workspace:'lpp.workspace.v1',
  quotes:'lpp.quotes.v1',
  active:'lpp.activeQuote.v1',
  legacyQuote:'lpp.quote.v1',
  prices:'lpp.prices.v1',
  custom:'lpp.custom.v1'
};

if(!window.supabase)return;
const client=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

let lastUpdatedAt='';
let busy=false;
let timer=null;

function parse(raw,fallback){try{return JSON.parse(raw)??fallback}catch{return fallback}}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b)}

function applyRemote(row){
  const remoteQuotes=Array.isArray(row.quotes)?row.quotes:[];
  const remotePrices=row.prices&&typeof row.prices==='object'&&!Array.isArray(row.prices)?row.prices:{};
  const remoteCustom=Array.isArray(row.custom_items)?row.custom_items:[];
  const remoteActive=row.active_quote_id||remoteQuotes[0]?.id||'';

  const currentQuotes=parse(localStorage.getItem(KEYS.quotes),[]);
  const currentPrices=parse(localStorage.getItem(KEYS.prices),{});
  const currentCustom=parse(localStorage.getItem(KEYS.custom),[]);
  const currentActive=localStorage.getItem(KEYS.active)||'';

  let changed=false;
  if(!same(currentQuotes,remoteQuotes)){localStorage.setItem(KEYS.quotes,JSON.stringify(remoteQuotes));changed=true}
  if(!same(currentPrices,remotePrices)){localStorage.setItem(KEYS.prices,JSON.stringify(remotePrices));changed=true}
  if(!same(currentCustom,remoteCustom)){localStorage.setItem(KEYS.custom,JSON.stringify(remoteCustom));changed=true}
  if(currentActive!==remoteActive){
    if(remoteActive)localStorage.setItem(KEYS.active,remoteActive); else localStorage.removeItem(KEYS.active);
    changed=true;
  }

  const activeQuote=remoteQuotes.find(q=>q&&q.id===remoteActive)||remoteQuotes[0]||null;
  const remoteItems=Array.isArray(activeQuote?.items)?activeQuote.items:[];
  const currentLegacy=parse(localStorage.getItem(KEYS.legacyQuote),[]);
  if(!same(currentLegacy,remoteItems)){localStorage.setItem(KEYS.legacyQuote,JSON.stringify(remoteItems));changed=true}

  // Najważniejsze: aktualizujemy też stan żyjący już w pamięci strony.
  // Sam localStorage nie przerysowuje aplikacji w tej samej karcie.
  if(typeof window.state==='object'&&window.state){
    if(!same(window.state.quote,remoteItems)){window.state.quote=JSON.parse(JSON.stringify(remoteItems));changed=true}
    if(!same(window.state.prices,remotePrices))window.state.prices=JSON.parse(JSON.stringify(remotePrices));
    if(!same(window.state.custom,remoteCustom))window.state.custom=JSON.parse(JSON.stringify(remoteCustom));
  }

  if(changed&&typeof window.renderQuote==='function'){
    try{window.renderQuote()}catch(e){console.error('cloud-live-view render:',e)}
  }

  const title=document.getElementById('activeQuoteName');
  if(title&&activeQuote?.name)title.textContent=activeQuote.name;
}

async function pull(){
  if(busy)return;
  busy=true;
  try{
    const workspaceId=localStorage.getItem(KEYS.workspace);
    if(!workspaceId)return;
    const {data:{session}}=await client.auth.getSession();
    if(!session?.user)return;
    const {data,error}=await client.from('workspace_state')
      .select('quotes,prices,custom_items,active_quote_id,updated_at')
      .eq('workspace_id',workspaceId)
      .maybeSingle();
    if(error){console.error('cloud-live-view:',error);return}
    if(!data)return;
    if(data.updated_at&&data.updated_at===lastUpdatedAt)return;
    lastUpdatedAt=data.updated_at||'';
    applyRemote(data);
  }catch(e){console.error('cloud-live-view:',e)}
  finally{busy=false}
}

function start(){
  clearInterval(timer);
  pull();
  timer=setInterval(pull,700);
}

window.addEventListener('focus',pull);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pull()});
window.addEventListener('pageshow',pull);
setTimeout(start,250);
})();
