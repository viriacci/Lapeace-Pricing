(()=>{
  'use strict';

  const SUPABASE_URL='https://dxrnijmpnjegsxaliwmc.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY='sb_publishable_7goMLYW4rP04ZgYZiKr3Hg_RT12TvED';
  const KEYS={quotes:'lpp.quotes.v1',active:'lpp.activeQuote.v1',prices:'lpp.prices.v1',custom:'lpp.custom.v1'};
  const WORKSPACE_KEY='lpp.workspace.v1';

  if(!window.supabase)return;
  const sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});

  function parse(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback}catch{return fallback}}
  function stateFromLocal(){return{
    quotes:parse(KEYS.quotes,[]),
    prices:parse(KEYS.prices,{}),
    custom_items:parse(KEYS.custom,[]),
    active_quote_id:localStorage.getItem(KEYS.active)||null
  }}

  async function forceSave(){
    const workspaceId=localStorage.getItem(WORKSPACE_KEY);
    if(!workspaceId)return;
    const {data:{user}}=await sb.auth.getUser();
    if(!user)return;
    const payload=stateFromLocal();
    const {error}=await sb.from('workspace_state').upsert({
      workspace_id:workspaceId,
      ...payload,
      updated_by:user.id
    },{onConflict:'workspace_id'});
    if(error)console.error('Nie udało się zapisać zmiany nazwy wyceny:',error);
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest('button');
    if(!btn)return;
    const isRename=btn.classList.contains('ql-rename') || /zmień nazwę/i.test((btn.textContent||'').trim());
    if(!isRename)return;
    setTimeout(forceSave,120);
  },true);
})();
