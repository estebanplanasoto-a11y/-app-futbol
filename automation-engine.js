(()=>{
'use strict';
const STORE='appFutbolAutomationEngineV1';
const GENERATED='appFutbolGeneratedAlertsV1';
const norm=s=>(s??'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const keyNorm=s=>norm(s).replace(/[^a-z0-9]/g,'');
const toNum=v=>{if(v==null)return null;const m=String(v).replace(',','.').match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null};
const pick=(o,names)=>{if(!o||typeof o!=='object')return undefined;for(const [k,v] of Object.entries(o)){const nk=keyNorm(k);if(names.some(n=>nk===n||nk.includes(n)))return v}return undefined};
const asName=v=>{if(v==null)return'';if(typeof v==='string'||typeof v==='number')return String(v).trim();if(typeof v==='object')return String(pick(v,['name','nombre','teamname','equipo','club'])??'').trim();return''};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now=()=>new Date().toISOString();
const load=(k,fallback)=>{try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(fallback))}catch{return fallback}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const state=load(STORE,{runs:0,lastRun:null,lastSummary:null});
let generated=load(GENERATED,[]);
function walk(v,out,seen=new WeakSet(),depth=0,source='storage'){
  if(depth>9||v==null)return;
  if(typeof v==='object'){
    if(seen.has(v))return;seen.add(v);
    out.push({value:v,source});
    if(Array.isArray(v)){for(const x of v)walk(x,out,seen,depth+1,source)}
    else for(const x of Object.values(v))walk(x,out,seen,depth+1,source);
  }
}
function collectObjects(){
  const out=[];
  for(const st of [localStorage,sessionStorage]){
    for(let i=0;i<st.length;i++){
      const k=st.key(i);if(!k||k===STORE||k===GENERATED)continue;
      try{walk(JSON.parse(st.getItem(k)),out,new WeakSet(),0,k)}catch{}
    }
  }
  for(const k of Object.getOwnPropertyNames(window)){
    if(!/(match|partid|fixture|game|line|strategy|study|pronost|pick|alert|aviso|automat)/i.test(k))continue;
    try{const v=window[k];if(v&&typeof v==='object')walk(v,out,new WeakSet(),0,'window.'+k)}catch{}
  }
  return out;
}
function isDisabled(o){
  const v=pick(o,['active','activo','enabled','habilitado','status','estado']);
  if(v===false||v===0)return true;
  const t=norm(v);
  return ['false','inactive','inactivo','disabled','desactivado','no activar','descartada','descartado'].some(x=>t.includes(x));
}
function lineFrom(o){
  const name=asName(pick(o,['linea','linename','nombrelinea','line','studyline','estudio','strategy','estrategia','study']));
  if(!name||name.length>220)return null;
  const hit=pick(o,['historicalhitrate','historicalhit','hithistorico','aciertohistorico','porcentajehistorico','percenthistorico','histacierto','hitratehist','pcthistorico','acierto']);
  const roi=pick(o,['historicalroi','roihistorico','histroi','roihist','roi']);
  const market=asName(pick(o,['apuesta','mercado','market','bet','pick']));
  const league=asName(pick(o,['liga','competicion','competition','league']));
  const minOdds=toNum(pick(o,['minodds','cuotamin','cuotaminima','oddsmin','minimumodds']));
  const maxOdds=toNum(pick(o,['maxodds','cuotamax','cuotamaxima','oddsmax','maximumodds']));
  const stake=pick(o,['stake','unidades','units']);
  return {name,histHit:hit,histRoi:roi,market,league,minOdds,maxOdds,stake,active:!isDisabled(o),raw:o};
}
function team(o,side){
  const names=side==='home'?['home','hometeam','local','equipolocal','teamhome','host']:['away','awayteam','visitante','equipovisitante','teamaway','visitor'];
  return asName(pick(o,names));
}
function matchFrom(o,source){
  const home=team(o,'home'),away=team(o,'away');
  if(!home||!away||home===away)return null;
  const date=pick(o,['date','fecha','datetime','kickoff','starttime','matchdate']);
  const league=asName(pick(o,['liga','competicion','competition','league','tournament']));
  const market=asName(pick(o,['apuesta','mercado','market','bet','pick','selection']));
  const line=asName(pick(o,['linea','linename','nombrelinea','line','studyline','estudio','strategy','estrategia']));
  const odds=toNum(pick(o,['cuota','odds','price']));
  const homePts=toNum(pick(o,['homepoints','localpoints','puntoslocal','homeformpoints','formhomepoints','homepts','ptslocal','puntoslocalultimos5']));
  const awayPts=toNum(pick(o,['awaypoints','visitorpoints','visitantepoints','puntosvisitante','awayformpoints','formawaypoints','awaypts','ptsvisitante','puntosvisitanteultimos5']));
  const currentHit=pick(o,['currenthitrate','currenthit','aciertoactual','porcentajeactual','pctactual']);
  const currentRoi=pick(o,['currentroi','roiactual']);
  return {home,away,date,league,market,line,odds,homePts,awayPts,currentHit,currentRoi,raw:o,source};
}
function marketFromLine(name){const t=norm(name);if(t.includes('under 2.5')||t.includes('under2.5'))return'Under 2.5';if(t.includes('over 2.5')||t.includes('over2.5'))return'Over 2.5';if(t.includes('empate')||/\bdraw\b/.test(t))return'Empate';if(t.includes('visitante')||/\bvisitor\b/.test(t)||/\baway\b/.test(t))return'Visitante';if(t.includes('local')||/\bhome\b/.test(t))return'Local';return''}
function lineMatchesMatch(line,m){
  if(!line.active)return false;
  const lt=norm(line.name+' '+line.league+' '+JSON.stringify(line.raw||{}));
  if(line.league&&m.league&&!norm(m.league).includes(norm(line.league))&&!norm(line.league).includes(norm(m.league)))return false;
  if(line.minOdds!=null&&m.odds!=null&&m.odds<line.minOdds)return false;
  if(line.maxOdds!=null&&m.odds!=null&&m.odds>line.maxOdds)return false;
  const exact=lt.match(/(?:^|\D)(\d{1,2})\s*v(?:s)?\s*(\d{1,2})(?:\D|$)/);
  if(exact&&m.homePts!=null&&m.awayPts!=null){if(m.homePts!==Number(exact[1])||m.awayPts!==Number(exact[2]))return false;return true}
  if(m.homePts!=null&&m.awayPts!=null){
    if((/7\s*\+|>=\s*7|7 o mas|buena forma/.test(lt))&&(/<=\s*4|4\s*-|4 o menos|debil/.test(lt)))return m.homePts>=7&&m.awayPts<=4;
    if((/visitante.*7\s*\+/.test(lt)||/away.*7\s*\+/.test(lt))&&(/local.*<=\s*4/.test(lt)||/home.*<=\s*4/.test(lt)))return m.awayPts>=7&&m.homePts<=4;
  }
  if(m.line&&norm(m.line)===norm(line.name))return true;
  const mt=norm(JSON.stringify(m.raw||{}));
  const tokens=norm(line.name).split(/[^a-z0-9]+/).filter(x=>x.length>=5);
  const shared=tokens.filter(x=>mt.includes(x)).length;
  return shared>=2;
}
function idFor(a){return norm([a.date,a.league,a.home,a.away,a.bet,a.line].join('|'))}
function existingAlertIds(){
  const ids=new Set(generated.map(idFor));
  for(const t of document.querySelectorAll('table')){
    const parent=norm(t.parentElement?.textContent);if(!/(aviso|pronost|pick)/.test(parent))continue;
    for(const r of t.querySelectorAll('tbody tr'))ids.add(norm(r.textContent));
  }
  return ids;
}
function deriveAlerts(){
  const objs=collectObjects();
  const lines=[];const matches=[];
  for(const e of objs){const l=lineFrom(e.value);if(l)lines.push(l);const m=matchFrom(e.value,e.source);if(m)matches.push(m)}
  const uniqueLines=[];const lineSeen=new Set();
  for(const l of lines){const k=norm(l.name);if(!k||lineSeen.has(k))continue;lineSeen.add(k);uniqueLines.push(l)}
  const out=[];const seen=new Set();
  for(const m of matches){
    const applicable=[];
    if(m.line){const exact=uniqueLines.find(l=>norm(l.name)===norm(m.line)&&l.active);if(exact)applicable.push(exact)}
    for(const l of uniqueLines){if(applicable.includes(l))continue;if(lineMatchesMatch(l,m))applicable.push(l)}
    if(!applicable.length&&!(m.market&&m.line))continue;
    if(!applicable.length){applicable.push({name:m.line,histHit:null,histRoi:null,market:m.market,stake:null,active:true})}
    for(const l of applicable){
      const bet=m.market||l.market||marketFromLine(l.name)||'Pendiente de definir';
      const a={date:m.date||'',league:m.league||l.league||'',home:m.home,away:m.away,bet,line:l.name,histHit:l.histHit??null,histRoi:l.histRoi??null,currentHit:m.currentHit??null,currentRoi:m.currentRoi??null,odds:m.odds??null,minOdds:l.minOdds??null,maxOdds:l.maxOdds??null,stake:l.stake??null,source:m.source,detectedAt:now()};
      const id=idFor(a);if(!id||seen.has(id))continue;seen.add(id);out.push(a);
    }
  }
  return {alerts:out,lines:uniqueLines.length,matches:matches.length};
}
function isExisting(a){
  const target=norm([a.home,a.away,a.bet,a.line].join(' '));
  for(const t of document.querySelectorAll('table')){
    const parent=norm(t.parentElement?.textContent);if(!/(aviso|pronost|pick)/.test(parent))continue;
    for(const r of t.querySelectorAll('tbody tr')){const rt=norm(r.textContent);if(rt.includes(norm(a.home))&&rt.includes(norm(a.away))&&(rt.includes(norm(a.bet))||rt.includes(norm(a.line))))return true}
  }
  return generated.some(x=>idFor(x)===idFor(a));
}
function avisosHost(){
  const candidates=[...document.querySelectorAll('h1,h2,h3,[role="tab"],button,a')].filter(e=>norm(e.textContent).includes('aviso'));
  for(const c of candidates){let p=c;for(let i=0;i<6&&p;i++,p=p.parentElement){if(p.querySelector?.('table')||norm(p.textContent).includes('avisos'))return p}}
  return document.body;
}
function fmtPct(v){if(v==null||v==='')return'Pendiente';const n=toNum(v);return n==null?esc(v):`${n.toFixed(2)}%`}
function renderGenerated(){
  let box=document.querySelector('[data-af-auto-alerts]');
  if(!generated.length){box?.remove();return}
  const host=avisosHost();if(!host)return;
  if(!box){box=document.createElement('section');box.dataset.afAutoAlerts='1';box.style.cssText='margin:16px 0;padding:14px;border:1px solid #d1d5db;border-radius:14px;background:#fff;overflow:auto';host.appendChild(box)}
  box.innerHTML=`<h3 style="margin:0 0 10px">Avisos automáticos</h3><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th>Fecha</th><th>Competición</th><th>Partido</th><th>Apuesta</th><th>Línea</th><th>% histórico</th><th>ROI histórico</th><th>% actual</th><th>ROI actual</th><th>Cuota</th><th>Rango cuota</th><th>Stake</th><th></th></tr></thead><tbody>${generated.map((a,i)=>`<tr><td>${esc(a.date)}</td><td>${esc(a.league)}</td><td>${esc(a.home)} - ${esc(a.away)}</td><td>${esc(a.bet)}</td><td>${esc(a.line)}</td><td>${fmtPct(a.histHit)}</td><td>${fmtPct(a.histRoi)}</td><td>${fmtPct(a.currentHit)}</td><td>${fmtPct(a.currentRoi)}</td><td>${a.odds??'Pendiente'}</td><td>${a.minOdds!=null||a.maxOdds!=null?`${a.minOdds??''}${a.minOdds!=null&&a.maxOdds!=null?'–':''}${a.maxOdds??''}`:'Pendiente'}</td><td>${esc(a.stake??'Pendiente')}</td><td><button data-af-auto-delete="${i}" style="border:0;border-radius:8px;padding:6px 8px;background:#b91c1c;color:#fff;font-weight:700">Eliminar</button></td></tr>`).join('')}</tbody></table>`;
  box.querySelectorAll('[data-af-auto-delete]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.afAutoDelete);generated.splice(i,1);save(GENERATED,generated);renderGenerated()});
}
function toast(msg){let d=document.createElement('div');d.textContent=msg;d.style.cssText='position:fixed;right:14px;bottom:14px;z-index:999999;background:#111827;color:white;padding:12px 16px;border-radius:10px;box-shadow:0 8px 30px #0003;max-width:430px';document.body.appendChild(d);setTimeout(()=>d.remove(),4500)}
async function run(){
  const scan=deriveAlerts();let added=0;
  for(const a of scan.alerts){if(isExisting(a))continue;generated.push(a);added++}
  const dedup=new Map();for(const a of generated)dedup.set(idFor(a),a);generated=[...dedup.values()];save(GENERATED,generated);
  state.runs=(state.runs||0)+1;state.lastRun=now();state.lastSummary={added,lines:scan.lines,matches:scan.matches,totalCandidates:scan.alerts.length};save(STORE,state);renderGenerated();
  window.appFutbolVerifyAssociations?.();
  if(added)toast(`Automatización ejecutada: ${added} pronóstico${added===1?'':'s'} añadido${added===1?'':'s'} a Avisos.`);
  else toast(`Automatización ejecutada: 0 nuevos. Revisados ${scan.matches} registros de partido y ${scan.lines} líneas activas/detectadas.`);
  return state.lastSummary;
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-af-run-now]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();run()},true);
const mo=new MutationObserver(()=>renderGenerated());mo.observe(document.documentElement,{subtree:true,childList:true});
setTimeout(renderGenerated,900);setTimeout(renderGenerated,2200);
window.appFutbolAutomation={run,scan:deriveAlerts,getGenerated:()=>generated.slice(),state:()=>({...state})};
window.appFutbolRunNow=run;
})();