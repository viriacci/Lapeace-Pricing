(()=>{
'use strict';

const LEGACY_QUOTE_KEY='lpp.quote.v1';
const QUOTES_KEY='lpp.quotes.v1';
const ACTIVE_KEY='lpp.activeQuote.v1';

const nativeSetItem=Storage.prototype.setItem;

function mirrorLegacyQuote(rawValue){
  try{
    const items=JSON.parse(rawValue||'[]');
    const quotes=JSON.parse(localStorage.getItem(QUOTES_KEY)||'[]');
    const activeId=localStorage.getItem(ACTIVE_KEY)||'';
    if(!Array.isArray(items)||!Array.isArray(quotes)||!activeId)return;
    const q=quotes.find(x=>x&&x.id===activeId);
    if(!q)return;
    const old=JSON.stringify(q.items||[]);
    const next=JSON.stringify(items);
    if(old===next)return;
    q.items=items;
    q.updatedAt=new Date().toISOString();
    nativeSetItem.call(localStorage,QUOTES_KEY,JSON.stringify(quotes));
    window.dispatchEvent(new CustomEvent('lpp:quote-changed',{detail:{activeId}}));
  }catch(err){
    console.error('Nie udało się zsynchronizować aktywnej wyceny:',err);
  }
}

Storage.prototype.setItem=function(key,value){
  nativeSetItem.call(this,key,value);
  if(this===localStorage&&key===LEGACY_QUOTE_KEY)mirrorLegacyQuote(value);
};

// Jednorazowe wyrównanie po załadowaniu skryptu.
const current=localStorage.getItem(LEGACY_QUOTE_KEY);
if(current!==null)mirrorLegacyQuote(current);
})();
