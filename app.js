
const KEY="fg_wc_v5_7_lineups_mc_dynamic";let state=load(),playerIndex,simCache=new Map();function load(){const s=localStorage.getItem(KEY);if(s){try{const p=JSON.parse(s);if(p.meta?.version===window.SEED_DATA.meta.version)return p}catch(e){}}return JSON.parse(JSON.stringify(window.SEED_DATA))}function save(){localStorage.setItem(KEY,JSON.stringify(state))}
const $=id=>document.getElementById(id);function rebuildIndexes(){const byTeam=new Map(),startersByTeam=new Map(),byTeamNormName=new Map(),teams=[];for(const p of state.players){if(!byTeam.has(p.team)){byTeam.set(p.team,[]);startersByTeam.set(p.team,[]);byTeamNormName.set(p.team,new Map());teams.push(p.team)}byTeam.get(p.team).push(p);byTeamNormName.get(p.team).set(normName(p.name),p);if(p.status==="Titolare")startersByTeam.get(p.team).push(p)}playerIndex={byTeam,startersByTeam,byTeamNormName,teams}}function playersForTeam(t){return playerIndex?.byTeam?.get(t)||[]}function playersForMatch(m){return playersForTeam(m.home).concat(playersForTeam(m.away))}function active(t){return playerIndex?.startersByTeam?.get(t)||[]}function clearSimulationCache(){simCache.clear()}function lineupSignature(t){return active(t).map(p=>`${p.name}:${p.valueM||""}:${p.bonus||""}`).sort().join("|")}function tm(t){return state.teamMetrics[t]||{elo:1650,fifa:80,form:65,gf:1.25,ga:1.25,cs:.25,btts:.5,squad:68,cards:1.8}}function matchTitle(m){return `${m.home} - ${m.away}`}function clamp(x,a,b){return Math.max(a,Math.min(b,x))}function pct(p){return `${Math.round(p*100)}%`}function fair(p){return p>0?(1/p).toFixed(2):"-"}function cls(s){return s>=85?"high":s>=70?"mid":"low"}function hash(str){let h=2166136261;for(let c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}function rng(a){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}function pois(l,r){const L=Math.exp(-l);let k=0,p=1;do{k++;p*=r()}while(p>L);return k-1}
function power(t){const m=tm(t),fifa=100-Math.min(95,m.fifa),xi=active(t);let xiVal=xi.length?xi.reduce((s,p)=>s+(p.valueM||10),0)/xi.length:10;let xiBonus=xi.length?xi.reduce((s,p)=>s+(p.bonus||60),0)/xi.length:60;return m.elo*.030+fifa*.20+m.form*.22+m.squad*.25+xiVal*.12+xiBonus*.12}
function xg(h,a){const H=tm(h),A=tm(a),diff=(power(h)-power(a))/18;let lh=(H.gf*.62+A.ga*.38)+diff*.45+.08,la=(A.gf*.58+H.ga*.42)-diff*.40;lh*=.88+H.form/500+H.squad/700;la*=.86+A.form/520+A.squad/720;return[clamp(lh,.25,4.3),clamp(la,.18,3.7)]}
function mc(m,n=9000){if(m.home.includes("Team ")||m.away.includes("Team "))return null;const key=`${m.id}|${m.home}|${m.away}|${m.date}|${n}|${lineupSignature(m.home)}|${lineupSignature(m.away)}`;if(simCache.has(key))return simCache.get(key);const [lh,la]=xg(m.home,m.away),r=rng(hash(matchTitle(m)+m.date+lineupSignature(m.home)+lineupSignature(m.away)));let hw=0,d=0,aw=0,o15=0,o25=0,u25=0,u45=0,btts=0,hcs=0,acs=0,exact={},ht={};for(let i=0;i<n;i++){const hg=pois(lh,r),ag=pois(la,r),tot=hg+ag;if(hg>ag)hw++;else if(hg===ag)d++;else aw++;if(tot>1.5)o15++;if(tot>2.5)o25++;else u25++;if(tot<4.5)u45++;if(hg&&ag)btts++;if(!ag)hcs++;if(!hg)acs++;exact[`${hg}-${ag}`]=(exact[`${hg}-${ag}`]||0)+1;const hh=pois(lh*.45,r),ah=pois(la*.45,r);ht[`${hh}-${ah}`]=(ht[`${hh}-${ah}`]||0)+1}const top=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([score,c])=>({score,prob:c/n}));const result={lh,la,probs:{homeWin:hw/n,draw:d/n,awayWin:aw/n,over15:o15/n,over25:o25/n,under25:u25/n,under45:u45/n,btts:btts/n,homeCS:hcs/n,awayCS:acs/n},exactTop:top(exact),htTop:top(ht)};simCache.set(key,result);if(simCache.size>360)simCache.delete(simCache.keys().next().value);return result}
function picks(m,s){if(!s)return{};const c={"1":s.probs.homeWin,"X":s.probs.draw,"2":s.probs.awayWin,"Over 1.5":s.probs.over15,"Over 2.5":s.probs.over25,"Under 2.5":s.probs.under25,"Under 4.5":s.probs.under45,"BTTS Sì":s.probs.btts,[`Clean sheet ${m.home}`]:s.probs.homeCS,[`Clean sheet ${m.away}`]:s.probs.awayCS};const arr=Object.entries(c).sort((a,b)=>b[1]-a[1]),safe=arr[0],value=(arr.filter(x=>x[1]>.42&&x[1]<.72)[0]||arr[1]),crazy=s.exactTop.find(x=>x.prob<.13)||s.exactTop[2]||s.exactTop[0],fav=s.probs.homeWin>=s.probs.awayWin?m.home:m.away,comboP=Math.max(s.probs.over15,s.probs.under45)*Math.max(s.probs.homeWin,s.probs.awayWin);return{safe:{label:safe[0],prob:safe[1],fair:fair(safe[1])},value:{label:value[0],prob:value[1],fair:fair(value[1])},crazy:{label:`Risultato esatto ${crazy.score}`,prob:crazy.prob,fair:fair(crazy.prob)},combo:{label:`${fav} DNB + ${s.probs.over15>.70?"Over 1.5":"Under 4.5"}`,prob:clamp(comboP,.05,.90),fair:fair(clamp(comboP,.05,.90))}}}
function recalc(){state.matches.forEach(m=>{const s=mc(m);if(!s){m.sim=null;return}m.sim=s;m.aiPicks=picks(m,s);m.fg=Math.round(clamp(55+m.aiPicks.safe.prob*45,55,98));m.pt=s.htTop[0]?.score;m.ft=s.exactTop[0]?.score;m.safe=`${m.aiPicks.safe.label} · fair ${m.aiPicks.safe.fair}`;m.value=`${m.aiPicks.value.label} · quota min ${m.aiPicks.value.fair}`;m.crazy=`${m.aiPicks.crazy.label} · fair ${m.aiPicks.crazy.fair}`;m.combo=`${m.aiPicks.combo.label} · fair ${m.aiPicks.combo.fair}`});save()}
function recalcMatch(m){const s=mc(m);if(!s){m.sim=null;return}m.sim=s;m.aiPicks=picks(m,s);m.fg=Math.round(clamp(55+m.aiPicks.safe.prob*45,55,98));m.pt=s.htTop[0]?.score;m.ft=s.exactTop[0]?.score;m.safe=`${m.aiPicks.safe.label} Â· fair ${m.aiPicks.safe.fair}`;m.value=`${m.aiPicks.value.label} Â· quota min ${m.aiPicks.value.fair}`;m.crazy=`${m.aiPicks.crazy.label} Â· fair ${m.aiPicks.crazy.fair}`;m.combo=`${m.aiPicks.combo.label} Â· fair ${m.aiPicks.combo.fair}`}
function recalcOptimized(matches=state.matches){(Array.isArray(matches)?matches:[matches]).forEach(recalcMatch);save()}
function recalcAffectedTeams(teams){const set=new Set(teams);recalcOptimized(state.matches.filter(m=>set.has(m.home)||set.has(m.away)))}
function fscore(p,m){const s=m.sim||mc(m);let cs=0;if(s){if(p.team===m.home)cs=s.probs.homeCS;if(p.team===m.away)cs=s.probs.awayCS}let mult=p.role==="POR"?.55+cs*.85:p.role==="ATT"?1.18:p.role==="CEN"?.96:.80;return Math.round(100*clamp((p.bonus||60)/100*mult,.05,.99))}
function topBonus(m){return active(m.home).concat(active(m.away)).map(p=>({...p,fantasyScore:fscore(p,m)})).sort((a,b)=>b.fantasyScore-a.fantasyScore).slice(0,5)}
function statusCls(m){return m.lineupStatus.includes("Ufficial")?"ok":m.lineupStatus.includes("In attesa")?"bad":"wait"}function pill(players){return `<div>${players.map(p=>`<span class="pill">${p.name} · ${p.fantasyScore||p.role}</span>`).join(" ")}</div>`}
function pickGrid(m){let p=m.aiPicks||{};return `<div class="grid"><div class="item"><span class="safe">Safe</span><strong>${p.safe?`${p.safe.label} · ${pct(p.safe.prob)} · fair ${p.safe.fair}`:"-"}</strong></div><div class="item"><span class="value">Value</span><strong>${p.value?`${p.value.label} · ${pct(p.value.prob)} · quota min ${p.value.fair}`:"-"}</strong></div><div class="item"><span class="crazy">Quota Pazza</span><strong>${p.crazy?`${p.crazy.label} · fair ${p.crazy.fair}`:"-"}</strong></div><div class="item"><span class="combo">Combo AI</span><strong>${p.combo?`${p.combo.label} · fair ${p.combo.fair}`:"-"}</strong></div></div>`}

function impactBox(m){
  const im=m.formationImpact;
  if(!im) return `<div class="item full"><span>Impatto Formazioni</span><strong>Nessun aggiornamento ufficiale ancora.</strong></div>`;
  const h=im.homeWinDiff>=0?`+${im.homeWinDiff}`:`${im.homeWinDiff}`;
  const a=im.awayWinDiff>=0?`+${im.awayWinDiff}`:`${im.awayWinDiff}`;
  const x=im.drawDiff>=0?`+${im.drawDiff}`:`${im.drawDiff}`;
  const fg=im.fgDiff>=0?`+${im.fgDiff}`:`${im.fgDiff}`;
  const outPlayers=(im.keyOut||[]).slice(0,4).join(", ")||"Nessuno";
  const inPlayers=(im.keyIn||[]).slice(0,4).join(", ")||"Nessuno";
  return `<div class="item full"><span>Impatto Formazioni</span><strong>${m.home} ${h}% · X ${x}% · ${m.away} ${a}% · FG ${fg}</strong><br><small>Out: ${outPlayers}<br>In: ${inPlayers}</small></div>`;
}
function snapshotMatch(m){
  const s=m.sim||mc(m); const starters=active(m.home).concat(active(m.away)).map(p=>p.name);
  return {sim:s, fg:m.fg||0, starters};
}
function buildFormationImpact(m,before){
  const after=m.sim||mc(m); if(!before?.sim||!after) return null;
  const prev=new Set(before.starters||[]);
  const now=active(m.home).concat(active(m.away)).map(p=>p.name);
  const nowSet=new Set(now);
  const keyOut=[...prev].filter(n=>!nowSet.has(n));
  const keyIn=now.filter(n=>!prev.has(n));
  return {
    homeWinDiff: Math.round((after.probs.homeWin-before.sim.probs.homeWin)*100),
    drawDiff: Math.round((after.probs.draw-before.sim.probs.draw)*100),
    awayWinDiff: Math.round((after.probs.awayWin-before.sim.probs.awayWin)*100),
    xgHomeDiff: Number((after.lh-before.sim.lh).toFixed(2)),
    xgAwayDiff: Number((after.la-before.sim.la).toFixed(2)),
    fgDiff: (m.fg||0)-(before.fg||0),
    keyOut, keyIn,
    updatedAt:new Date().toLocaleString()
  };
}

function card(m,mode="all"){const b=topBonus(m),s=m.sim;let extra=mode==="money"?pickGrid(m):`<div class="grid"><div class="item"><span>PT / FT</span><strong>${m.pt} → ${m.ft}</strong></div><div class="item"><span>Status</span><strong class="${statusCls(m)}">${m.lineupStatus}</strong></div><div class="item"><span>Safe</span><strong>${m.safe}</strong></div><div class="item"><span>Value</span><strong>${m.value}</strong></div><div class="item full"><span>Top 5 Bonus</span>${pill(b)}</div>${s?`<div class="item"><span>1X2</span><strong>1 ${pct(s.probs.homeWin)} · X ${pct(s.probs.draw)} · 2 ${pct(s.probs.awayWin)}</strong></div><div class="item"><span>xG</span><strong>${s.lh.toFixed(2)} - ${s.la.toFixed(2)}</strong></div>`:""}${impactBox(m)}</div>`;if(mode==="fantasy")extra=`<div class="grid"><div class="item"><span>Capitano</span><strong>${b[0]?.name||"-"}</strong></div><div class="item"><span>Vice</span><strong>${b[1]?.name||"-"}</strong></div><div class="item full"><span>Top 5 Bonus</span>${pill(b)}</div></div>`;return `<article class="card"><div class="cardHead"><div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">#${m.id} · ${m.date} · ${m.stage} ${m.group||""}</div></div><div class="score ${cls(m.fg)}">${m.fg||"TBD"}</div></div>${extra}<button class="ghost" onclick="openDetail(${m.id})">Dettaglio</button></article>`}
function filtered(){const q=$("search")?.value?.toLowerCase()||"",st=$("stageFilter")?.value||"",gr=$("groupFilter")?.value||"";return state.matches.filter(m=>(!q||matchTitle(m).toLowerCase().includes(q))&&(!st||m.stage===st)&&(!gr||m.group===gr))}
function renderToday(){const list=filtered();$("allCards").innerHTML=list.map(m=>card(m)).join("");$("kpiVisible").textContent=list.length;$("kpiPlayers").textContent=state.players.length;const best=[...list].filter(m=>m.aiPicks?.safe).sort((a,b)=>b.aiPicks.safe.prob-a.aiPicks.safe.prob)[0];$("kpiSafe").textContent=best?`${matchTitle(best)}: ${best.aiPicks.safe.label}`:"-";let all=[];list.forEach(m=>topBonus(m).forEach(p=>all.push(p)));all.sort((a,b)=>b.fantasyScore-a.fantasyScore);$("kpiBonus").textContent=all[0]?`${all[0].name} ${all[0].fantasyScore}`:"-"}
function renderMoney(){$("moneyCards").innerHTML=state.matches.map(m=>card(m,"money")).join("")}

function firstYellow(m){return active(m.home).concat(active(m.away)).sort((a,b)=>(b.yellow||0)-(a.yellow||0))[0]}
function firstSub(m){return active(m.home).concat(active(m.away)).filter(p=>p.role!=="POR").sort((a,b)=>(b.sub||0)-(a.sub||0))[0]}
function bestGK(m){return active(m.home).concat(active(m.away)).filter(p=>p.role==="POR").map(p=>({...p,fantasyScore:fscore(p,m)})).sort((a,b)=>b.fantasyScore-a.fantasyScore)[0]}
function renderFantasy(){
  $("fantasyCards").innerHTML=state.matches.map(m=>{
    const b=topBonus(m), y=firstYellow(m), sub=firstSub(m), gk=bestGK(m), s=m.sim;
    return `<article class="card">
      <div class="cardHead"><div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">${m.date} · ${m.group||m.stage}</div></div><div class="score ${cls(m.fg)}">${m.fg||"TBD"}</div></div>
      <div class="grid">
        <div class="item"><span>Risultato primo tempo</span><strong>${m.pt||"-"}</strong></div>
        <div class="item"><span>Risultato finale</span><strong>${m.ft||"-"}</strong></div>
        <div class="item"><span>Capitano</span><strong>${b[0]?.name||"-"}</strong></div>
        <div class="item"><span>Vice capitano</span><strong>${b[1]?.name||"-"}</strong></div>
        <div class="item full"><span>Top 5 Bonus</span>${pill(b)}</div>
        <div class="item"><span>Portiere Clean Sheet</span><strong>${gk?`${gk.name} · ${gk.fantasyScore}`:"-"}</strong></div>
        <div class="item"><span>Primo ammonito</span><strong>${y?`${y.name} · rischio ${y.yellow}`:"-"}</strong></div>
        <div class="item"><span>Primo sostituito</span><strong>${sub?`${sub.name} · rischio ${sub.sub}`:"-"}</strong></div>
        ${s?`<div class="item"><span>Clean Sheet %</span><strong>${m.home} ${pct(s.probs.homeCS)} · ${m.away} ${pct(s.probs.awayCS)}</strong></div>`:""}
      </div>
    </article>`
  }).join("")
}

function renderSquads(){const q=$("squadSearch")?.value?.toLowerCase()||"";let teamsList=[...new Set(state.players.map(p=>p.team))].filter(t=>!q||t.toLowerCase().includes(q)||state.players.some(p=>p.team===t&&p.name.toLowerCase().includes(q))).slice(0,48);$("squadCards").innerHTML=teamsList.map(t=>{const ps=state.players.filter(p=>p.team===t).filter(p=>!q||t.toLowerCase().includes(q)||p.name.toLowerCase().includes(q));return `<article class="card"><h3>${t}</h3><p>${ps.length} giocatori · XI: ${active(t).length}</p>${ps.slice(0,30).map(p=>`<span class="pill">${p.name} · ${p.role} · ${p.club||""} · ${p.status}</span>`).join(" ")}</article>`}).join("")}
function renderMC(){$("mcCards").innerHTML=state.matches.filter(m=>m.sim).map(m=>{const s=m.sim,H=tm(m.home),A=tm(m.away);return `<article class="card"><div class="matchTitle">${matchTitle(m)}</div><div class="grid"><div class="item"><span>xG</span><strong>${s.lh.toFixed(2)} - ${s.la.toFixed(2)}</strong></div><div class="item"><span>Elo</span><strong>${H.elo} - ${A.elo}</strong></div><div class="item"><span>1X2</span><strong>1 ${pct(s.probs.homeWin)} · X ${pct(s.probs.draw)} · 2 ${pct(s.probs.awayWin)}</strong></div><div class="item"><span>Fair</span><strong>1 ${fair(s.probs.homeWin)} · X ${fair(s.probs.draw)} · 2 ${fair(s.probs.awayWin)}</strong></div><div class="item full"><span>Exact</span><strong>${s.exactTop.map(x=>`${x.score} ${pct(x.prob)}`).join(" · ")}</strong></div></div></article>`}).join("")}
function renderLineups(){const q=$("lineupSearch")?.value?.toLowerCase()||"";$("lineupCards").innerHTML=state.matches.filter(m=>!q||matchTitle(m).toLowerCase().includes(q)).map(m=>`<article class="card"><div class="matchTitle">${matchTitle(m)}</div><p>${m.lineupStatus} · ${m.source}</p><button class="ghost" onclick="openLineups(${m.id})">Apri formazioni</button></article>`).join("")}
function renderBest(){const top=[...state.matches].filter(m=>m.fg).sort((a,b)=>b.fg-a.fg).slice(0,10);$("bestCards").innerHTML=`<article class="card"><h3>Top FG</h3>${top.map(m=>`<span class="pill">${matchTitle(m)} · ${m.fg}</span>`).join(" ")}</article>`}




function renderSquadsOptimized(){const q=$("squadSearch")?.value?.toLowerCase()||"";let teamsList=playerIndex.teams.filter(t=>!q||t.toLowerCase().includes(q)||playersForTeam(t).some(p=>p.name.toLowerCase().includes(q))).slice(0,48);$("squadCards").innerHTML=teamsList.map(t=>{const ps=playersForTeam(t).filter(p=>!q||t.toLowerCase().includes(q)||p.name.toLowerCase().includes(q));return `<article class="card"><h3>${t}</h3><p>${ps.length} giocatori Â· XI: ${active(t).length}</p>${ps.slice(0,30).map(p=>`<span class="pill">${p.name} Â· ${p.role} Â· ${p.club||""} Â· ${p.status}</span>`).join(" ")}</article>`}).join("")}

function normName(s){
  return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
}

function getPreLineupSnapshot(m){
  return {
    homePower: power ? power(m.home) : 0,
    awayPower: power ? power(m.away) : 0,
    homeXG: m.sim?.lh || 0,
    awayXG: m.sim?.la || 0,
    homeWin: m.sim?.probs?.homeWin || 0,
    awayWin: m.sim?.probs?.awayWin || 0,
    topBonus: topBonus(m)[0]?.name || "-"
  }
}

function renderLineupImpact(m){
  const imp = m.lineupImpact;
  if(!imp) return `<div class="item full"><span>Impatto Formazioni</span><strong>Nessun update ufficiale ancora.</strong></div>`;
  const dHome = Math.round((imp.after.homeWin - imp.before.homeWin)*100);
  const dAway = Math.round((imp.after.awayWin - imp.before.awayWin)*100);
  const dXGH = (imp.after.homeXG - imp.before.homeXG).toFixed(2);
  const dXGA = (imp.after.awayXG - imp.before.awayXG).toFixed(2);
  return `<div class="item full"><span>Impatto Formazioni</span><strong>${m.home} ${dHome>=0?"+":""}${dHome}% · ${m.away} ${dAway>=0?"+":""}${dAway}% · xG ${dXGH>=0?"+":""}${dXGH}/${dXGA>=0?"+":""}${dXGA} · Top prima: ${imp.before.topBonus} → ora: ${imp.after.topBonus}</strong></div>`;
}


function extractEventIdFromInput(v){
  const s = String(v||"").trim();
  if(!s) return null;
  // Direct numeric ID
  const direct = s.match(/\b(\d{6,12})\b/);
  if(direct) return direct[1];

  // SofaScore URLs often contain #id:12345678 or event/12345678
  const patterns = [
    /#id:(\d+)/i,
    /event\/(\d+)/i,
    /\/(\d{6,12})(?:\?|#|$)/i,
    /id=(\d{6,12})/i
  ];
  for(const p of patterns){
    const m = s.match(p);
    if(m) return m[1];
  }
  return null;
}

function saveManualEventId(id){
  const m = state.matches.find(x=>x.id===id);
  if(!m) return;
  const input = document.getElementById("eventInput_"+id);
  const eventId = extractEventIdFromInput(input?.value || "");
  if(!eventId){
    alert("Non riesco a leggere l'Event ID. Incolla il link SofaScore della partita o solo il numero ID.");
    return;
  }
  m.sofascoreEventId = eventId;
  m.source = "SofaScore manual event ID";
  m.lastAutoUpdate = new Date().toLocaleString();
  save();
  render();
}

async function saveAndUpdateManualEventId(id){
  saveManualEventId(id);
  await updateOfficialLineup(id);
}

function renderOfficial(){
  const el = $("officialCards");
  if(!el) return;
  const list = state.matches.slice(0,72);
  el.innerHTML = list.map(m => {
    const homePlayers = playersForTeam(m.home);
    const awayPlayers = playersForTeam(m.away);
    const homeXI = homePlayers.filter(p=>p.status==="Titolare").length;
    const awayXI = awayPlayers.filter(p=>p.status==="Titolare").length;
    const homeBench = homePlayers.filter(p=>p.status==="Panchina").length;
    const awayBench = awayPlayers.filter(p=>p.status==="Panchina").length;
    return `<article class="card">
      <div class="cardHead">
        <div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">${m.date} · ${m.lineupStatus} · ${m.lastAutoUpdate||"Mai"}</div></div>
        <div class="score ${statusCls(m)}">${m.sofascoreEventId ? "ID "+m.sofascoreEventId : "NO ID"}</div>
      </div>
      <div class="grid">
        <div class="item"><span>${m.home}</span><strong>${homeXI} titolari · ${homeBench} panchina</strong></div>
        <div class="item"><span>${m.away}</span><strong>${awayXI} titolari · ${awayBench} panchina</strong></div>
        <div class="item"><span>Fonte</span><strong>${m.source||"-"}</strong></div>
        <div class="item"><span>Regola</span><strong>SofaScore ID + rose locali</strong></div>
        ${renderLineupImpact(m)}
      </div>
      <div class="grid">
        <div class="item full"><span>Fallback Event ID</span><input id="eventInput_${m.id}" placeholder="Incolla link SofaScore o Event ID" value="${m.sofascoreEventId||""}"></div>
      </div>
      <button onclick="updateOfficialLineup(${m.id})">Aggiorna Ufficiali</button>
      <button class="ghost" onclick="saveManualEventId(${m.id})">Salva ID</button>
      <button class="ghost" onclick="saveAndUpdateManualEventId(${m.id})">Salva + aggiorna</button>
      <button class="ghost" onclick="openLineups(${m.id})">Vedi formazioni</button>
    </article>`
  }).join("");
}

async function updateOfficialLineup(id){
  const m = state.matches.find(x=>x.id===id);
  if(!m) return;
  const knownPlayers = playersForMatch(m).map(p=>({name:p.name, team:p.team, role:p.role}));

  const before = getPreLineupSnapshot(m);
  m.lineupStatus = "Ricerca SofaScore...";
  m.lastAutoUpdate = new Date().toLocaleString();
  render();

  try {
    const r = await fetch("/api/sofascore-lineups", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({home:m.home, away:m.away, date:m.date, knownPlayers, eventId:m.sofascoreEventId||null})
    });
    const out = await r.json();

    if(!out.ok){
      m.lineupStatus = out.eventId ? "Lineups non disponibili" : "Event ID non trovato";
      m.source = out.source || "SofaScore";
      m.sofascoreEventId = out.eventId || m.sofascoreEventId || null;
      m.lastAutoUpdate = new Date().toLocaleString();
      save(); render();
      return;
    }

    m.sofascoreEventId = out.eventId || m.sofascoreEventId || null;

    playersForMatch(m).forEach(p=>{
      p.status = "Panchina";
      p.source = p.source || "Squad DB";
    });

    let homeXI=0, awayXI=0, homeBench=0, awayBench=0, outCount=0;

    for(const item of out.players){
      const p = playerIndex.byTeamNormName.get(item.team)?.get(normName(item.name));
      if(!p) continue;
      p.status = item.status === "Titolare" ? "Titolare" : item.status === "Fuori" ? "Fuori" : "Panchina";
      p.source = out.source || "SofaScore lineups";
      if(p.team===m.home && p.status==="Titolare") homeXI++;
      if(p.team===m.away && p.status==="Titolare") awayXI++;
      if(p.team===m.home && p.status==="Panchina") homeBench++;
      if(p.team===m.away && p.status==="Panchina") awayBench++;
      if(p.status==="Fuori") outCount++;
    }

    if(homeXI>=10 && awayXI>=10){
      m.lineupStatus = "Ufficiali SofaScore";
    } else if(homeXI>=8 && awayXI>=8){
      m.lineupStatus = "Import parziale SofaScore";
    } else {
      m.lineupStatus = "Ufficiali non affidabili";
      playersForMatch(m).forEach(p=>{
        p.status = p.probableXI ? "Titolare" : "Panchina";
      });
    }

    m.lastAutoUpdate = new Date().toLocaleString();
    m.source = out.source || "SofaScore lineups";
    rebuildIndexes();
    recalcAffectedTeams([m.home,m.away]);

    const after = getPreLineupSnapshot(m);
    m.lineupImpact = {before, after, counts:{homeXI,awayXI,homeBench,awayBench,outCount}};
    save();
    render();
  } catch(e){
    m.lineupStatus = "Errore SofaScore";
    m.lastAutoUpdate = new Date().toLocaleString();
    save(); render();
  }
}

async function updateOfficialVisible(){
  for(const m of filtered().slice(0,8)){
    await updateOfficialLineup(m.id);
  }
}


function renderManualXI(){
  const el = $("manualXiCards");
  if(!el) return;
  el.innerHTML = state.matches.slice(0,72).map(m => `
    <article class="card">
      <div class="cardHead">
        <div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">${m.date} · ${m.lineupStatus || "XI manuale"}</div></div>
        <div class="score ${cls(m.fg)}">${m.fg||"TBD"}</div>
      </div>
      <div class="grid">
        <div class="item full"><span>${m.home} - 11 titolari</span><textarea id="homeXI_${m.id}" placeholder="Scrivi 11 nomi, uno per riga o separati da virgola"></textarea></div>
        <div class="item full"><span>${m.away} - 11 titolari</span><textarea id="awayXI_${m.id}" placeholder="Scrivi 11 nomi, uno per riga o separati da virgola"></textarea></div>
      </div>
      <button onclick="applyManualXI(${m.id})">Applica XI e ricalcola</button>
      <button class="ghost" onclick="fillCurrentXI(${m.id})">Carica XI attuale</button>
      <button class="ghost" onclick="openLineups(${m.id})">Vedi formazioni</button>
    </article>
  `).join("");
}

function splitManualNames(raw){
  return String(raw||"")
    .split(/\n|,|;|\|/)
    .map(x=>x.trim())
    .filter(x=>x.length>=2);
}

function matchManualName(input, team){
  const n = normName(input);
  const players = playersForTeam(team);
  let exact = players.find(p=>normName(p.name)===n);
  if(exact) return exact;
  let includes = players.find(p=>normName(p.name).includes(n) || n.includes(normName(p.name)));
  if(includes) return includes;
  // surname matching
  let token = n.length > 5 ? n.slice(-6) : n;
  return players.find(p=>normName(p.name).endsWith(token)) || null;
}

function applyManualXI(id){
  const m = state.matches.find(x=>x.id===id);
  if(!m) return;

  const before = typeof getPreLineupSnapshot === "function" ? getPreLineupSnapshot(m) : null;

  const homeNames = splitManualNames($("homeXI_"+id)?.value);
  const awayNames = splitManualNames($("awayXI_"+id)?.value);

  const homeMatched = [];
  const awayMatched = [];
  const homeMiss = [];
  const awayMiss = [];

  for(const name of homeNames){
    const p = matchManualName(name, m.home);
    if(p && !homeMatched.includes(p)) homeMatched.push(p);
    else homeMiss.push(name);
  }
  for(const name of awayNames){
    const p = matchManualName(name, m.away);
    if(p && !awayMatched.includes(p)) awayMatched.push(p);
    else awayMiss.push(name);
  }

  if(homeMatched.length !== 11 || awayMatched.length !== 11){
    alert(`Servono esattamente 11 riconosciuti per squadra.\n${m.home}: ${homeMatched.length}/11 riconosciuti. Non riconosciuti: ${homeMiss.join(", ") || "-"}\n${m.away}: ${awayMatched.length}/11 riconosciuti. Non riconosciuti: ${awayMiss.join(", ") || "-"}`);
    return;
  }

  // Reset only these two teams. Everything not in the XI becomes Fuori and does NOT figure in active model.
  playersForMatch(m).forEach(p=>{
    p.status = "Fuori";
  });

  homeMatched.forEach(p=>{p.status="Titolare"; p.source="XI manuale";});
  awayMatched.forEach(p=>{p.status="Titolare"; p.source="XI manuale";});

  m.lineupStatus = "XI manuale";
  m.source = "XI manuale utente";
  m.lastAutoUpdate = new Date().toLocaleString();

  rebuildIndexes();
  recalcAffectedTeams([m.home,m.away]);

  if(before && typeof getPreLineupSnapshot === "function"){
    const after = getPreLineupSnapshot(m);
    m.lineupImpact = {before, after, counts:{homeXI:11, awayXI:11, homeBench:0, awayBench:0, outCount:playersForMatch(m).length-22}};
    save();
  }

  render();
  alert(`XI applicato e modello ricalcolato.\n${m.home}: 11 titolari\n${m.away}: 11 titolari\nIl resto non figura nel modello.`);
}

function fillCurrentXI(id){
  const m = state.matches.find(x=>x.id===id);
  if(!m) return;
  const home = active(m.home).map(p=>p.name).join("\\n");
  const away = active(m.away).map(p=>p.name).join("\\n");
  if($("homeXI_"+id)) $("homeXI_"+id).value = home;
  if($("awayXI_"+id)) $("awayXI_"+id).value = away;
}

function activeTabId(){return document.querySelector(".tab.active")?.dataset.tab||"today"}
function render(tabId=activeTabId()){const views={today:renderToday,database:()=>{},money:renderMoney,fantasy:renderFantasy,squads:renderSquadsOptimized,montecarlo:renderMC,official:renderOfficial,manualxi:renderManualXI,lineups:renderLineups,best:renderBest};(views[tabId]||renderToday)()}
async function importOfficial(){const log=$("importLog");log.textContent="Import rose ufficiali FIFA in corso...";try{const r=await fetch("/api/import-official-squads");const out=await r.json();if(!out.ok){log.textContent="Errore: "+out.error;return}state.players=out.players;state.matches.forEach(m=>{m.lineupStatus="Rose ufficiali importate";m.source=out.source});state.meta.officialSquadsImportedAt=new Date().toISOString();recalc();render();log.textContent=`Import completato. Giocatori: ${out.players.length}. Squadre: ${out.teams}. Fonte: ${out.source}`;}catch(e){log.textContent="Errore import. Controlla i log Render."}}
function openLineups(id){const m=state.matches.find(x=>x.id===id);const block=t=>`<h3>${t}</h3>${state.players.filter(p=>p.team===t).map(p=>`<p><b>${p.name}</b> · ${p.role} · ${p.status} · ${p.club||""}</p>`).join("")}`;$("modalContent").innerHTML=`<h2>${matchTitle(m)}</h2>${block(m.home)}${block(m.away)}`;$("modal").hidden=false}
function openDetail(id){const m=state.matches.find(x=>x.id===id),s=m.sim,b=topBonus(m);$("modalContent").innerHTML=`<h2>${matchTitle(m)}</h2>${pickGrid(m)}<div class="grid"><div class="item"><span>PT/FT</span><strong>${m.pt} → ${m.ft}</strong></div>${s?`<div class="item"><span>1X2</span><strong>1 ${pct(s.probs.homeWin)} · X ${pct(s.probs.draw)} · 2 ${pct(s.probs.awayWin)}</strong></div><div class="item"><span>Clean Sheet</span><strong>${m.home} ${pct(s.probs.homeCS)} · ${m.away} ${pct(s.probs.awayCS)}</strong></div>`:""}<div class="item full"><span>Top Bonus</span>${pill(b)}</div>${impactBox(m)}</div>`;$("modal").hidden=false}
async function importOfficialOptimized(){const log=$("importLog");log.textContent="Import rose ufficiali FIFA in corso...";try{const r=await fetch("/api/import-official-squads");const out=await r.json();if(!out.ok){log.textContent="Errore: "+out.error;return}state.players=out.players;state.matches.forEach(m=>{m.lineupStatus="Rose ufficiali importate";m.source=out.source});state.meta.officialSquadsImportedAt=new Date().toISOString();clearSimulationCache();rebuildIndexes();recalcOptimized();render();log.textContent=`Import completato. Giocatori: ${out.players.length}. Squadre: ${out.teams}. Fonte: ${out.source}`;}catch(e){log.textContent="Errore import. Controlla i log Render."}}
function resetState(){localStorage.removeItem(KEY);state=JSON.parse(JSON.stringify(window.SEED_DATA));clearSimulationCache();rebuildIndexes();recalcOptimized();render();$("importLog").textContent="Reset completato."}
function openLineupsOptimized(id){const m=state.matches.find(x=>x.id===id);const block=t=>`<h3>${t}</h3>${playersForTeam(t).map(p=>`<p><b>${p.name}</b> Â· ${p.role} Â· ${p.status} Â· ${p.club||""}</p>`).join("")}`;$("modalContent").innerHTML=`<h2>${matchTitle(m)}</h2>${block(m.home)}${block(m.away)}`;$("modal").hidden=false}
function fill(){[...new Set(state.matches.map(m=>m.stage))].forEach(x=>$("stageFilter").insertAdjacentHTML("beforeend",`<option>${x}</option>`));[...new Set(state.matches.map(m=>m.group).filter(Boolean))].forEach(x=>$("groupFilter").insertAdjacentHTML("beforeend",`<option>${x}</option>`))}
document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));btn.classList.add("active");$(btn.dataset.tab).classList.add("active");render(btn.dataset.tab)});
$("search").oninput=renderToday;$("stageFilter").onchange=renderToday;$("groupFilter").onchange=renderToday;$("lineupSearch").oninput=renderLineups;$("squadSearch").oninput=renderSquads;$("importOfficial").onclick=importOfficial;if($("updateOfficialVisible")) $("updateOfficialVisible").onclick=updateOfficialVisible;$("resetBtn").onclick=()=>{localStorage.removeItem(KEY);state=JSON.parse(JSON.stringify(window.SEED_DATA));recalc();render();$("importLog").textContent="Reset completato."};$("closeModal").onclick=()=>$("modal").hidden=true;$("modal").onclick=e=>{if(e.target.id==="modal")$("modal").hidden=true};
if($("resetBtn"))$("resetBtn").onclick=resetState;
if($("importOfficial"))$("importOfficial").onclick=importOfficialOptimized;
if($("squadSearch"))$("squadSearch").oninput=renderSquadsOptimized;
if(typeof window!=="undefined")window.openLineups=openLineupsOptimized;
fill();rebuildIndexes();recalcOptimized();render();
