(()=>{
'use strict';
const KEY='appFutbolLiveMatchesV1';
const LEAGUES={
 'es.1':'LaLiga','en.1':'Premier League','en.2':'Championship','de.1':'Bundesliga','it.1':'Serie A','fr.1':'Ligue 1','nl.1':'Eredivisie','pt.1':'Liga Portugal'
};
const BASE='https://raw.githubusercontent.com/openfootball/football.json/master/2026-27/';
const teamName=v=>typeof v==='string'?v:(v?.name||v?.title||v?.team||'');
const score=m=>{const s=m?.score?.ft||m?.score?.fulltime||m?.score;if(Array.isArray(s)&&s.length>=2&&Number.isFinite(+s[0])&&Number.isFinite(+s[1]))return [+s[0],+s[1]];return null};
const points=(team,m)=>{const s=score(m);if(!s)return null;const h=teamName(m.team1),a=teamName(m.team2);if(team!==h&&team!==a)return null;if(s[0]===s[1])return 1;return (team===h?(s[0]>s[1]):(s[1]>s[0]))?3:0};
function priorPoints(team,all,before,n=5){return all.filter(x=>x.date<before&&score(x)&&(teamName(x.team1)===team||teamName(x.team2)===team)).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,n).reduce((sum,x)=>sum+(points(team,x)??0),0)}
async function refresh(){
 const now=new Date(), from=new Date(now.getTime()-6*3600000), to=new Date(now.getTime()+72*3600000);const out=[];let loaded=0,failed=0;
 await Promise.all(Object.entries(LEAGUES).map(async([code,league])=>{try{const r=await fetch(BASE+code+'.json',{cache:'no-store'});if(!r.ok)throw new Error(String(r.status));const j=await r.json();const all=Array.isArray(j.matches)?j.matches:[];loaded++;
  for(const m of all){if(!m.date||score(m))continue;const dt=new Date(m.date+'T12:00:00');if(dt<from||dt>to)continue;const home=teamName(m.team1),away=teamName(m.team2);if(!home||!away)continue;out.push({date:m.date,league,home,away,homePts:priorPoints(home,all,m.date,5),awayPts:priorPoints(away,all,m.date,5),homePts3:priorPoints(home,all,m.date,3),awayPts3:priorPoints(away,all,m.date,3),source:'openfootball-2026-27'});}
 }catch(e){failed++;}}));
 localStorage.setItem(KEY,JSON.stringify(out));window.appFutbolLiveDataStatus={loaded,failed,matches:out.length,at:new Date().toISOString()};return {matches:out,loaded,failed};
}
window.appFutbolRefreshLiveMatches=refresh;
})();