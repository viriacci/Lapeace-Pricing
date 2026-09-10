(()=>{
'use strict';

function getQuotes(){
  try{return JSON.parse(localStorage.getItem('lpp.quotes.v1')||'[]')}catch{return []}
}

function getActiveId(){return localStorage.getItem('lpp.activeQuote.v1')||''}

function saveQuotes(quotes){
  localStorage.setItem('lpp.quotes.v1',JSON.stringify(quotes));
}

function renameActiveQuote(){
  const quotes=getQuotes();
  const activeId=getActiveId();
  const q=quotes.find(x=>x.id===activeId);
  if(!q)return;
  const next=prompt('Nowa nazwa wyceny:',q.name||'Wycena');
  if(next===null)return;
  const name=next.trim();
  if(!name)return;
  q.name=name;
  q.updatedAt=new Date().toISOString();
  saveQuotes(quotes);
  const title=document.getElementById('activeQuoteName');
  if(title)title.textContent=name;
  window.dispatchEvent(new StorageEvent('storage',{key:'lpp.quotes.v1',newValue:JSON.stringify(quotes)}));
}

function install(){
  const title=document.getElementById('activeQuoteName');
  if(!title || document.getElementById('renameActiveQuoteBtn'))return;
  const btn=document.createElement('button');
  btn.id='renameActiveQuoteBtn';
  btn.type='button';
  btn.className='ghost';
  btn.textContent='Zmień nazwę';
  btn.style.padding='7px 10px';
  btn.style.fontSize='12px';
  btn.onclick=renameActiveQuote;
  title.parentElement?.appendChild(btn);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);
else install();
setTimeout(install,300);
})();
