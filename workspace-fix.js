(()=>{
  'use strict';

  const RELOAD_KEY='lpp.workspace.joinReload.v1';

  function finishJoinIfNeeded(){
    const overlay=document.getElementById('workspaceOverlay');
    const msg=document.getElementById('workspaceMsg');
    if(!overlay||!msg)return;

    if(overlay.classList.contains('hidden')){
      sessionStorage.removeItem(RELOAD_KEY);
      return;
    }

    const text=(msg.textContent||'').trim().toLowerCase();
    if(text.startsWith('dołączono')){
      overlay.classList.add('hidden');
      if(sessionStorage.getItem(RELOAD_KEY)!=='1'){
        sessionStorage.setItem(RELOAD_KEY,'1');
        setTimeout(()=>location.reload(),250);
      }
    }
  }

  const observer=new MutationObserver(finishJoinIfNeeded);
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
  window.addEventListener('DOMContentLoaded',finishJoinIfNeeded);
  setInterval(finishJoinIfNeeded,500);
})();
