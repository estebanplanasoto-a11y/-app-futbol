(()=>{
'use strict';
const norm=s=>(s??'').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
const n=v=>{const m=String(v??'').replace(',','.').match(/[-+]?\d+(?:\.\d+)?/);return m?Number(m[0]):null};
const headers=t=>[...t.querySelectorAll('thead th')].map(x=>norm(x.textContent));
const pct=v=>v==null||v===''?'Pendiente':`${Number(v).toFixed(2)}%`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const style=document.createElement('style');
style.textContent='.afv-pos{background:#dcfce7!important;color:#166534!important;font-weight:700}.afv-neg{background:#fee2e2!important;color:#991b1b!important;font-weight:700}';document.head.appendChild(style);
function colorStats(){
  for(const t of document.querySelectorAll('table')){
    const hs=headers(t); const ctx=norm(t.parentElement?.textContent);
    const roi=hs.findIndex(h=>h.includes('roi')); const ben=hs.findIndex(h=>h.includes('beneficio')||h.includes('profit'));
    if(roi<0&&ben<0)continue;
    if(!ctx.includes('estad')&&!hs.some(h=>h.includes('linea')))continue;
    for(const r of t.querySelectorAll('tbody tr'))for(const i of [roi,ben])if(i>=0&&r.cells[i]){const v=n(r.cells[i].textContent);r.cells[i].classList.remove('afv-pos','afv-neg');if(v>0)r.cells[i].classList.add('afv-pos');else if(v<0)r.cells[i].classList.add('afv-neg');}
  }
}
function findResolved(){
  let best=null,score=-1;
  for(const t of document.querySelectorAll('table')){const hs=headers(t),ctx=norm(t.parentElement?.textContent);let s=0;if(ctx.includes('resuelt'))s+=5;if(hs.some(h=>h.includes('partido')))s+=2;if(hs.some(h=>h.includes('estado')||h.includes('resultado')))s+=2;if(hs.some(h=>h.includes('cuota')))s++;if(s>score){score=s;best=t}}
  return score>=4?best:null;
}
function ensureCol(t,label,test){let hs=headers(t),i=hs.findIndex(test);if(i>=0)return i;const th=document.createElement('th');th.textContent=label;t.tHead?.rows[0]?.appendChild(th);for(const r of t.querySelectorAll('tbody tr'))r.insertCell();return headers(t).length-1;}
function enhanceResolvedData(){
  const t=findResolved();if(!t||!t.tHead)return;
  const li=ensureCol(t,'Línea',h=>h==='linea'||h.includes('línea'));
  const hi=ensureCol(t,'% actual',h=>h.includes('% actual')||h.includes('acierto actual'));
  const ri=ensureCol(t,'ROI actual',h=>h.includes('roi actual'));
  let hs=headers(t);const pi=hs.findIndex(h=>h.includes('partido'));const ei=hs.findIndex(h=>h.includes('estado')||h.includes('resultado'));const oi=hs.findIndex(h=>h.includes('cuota'));
  const lineRows=new Map();
  for(const r of t.querySelectorAll('tbody tr')){
    while(r.cells.length<headers(t).length)r.insertCell();
    const match=norm(pi>=0?r.cells[pi]?.textContent:r.textContent);
    if(match.includes('como')&&match.includes('leipzig')){
      if(!r.cells[li].textContent.trim())r.cells[li].textContent='Favorito local Champions 1,70–1,84';
    }
    const line=r.cells[li]?.textContent.trim();if(!line)continue;
    const k=norm(line);if(!lineRows.has(k))lineRows.set(k,[]);lineRows.get(k).push(r);
  }
  for(const [k,rows] of lineRows){let wins=0,resolved=0,profit=0,hasProfit=true;for(const r of rows){const st=norm(ei>=0?r.cells[ei]?.textContent:r.textContent);let win=null;if(/ganad|acert|win|verde/.test(st))win=true;else if(/perdid|fall|loss|rojo/.test(st))win=false;if(win!==null){resolved++;if(win)wins++;const odds=oi>=0?n(r.cells[oi]?.textContent):null;if(odds==null)hasProfit=false;else profit+=win?(odds-1):-1;}}
    const hit=resolved?100*wins/resolved:null;const roi=resolved&&hasProfit?100*profit/resolved:null;
    for(const r of rows){if(hit!=null)r.cells[hi].textContent=pct(hit);if(roi!=null)r.cells[ri].textContent=pct(roi);}
  }
}
function domLines(){
  const out=[];
  for(const t of document.querySelectorAll('table')){const hs=headers(t);const li=hs.findIndex(h=>h==='linea'||h.includes('línea'));if(li<0)continue;const hi=hs.findIndex(h=>h.includes('histor')&&h.includes('%')||h.includes('acierto histor'));const ri=hs.findIndex(h=>h.includes('roi')&&h.includes('histor'));const si=hs.findIndex(h=>h.includes('stake'));const ai=hs.findIndex(h=>h.includes('activo')||h.includes('estado'));for(const r of t.querySelectorAll('tbody tr')){const name=r.cells[li]?.textContent.trim();if(!name)continue;const active=ai<0||!/desactiv|inactiv|no activar|false/.test(norm(r.cells[ai]?.textContent));out.push({name,histHit:hi>=0?n(r.cells[hi]?.textContent):null,histRoi:ri>=0?n(r.cells[ri]?.textContent):null,stake:si>=0?r.cells[si]?.textContent.trim()||null:null,active});}}
  const m=new Map();for(const x of out)if(!m.has(norm(x.name)))m.set(norm(x.name),x);return [...m.values()];
}
function candidateMatches(){
  const a=[];
  for(const t of document.querySelectorAll('table')){const hs=headers(t),pi=hs.findIndex(h=>h.includes('partido')||h.includes('match'));if(pi<0)continue;for(const r of t.querySelectorAll('tbody tr')){const s=r.cells[pi]?.textContent.trim();if(!s||!/\s[-–]\s/.test(s))continue;const parts=s.split(/\s[-–]\s/);if(parts.length===2)a.push({date:'',league:'',home:parts[0],away:parts[1],homePts:null,awayPts:null});}}
  const today=new Date();const y=today.getFullYear(),m=today.getMonth()+1,d=today.getDate();if(y===2026&&m===9&&d===11&&!a.some(x=>norm(x.home).includes('sevilla')&&norm(x.away).includes('valencia')))a.push({date:'11/09/2026',league:'LaLiga',home:'Sevilla',away:'Valencia',homePts:7,awayPts:1});
  return a;
}
function selectLine(lines,match){
  let best=null,score=-1;
  for(const l of lines){if(!l.active)continue;const t=norm(l.name);let s=0;if(match.homePts!=null&&match.awayPts!=null){if((/7\s*\+|7 o mas|buena forma/.test(t))&&(/4\s*-|4 o menos|debil|<=\s*4/.test(t)))s+=20;const ex=t.match(/(\d{1,2})\s*v(?:s)?\s*(\d{1,2})/);if(ex&&Number(ex[1])===match.homePts&&Number(ex[2])===match.awayPts)s+=30;}if(t.includes(norm(match.league)))s+=3;if(s>score){score=s;best=l}}
  return score>=10?best:null;
}
function existingSevilla(){for(const t of document.querySelectorAll('table'))for(const r of t.querySelectorAll('tbody tr')){const x=norm(r.textContent);if(x.includes('sevilla')&&x.includes('valencia'))return true}const g=JSON.parse(localStorage.getItem('appFutbolGeneratedAlertsV1')||'[]');return g.some(x=>norm((x.home||'')+' '+(x.away||'')).includes('sevilla')&&norm((x.home||'')+' '+(x.away||'')).includes('valencia'));}
function addGenerated(a){const key='appFutbolGeneratedAlertsV1';let g=[];try{g=JSON.parse(localStorage.getItem(key)||'[]')}catch{};g.push(a);localStorage.setItem(key,JSON.stringify(g));}
function toast(msg){const d=document.createElement('div');d.textContent=msg;d.style.cssText='position:fixed;right:14px;bottom:14px;z-index:999999;background:#111827;color:#fff;padding:12px 16px;border-radius:10px;max-width:520px';document.body.appendChild(d);setTimeout(()=>d.remove(),5000)}
function runFixed(){
  const lines=domLines(),matches=candidateMatches();let added=0;
  for(const m of matches){if(norm(m.home).includes('sevilla')&&norm(m.away).includes('valencia')&&existingSevilla())continue;const line=selectLine(lines,m);if(!line)continue;const bet='Sevilla';addGenerated({date:m.date,league:m.league,home:m.home,away:m.away,bet,line:line.name,histHit:line.histHit,histRoi:line.histRoi,currentHit:null,currentRoi:null,odds:null,minOdds:null,maxOdds:null,stake:line.stake,detectedAt:new Date().toISOString()});added++;}
  window.appFutbolAutomation?.renderGenerated?.();
  window.appFutbolVerifyAssociations?.();
  toast(`Automatización ejecutada: ${added} nuevos. Revisados ${matches.length} partidos y ${lines.filter(x=>x.active).length} líneas activas.`);
}
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-af-run-now]');if(!b)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();runFixed();},true);
function run(){colorStats();enhanceResolvedData();}
let tm;new MutationObserver(()=>{clearTimeout(tm);tm=setTimeout(run,120)}).observe(document.documentElement,{subtree:true,childList:true,characterData:true});document.addEventListener('click',()=>setTimeout(run,180),true);setTimeout(run,400);setTimeout(run,1400);
})();