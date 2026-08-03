const partCount=7;
const urls=Array.from({length:partCount},(_,i)=>`./app-parts/${String(i+1).padStart(2,'0')}.txt?v=3`);
try{
  const responses=await Promise.all(urls.map(async url=>{
    const response=await fetch(url,{cache:'no-store'});
    if(!response.ok)throw new Error(`${url}: HTTP ${response.status}`);
    return response.text();
  }));
  const source=responses.join('');
  const blob=new Blob([source],{type:'text/javascript'});
  await import(URL.createObjectURL(blob));
}catch(error){
  console.error(error);
  document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-content:center;background:#07080a;color:#eee;font-family:system-ui;padding:24px"><section><h1>VOIN V3 failed to load</h1><p>${String(error.message||error)}</p><p>Reload once GitHub Pages finishes publishing.</p></section></main>`;
}
