(()=>{
'use strict';

const PENDING_JOIN_KEY='lpp.pendingJoinCode.v1';

function validJoinCode(value){
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value||'').trim());
}

function rememberInviteFromUrl(){
  const url=new URL(window.location.href);
  const code=(url.searchParams.get('join')||'').trim();
  if(!validJoinCode(code))return;
  localStorage.setItem(PENDING_JOIN_KEY,code);
}

function pendingCode(){
  const code=(localStorage.getItem(PENDING_JOIN_KEY)||'').trim();
  return validJoinCode(code)?code:'';
}

function fillJoinForm(){
  const code=pendingCode();
  if(!code)return false;
  const input=document.getElementById('workspaceJoinCode');
  if(!input)return false;

  if(input.value!==code){
    input.value=code;
    input.dispatchEvent(new Event('input',{bubbles:true}));
  }

  const msg=document.getElementById('workspaceMsg');
  if(msg && !msg.dataset.inviteHint){
    msg.textContent='Wykryto kod zaproszenia z linku. Zaloguj się, a potem kliknij „Dołącz kodem”.';
    msg.className='auth-msg ok';
    msg.dataset.inviteHint='1';
  }
  return true;
}

function clearInviteAfterMembership(){
  const code=pendingCode();
  if(!code)return;
  const overlay=document.getElementById('workspaceOverlay');
  const teamButton=document.getElementById('teamBtn');
  const overlayHidden=overlay && overlay.classList.contains('hidden');
  const teamVisible=teamButton && teamButton.style.display!=='none';
  if(overlayHidden && teamVisible){
    localStorage.removeItem(PENDING_JOIN_KEY);
    const url=new URL(window.location.href);
    if(url.searchParams.has('join')){
      url.searchParams.delete('join');
      history.replaceState(null,'',url.pathname+url.search+url.hash);
    }
  }
}

rememberInviteFromUrl();

const observer=new MutationObserver(()=>{
  fillJoinForm();
  clearInviteAfterMembership();
});
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});

window.addEventListener('DOMContentLoaded',()=>{
  fillJoinForm();
  clearInviteAfterMembership();
});

setInterval(()=>{
  fillJoinForm();
  clearInviteAfterMembership();
},1000);
})();
