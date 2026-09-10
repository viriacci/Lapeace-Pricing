(()=>{
'use strict';
const QUOTES_KEY='lpp.quotes.v1';
const ACTIVE_KEY='lpp.activeQuote.v1';
const LEGACY_KEY='lpp.quote.v1';
try{
  const quotes=JSON.parse(localStorage.getItem(QUOTES_KEY)||'[]');
  const activeId=localStorage.getItem(ACTIVE_KEY)||'';
  if(!Array.isArray(quotes)||!quotes.length)return;
  const q=quotes.find(x=>x&&x.id===activeId)||quotes[0];
  if(!q)return;
  localStorage.setItem(LEGACY_KEY,JSON.stringify(Array.isArray(q.items)?q.items:[]));
}catch(err){
  console.error('quote-bootstrap:',err);
}
})();
