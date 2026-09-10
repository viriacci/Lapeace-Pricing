(()=>{
'use strict';

const SUPABASE_URL='https://dxrnijmpnjegsxaliwmc.supabase.co';
const SUPABASE_PUBLISHABLE_KEY='sb_publishable_7goMLYW4rP04ZgYZiKr3Hg_RT12TvED';
const KEYS={
  quotes:'lpp.quotes.v1',
  active:'lpp.activeQuote.v1',
  prices:'lpp.prices.v1',
  custom:'lpp.custom.v1',
  legacyQuote:'lpp.quote.v1',
  workspace:'lpp.workspace.v1'
};

if(!window.supabase)return;
const sbHotfix=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});

const originalSetItem=Storage.prototype.setItem;
const originalRemoveItem=Storage.prototype.removeItem;
let pushTimer=null;
let pushing=false;
let pending=false;
let lastPushed='';

function parse(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
function snapshot(){
  return {
    quotes:parse(KEYS.quotes,[]),
    prices:parse(KEYS.prices,{}),
    custom_items:parse(KEYS.custom,[]),
    active_quote_id:localStorage.getItem(KEYS.active)||null
  };
}
function stable(v){return JSON.stringify(v)}

function mirrorLegacyQuote(value){
  let items;
  try{items=JSON.parse(value)}catch{return}
  if(!Array.isArray(items))return;
  const quotes=parse(KEYS.quotes,[]);
  const activeId=localStorage.getItem(KEYS.active)||'';
  const q=quotes.find(x=>x&&x.id===activeId);
  if(!q)return;
  q.items=items;
  q.updatedAt=new Date().toISOString();
  originalSetItem.call(localStorage,KEYS.quotes,JSON.stringify(quotes));
}

function schedulePush(){
  clearTimeout(pushTimer);
  pushTimer=setTimeout(pushNow,120);
}

async function pushNow(){
  if(pushing){pending=true;return}
  const workspaceId=localStorage.getItem(KEYS.workspace);
  if(!workspaceId)return;
  const {data:{session}}=await sbHotfix.auth.getSession();
  if(!session?.user)return;
  const state=snapshot();
  const snap=stable(state);
  if(snap===lastPushed)return;
  pushing=true;
  try{
    const {error}=await sbHotfix.from('workspace_state').upsert({
      workspace_id:workspaceId,
      ...state,
      updated_by:session.user.id
    },{onConflict:'workspace_id'});
    if(!error)lastPushed=snap;
    else console.error('sync-hotfix:',error);
  }catch(err){
    console.error('sync-hotfix:',err);
  }finally{
    pushing=false;
    if(pending){pending=false;schedulePush()}
  }
}

function onLocalWrite(key,value){
  if(key===KEYS.legacyQuote)mirrorLegacyQuote(value);
  if([KEYS.legacyQuote,KEYS.quotes,KEYS.active,KEYS.prices,KEYS.custom].includes(key))schedulePush();
}

Storage.prototype.setItem=function(key,value){
  const result=originalSetItem.call(this,key,value);
  if(this===localStorage)onLocalWrite(String(key),String(value));
  return result;
};

Storage.prototype.removeItem=function(key){
  const result=originalRemoveItem.call(this,key);
  if(this===localStorage&&[KEYS.active,KEYS.prices,KEYS.custom,KEYS.quotes].includes(String(key)))schedulePush();
  return result;
};

// Na starcie zapamiętujemy aktualny stan. Kolejne lokalne zmiany są wysyłane natychmiast,
// zanim starszy stan z chmury zdąży je nadpisać.
lastPushed=stable(snapshot());
})();
