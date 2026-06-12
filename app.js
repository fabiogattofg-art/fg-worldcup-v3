
const KEY="fg_wc_v8_1_manual_only_oracle";let state=load(),playerIndex,simCache=new Map();function load(){const s=localStorage.getItem(KEY);if(s){try{const p=JSON.parse(s);if(p.meta?.version===window.SEED_DATA.meta.version)return p}catch(e){}}return JSON.parse(JSON.stringify(window.SEED_DATA))}function save(){localStorage.setItem(KEY,JSON.stringify(state))}
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
function render(tabId=activeTabId()){const views={today:renderToday,database:()=>{},money:renderMoney,fantasy:renderFantasy,squads:renderSquadsOptimized,montecarlo:renderMC,manualxi:renderManualXI,lineups:renderLineups,best:renderBest};(views[tabId]||renderToday)()}
async function importOfficial(){const log=$("importLog");log.textContent="Caricamento rose locali in corso...";try{const r=await fetch("/api/import-official-squads");const out=await r.json();if(!out.ok){log.textContent="Errore: "+out.error;return}state.players=out.players;state.matches.forEach(m=>{m.lineupStatus="Rose ufficiali importate";m.source=out.source});state.meta.officialSquadsImportedAt=new Date().toISOString();recalc();render();log.textContent=`Rose locali caricate. Giocatori: ${out.players.length}. Squadre: ${out.teams}. Fonte: ${out.source}`;}catch(e){log.textContent="Errore import. Controlla i log Render."}}
function openLineups(id){const m=state.matches.find(x=>x.id===id);const block=t=>`<h3>${t}</h3>${state.players.filter(p=>p.team===t).map(p=>`<p><b>${p.name}</b> · ${p.role} · ${p.status} · ${p.club||""}</p>`).join("")}`;$("modalContent").innerHTML=`<h2>${matchTitle(m)}</h2>${block(m.home)}${block(m.away)}`;$("modal").hidden=false}
function openDetail(id){const m=state.matches.find(x=>x.id===id),s=m.sim,b=topBonus(m);$("modalContent").innerHTML=`<h2>${matchTitle(m)}</h2>${pickGrid(m)}<div class="grid"><div class="item"><span>PT/FT</span><strong>${m.pt} → ${m.ft}</strong></div>${s?`<div class="item"><span>1X2</span><strong>1 ${pct(s.probs.homeWin)} · X ${pct(s.probs.draw)} · 2 ${pct(s.probs.awayWin)}</strong></div><div class="item"><span>Clean Sheet</span><strong>${m.home} ${pct(s.probs.homeCS)} · ${m.away} ${pct(s.probs.awayCS)}</strong></div>`:""}<div class="item full"><span>Top Bonus</span>${pill(b)}</div>${impactBox(m)}</div>`;$("modal").hidden=false}
async function importOfficialOptimized(){const log=$("importLog");log.textContent="Caricamento rose locali in corso...";try{const r=await fetch("/api/import-official-squads");const out=await r.json();if(!out.ok){log.textContent="Errore: "+out.error;return}state.players=out.players;state.matches.forEach(m=>{m.lineupStatus="Rose ufficiali importate";m.source=out.source});state.meta.officialSquadsImportedAt=new Date().toISOString();clearSimulationCache();rebuildIndexes();recalcOptimized();render();log.textContent=`Rose locali caricate. Giocatori: ${out.players.length}. Squadre: ${out.teams}. Fonte: ${out.source}`;}catch(e){log.textContent="Errore import. Controlla i log Render."}}
function resetState(){localStorage.removeItem(KEY);state=JSON.parse(JSON.stringify(window.SEED_DATA));clearSimulationCache();rebuildIndexes();recalcOptimized();render();$("importLog").textContent="Reset completato."}
function openLineupsOptimized(id){const m=state.matches.find(x=>x.id===id);const block=t=>`<h3>${t}</h3>${playersForTeam(t).map(p=>`<p><b>${p.name}</b> Â· ${p.role} Â· ${p.status} Â· ${p.club||""}</p>`).join("")}`;$("modalContent").innerHTML=`<h2>${matchTitle(m)}</h2>${block(m.home)}${block(m.away)}`;$("modal").hidden=false}
function fill(){[...new Set(state.matches.map(m=>m.stage))].forEach(x=>$("stageFilter").insertAdjacentHTML("beforeend",`<option>${x}</option>`));[...new Set(state.matches.map(m=>m.group).filter(Boolean))].forEach(x=>$("groupFilter").insertAdjacentHTML("beforeend",`<option>${x}</option>`))}
document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".tab").forEach(b=>b.classList.remove("active"));document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));btn.classList.add("active");$(btn.dataset.tab).classList.add("active");render(btn.dataset.tab)});
$("search").oninput=renderToday;$("stageFilter").onchange=renderToday;$("groupFilter").onchange=renderToday;$("lineupSearch").oninput=renderLineups;$("squadSearch").oninput=renderSquads;$("importOfficial").onclick=importOfficial;$("resetBtn").onclick=()=>{localStorage.removeItem(KEY);state=JSON.parse(JSON.stringify(window.SEED_DATA));recalc();render();$("importLog").textContent="Reset completato."};$("closeModal").onclick=()=>$("modal").hidden=true;$("modal").onclick=e=>{if(e.target.id==="modal")$("modal").hidden=true};
if($("resetBtn"))$("resetBtn").onclick=resetState;
if($("importOfficial"))$("importOfficial").onclick=importOfficialOptimized;
if($("squadSearch"))$("squadSearch").oninput=renderSquadsOptimized;
if(typeof window!=="undefined")window.openLineups=openLineupsOptimized;

const FG_V7=(()=>{
  const MAX_GOALS=10;

  function ensureState(){
    state.calibration ||= {homeGoalFactor:1,awayGoalFactor:1,sample:0,updatedAt:null};
    state.matches.forEach(m=>{
      m.result ||= null;
      if(m.matchLineups){
        for(const side of ["home","away"]){
          m.matchLineups[side] ||= {team:m[side],starters:[]};
          m.matchLineups[side].starters ||= [];
        }
      }
    });
  }

  function sideKey(m,team){return team===m.home?"home":team===m.away?"away":null}
  function playerByName(team,name){return playerIndex?.byTeamNormName?.get(team)?.get(normName(name))||null}
  function activeForMatch(m,team){
    const side=sideKey(m,team);
    const names=side&&m.matchLineups?.[side]?.starters;
    if(names?.length){
      return names.map(n=>playerByName(team,n)).filter(Boolean);
    }
    return active(team);
  }
  function allActive(m){return activeForMatch(m,m.home).concat(activeForMatch(m,m.away))}
  function sig(m,team){return activeForMatch(m,team).map(p=>`${p.name}:${p.valueM||""}:${p.bonus||""}`).sort().join("|")}

  function powerForMatch(m,team){
    const mt=tm(team),fifa=100-Math.min(95,mt.fifa),xi=activeForMatch(m,team);
    const xiVal=xi.length?xi.reduce((s,p)=>s+(p.valueM||10),0)/xi.length:10;
    const xiBonus=xi.length?xi.reduce((s,p)=>s+(p.bonus||60),0)/xi.length:60;
    return mt.elo*.030+fifa*.20+mt.form*.22+mt.squad*.25+xiVal*.12+xiBonus*.12;
  }

  function expectedGoals(m,raw=false){
    const H=tm(m.home),A=tm(m.away),diff=(powerForMatch(m,m.home)-powerForMatch(m,m.away))/18;
    let lh=(H.gf*.62+A.ga*.38)+diff*.45+.08,la=(A.gf*.58+H.ga*.42)-diff*.40;
    lh*=.88+H.form/500+H.squad/700;
    la*=.86+A.form/520+A.squad/720;
    if(!raw){
      const cal=state.calibration||{};
      lh*=cal.homeGoalFactor||1;
      la*=cal.awayGoalFactor||1;
    }
    return [clamp(lh,.25,4.3),clamp(la,.18,3.7)];
  }

  function pmf(lambda,max=MAX_GOALS){
    const arr=[];let p=Math.exp(-lambda),sum=p;arr[0]=p;
    for(let k=1;k<=max;k++){p=p*lambda/k;arr[k]=p;sum+=p}
    arr[max]+=Math.max(0,1-sum);
    return arr;
  }

  function topScores(table,n=6){
    return Object.entries(table).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([score,prob])=>({score,prob}));
  }

  function exactSim(m){
    if(m.home.includes("Team ")||m.away.includes("Team "))return null;
    ensureState();
    const cal=state.calibration||{};
    const key=`v7|${m.id}|${m.date}|${sig(m,m.home)}|${sig(m,m.away)}|${cal.homeGoalFactor||1}|${cal.awayGoalFactor||1}`;
    if(simCache.has(key))return simCache.get(key);
    const [lh,la]=expectedGoals(m),hp=pmf(lh),ap=pmf(la);
    let hw=0,d=0,aw=0,o15=0,o25=0,u25=0,u45=0,btts=0,hcs=0,acs=0,exact={};
    for(let h=0;h<hp.length;h++)for(let a=0;a<ap.length;a++){
      const p=hp[h]*ap[a],tot=h+a;
      if(h>a)hw+=p;else if(h===a)d+=p;else aw+=p;
      if(tot>1.5)o15+=p;if(tot>2.5)o25+=p;else u25+=p;if(tot<4.5)u45+=p;
      if(h&&a)btts+=p;if(!a)hcs+=p;if(!h)acs+=p;
      exact[`${h}-${a}`]=(exact[`${h}-${a}`]||0)+p;
    }
    const [hlh,hla]=[lh*.45,la*.45],hhp=pmf(hlh,5),hap=pmf(hla,5),ht={};
    for(let h=0;h<hhp.length;h++)for(let a=0;a<hap.length;a++)ht[`${h}-${a}`]=(ht[`${h}-${a}`]||0)+hhp[h]*hap[a];
    const result={lh,la,engine:"poisson-exact",probs:{homeWin:hw,draw:d,awayWin:aw,over15:o15,over25:o25,under25:u25,under45:u45,btts:btts,homeCS:hcs,awayCS:acs},exactTop:topScores(exact),htTop:topScores(ht)};
    simCache.set(key,result);if(simCache.size>500)simCache.delete(simCache.keys().next().value);
    return result;
  }

  function recalcMatchV7(m){
    const s=exactSim(m);if(!s){m.sim=null;return}
    m.sim=s;m.aiPicks=picks(m,s);m.fg=Math.round(clamp(55+m.aiPicks.safe.prob*45,55,98));
    m.pt=s.htTop[0]?.score;m.ft=s.exactTop[0]?.score;
    m.safe=`${m.aiPicks.safe.label} · fair ${m.aiPicks.safe.fair}`;
    m.value=`${m.aiPicks.value.label} · quota min ${m.aiPicks.value.fair}`;
    m.crazy=`${m.aiPicks.crazy.label} · fair ${m.aiPicks.crazy.fair}`;
    m.combo=`${m.aiPicks.combo.label} · fair ${m.aiPicks.combo.fair}`;
  }

  function fscoreV7(p,m){
    const s=m.sim||exactSim(m);let cs=0;
    if(s){if(p.team===m.home)cs=s.probs.homeCS;if(p.team===m.away)cs=s.probs.awayCS}
    const mult=p.role==="POR"?.55+cs*.85:p.role==="ATT"?1.18:p.role==="CEN"?.96:.80;
    return Math.round(100*clamp((p.bonus||60)/100*mult,.05,.99));
  }

  function topBonusV7(m){return allActive(m).map(p=>({...p,fantasyScore:fscoreV7(p,m)})).sort((a,b)=>b.fantasyScore-a.fantasyScore).slice(0,5)}
  function firstYellowV7(m){return allActive(m).sort((a,b)=>(b.yellow||0)-(a.yellow||0))[0]}
  function firstSubV7(m){return allActive(m).filter(p=>p.role!=="POR").sort((a,b)=>(b.sub||0)-(a.sub||0))[0]}
  function bestGKV7(m){return allActive(m).filter(p=>p.role==="POR").map(p=>({...p,fantasyScore:fscoreV7(p,m)})).sort((a,b)=>b.fantasyScore-a.fantasyScore)[0]}

  function snapshot(m){
    const s=m.sim||exactSim(m);
    return {homePower:powerForMatch(m,m.home),awayPower:powerForMatch(m,m.away),homeXG:s?.lh||0,awayXG:s?.la||0,homeWin:s?.probs?.homeWin||0,awayWin:s?.probs?.awayWin||0,topBonus:topBonusV7(m)[0]?.name||"-",starters:allActive(m).map(p=>p.name),fg:m.fg||0};
  }

  function renderManualXIV7(){
    const el=$("manualXiCards");if(!el)return;
    el.innerHTML=state.matches.slice(0,72).map(m=>{
      const home=(m.matchLineups?.home?.starters||activeForMatch(m,m.home).map(p=>p.name)).join("\n");
      const away=(m.matchLineups?.away?.starters||activeForMatch(m,m.away).map(p=>p.name)).join("\n");
      const scoped=m.matchLineups?"XI ufficiale manuale":"XI base";
      return `<article class="card">
        <div class="cardHead"><div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">${m.date} · ${m.lineupStatus||scoped} · ${scoped}</div></div><div class="score ${cls(m.fg)}">${m.fg||"TBD"}</div></div>
        <div class="grid">
          <div class="item full"><span>${m.home} - 11 titolari</span><textarea id="homeXI_${m.id}" placeholder="Scrivi 11 nomi, uno per riga o separati da virgola">${home}</textarea></div>
          <div class="item full"><span>${m.away} - 11 titolari</span><textarea id="awayXI_${m.id}" placeholder="Scrivi 11 nomi, uno per riga o separati da virgola">${away}</textarea></div>
        </div>
        <div class="item full"><span>Fonte formazioni</span><strong>${m.matchLineups?"XI ufficiale manuale attivo":"In attesa XI manuale"}</strong></div><button onclick="applyManualXI(${m.id})">Applica XI ufficiale</button>
        <button class="ghost" onclick="fillCurrentXI(${m.id})">Carica XI attuale</button>
        <button class="ghost" onclick="clearMatchXI(${m.id})">Reset XI ufficiale</button>
        <button class="ghost" onclick="openLineups(${m.id})">Vedi formazioni</button>
      </article>`;
    }).join("");
  }

  function applyManualXIV7(id){
    const m=state.matches.find(x=>x.id===id);if(!m)return;
    const before=snapshot(m);
    const homeNames=splitManualNames($("homeXI_"+id)?.value),awayNames=splitManualNames($("awayXI_"+id)?.value);
    const homeMatched=[],awayMatched=[],homeMiss=[],awayMiss=[];
    for(const name of homeNames){const p=matchManualName(name,m.home);if(p&&!homeMatched.includes(p))homeMatched.push(p);else homeMiss.push(name)}
    for(const name of awayNames){const p=matchManualName(name,m.away);if(p&&!awayMatched.includes(p))awayMatched.push(p);else awayMiss.push(name)}
    if(homeMatched.length!==11||awayMatched.length!==11){
      alert(`Servono esattamente 11 riconosciuti per squadra.\n${m.home}: ${homeMatched.length}/11 riconosciuti. Non riconosciuti: ${homeMiss.join(", ")||"-"}\n${m.away}: ${awayMatched.length}/11 riconosciuti. Non riconosciuti: ${awayMiss.join(", ")||"-"}`);
      return;
    }
    m.matchLineups={home:{team:m.home,starters:homeMatched.map(p=>p.name),source:"XI ufficiale manuale"},away:{team:m.away,starters:awayMatched.map(p=>p.name),source:"XI ufficiale manuale"}};
    m.lineupStatus="XI ufficiale manuale";m.source="XI ufficiale manuale";m.lastAutoUpdate=new Date().toLocaleString();
    clearSimulationCache();recalcOptimized(m);
    const after=snapshot(m),prev=new Set(before.starters),now=new Set(after.starters);
    m.lineupImpact={before,after,counts:{homeXI:11,awayXI:11,homeBench:0,awayBench:0,outCount:playersForMatch(m).length-22},keyOut:[...prev].filter(n=>!now.has(n)),keyIn:[...now].filter(n=>!prev.has(n))};
    save();render();alert(`XI ufficiale manuale salvato per questa partita.\n${m.home}: 11 titolari\n${m.away}: 11 titolari`);
  }

  function fillCurrentXIV7(id){
    const m=state.matches.find(x=>x.id===id);if(!m)return;
    if($("homeXI_"+id))$("homeXI_"+id).value=activeForMatch(m,m.home).map(p=>p.name).join("\n");
    if($("awayXI_"+id))$("awayXI_"+id).value=activeForMatch(m,m.away).map(p=>p.name).join("\n");
  }

  function clearMatchXI(id){
    const m=state.matches.find(x=>x.id===id);if(!m)return;
    delete m.matchLineups;m.lineupStatus="Rose ufficiali locali";m.source="FIFA official squad list local";
    clearSimulationCache();recalcOptimized(m);save();render();
  }

  function openLineupsV7(id){
    const m=state.matches.find(x=>x.id===id);if(!m)return;
    const block=t=>{
      const xi=activeForMatch(m,t);
      return `<h3>${t}</h3><p>Fonte: ${m.matchLineups?"XI ufficiale manuale":"XI base/probabile"}. ${m.matchLineups?"Il resto non figura nel modello.":""}</p>${xi.map(p=>`<p><b>${p.name}</b> · ${p.role} · XI ufficiale · ${p.club||""}</p>`).join("")}`;
    };
    $("modalContent").innerHTML=`<h2>${matchTitle(m)}</h2>${block(m.home)}${block(m.away)}`;$("modal").hidden=false;
  }

  function saveResult(id){
    const m=state.matches.find(x=>x.id===id),h=Number($("resH_"+id)?.value),a=Number($("resA_"+id)?.value);
    if(!m||!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0){alert("Inserisci due gol validi.");return}
    m.result={home:h,away:a,updatedAt:new Date().toISOString()};save();render("precision");
  }

  function clearResult(id){const m=state.matches.find(x=>x.id===id);if(!m)return;m.result=null;save();render("precision")}

  function backtestRows(){return state.matches.filter(m=>m.result&&m.sim)}
  function actualOutcome(r){return r.home>r.away?"homeWin":r.home<r.away?"awayWin":"draw"}
  function predOutcome(s){return Object.entries({homeWin:s.probs.homeWin,draw:s.probs.draw,awayWin:s.probs.awayWin}).sort((a,b)=>b[1]-a[1])[0][0]}

  function stats(){
    const rows=backtestRows();if(!rows.length)return {count:0,accuracy:null,brier:null,goalMae:null};
    let ok=0,brier=0,goalMae=0;
    rows.forEach(m=>{
      const y=actualOutcome(m.result),p=predOutcome(m.sim);if(y===p)ok++;
      brier+=["homeWin","draw","awayWin"].reduce((s,k)=>s+Math.pow((m.sim.probs[k]||0)-(k===y?1:0),2),0);
      goalMae+=Math.abs((m.sim.lh+m.sim.la)-(m.result.home+m.result.away));
    });
    return {count:rows.length,accuracy:ok/rows.length,brier:brier/rows.length,goalMae:goalMae/rows.length};
  }

  function renderPrecision(){
    ensureState();
    const s=stats(),cal=state.calibration||{};
    $("btCount").textContent=s.count;
    $("btAccuracy").textContent=s.accuracy==null?"-":pct(s.accuracy);
    $("btBrier").textContent=s.brier==null?"-":s.brier.toFixed(3);
    $("btGoalMae").textContent=s.goalMae==null?"-":s.goalMae.toFixed(2);
    $("calHome").textContent=(cal.homeGoalFactor||1).toFixed(2);
    $("calAway").textContent=(cal.awayGoalFactor||1).toFixed(2);
    $("precisionCards").innerHTML=state.matches.map(m=>{
      const r=m.result||{},sim=m.sim||exactSim(m);
      if(!sim)return `<article class="card"><div class="matchTitle">${matchTitle(m)}</div><p>Simulazione non disponibile.</p></article>`;
      const pred=predOutcome(sim);
      const predLabel=pred==="homeWin"?"1":pred==="awayWin"?"2":"X";
      return `<article class="card">
        <div class="cardHead"><div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">${m.date} · motore ${sim.engine||"poisson"}</div></div><div class="score ${cls(m.fg)}">${m.fg||"TBD"}</div></div>
        <div class="grid">
          <div class="item"><span>Pronostico 1X2</span><strong>${predLabel} · 1 ${pct(sim.probs.homeWin)} · X ${pct(sim.probs.draw)} · 2 ${pct(sim.probs.awayWin)}</strong></div>
          <div class="item"><span>xG</span><strong>${sim.lh.toFixed(2)} - ${sim.la.toFixed(2)}</strong></div>
          <div class="item full"><span>Risultati esatti</span><strong>${sim.exactTop.map(x=>`${x.score} ${pct(x.prob)}`).join(" · ")}</strong></div>
        </div>
        <div class="scoreInputs"><input id="resH_${m.id}" type="number" min="0" step="1" value="${r.home??""}" placeholder="${m.home}"><span>-</span><input id="resA_${m.id}" type="number" min="0" step="1" value="${r.away??""}" placeholder="${m.away}"></div>
        <div class="actions"><button onclick="saveResult(${m.id})">Salva risultato</button><button class="ghost" onclick="clearResult(${m.id})">Cancella</button></div>
      </article>`;
    }).join("");
  }

  function calibrate(){
    const rows=backtestRows();if(rows.length<3){alert("Servono almeno 3 risultati salvati per calibrare.");return}
    let predH=0,predA=0,realH=0,realA=0;
    rows.forEach(m=>{const [lh,la]=expectedGoals(m,true);predH+=lh;predA+=la;realH+=m.result.home;realA+=m.result.away});
    state.calibration={homeGoalFactor:clamp(realH/Math.max(.1,predH),.85,1.15),awayGoalFactor:clamp(realA/Math.max(.1,predA),.85,1.15),sample:rows.length,updatedAt:new Date().toISOString()};
    clearSimulationCache();recalcOptimized();save();render("precision");
  }

  function resetCalibration(){state.calibration={homeGoalFactor:1,awayGoalFactor:1,sample:0,updatedAt:null};clearSimulationCache();recalcOptimized();save();render("precision")}

  function renderV7(tabId=activeTabId()){
    const views={today:renderToday,database:()=>{},money:renderMoney,fantasy:renderFantasy,squads:renderSquadsOptimized,montecarlo:renderMC,manualxi:renderManualXIV7,precision:renderPrecision,lineups:renderLineups,best:renderBest};
    (views[tabId]||renderToday)();
  }

  return {ensureState,exactSim,recalcMatchV7,topBonusV7,firstYellowV7,firstSubV7,bestGKV7,snapshot,renderManualXIV7,applyManualXIV7,fillCurrentXIV7,clearMatchXI,openLineupsV7,saveResult,clearResult,renderPrecision,calibrate,resetCalibration,renderV7};
})();

FG_V7.ensureState();
mc=FG_V7.exactSim;
recalcMatch=FG_V7.recalcMatchV7;
topBonus=FG_V7.topBonusV7;
firstYellow=FG_V7.firstYellowV7;
firstSub=FG_V7.firstSubV7;
bestGK=FG_V7.bestGKV7;
getPreLineupSnapshot=FG_V7.snapshot;
renderManualXI=FG_V7.renderManualXIV7;
applyManualXI=FG_V7.applyManualXIV7;
fillCurrentXI=FG_V7.fillCurrentXIV7;
render=FG_V7.renderV7;
openLineups=FG_V7.openLineupsV7;
openLineupsOptimized=FG_V7.openLineupsV7;
if(typeof window!=="undefined"){
  Object.assign(window,{openLineups:FG_V7.openLineupsV7,applyManualXI:FG_V7.applyManualXIV7,fillCurrentXI:FG_V7.fillCurrentXIV7,clearMatchXI:FG_V7.clearMatchXI,saveResult:FG_V7.saveResult,clearResult:FG_V7.clearResult});
}
if($("calibrateBtn"))$("calibrateBtn").onclick=FG_V7.calibrate;
if($("resetCalibrationBtn"))$("resetCalibrationBtn").onclick=FG_V7.resetCalibration;
if($("resetBtn"))$("resetBtn").onclick=resetState;
if($("importOfficial"))$("importOfficial").onclick=importOfficialOptimized;
if($("squadSearch"))$("squadSearch").oninput=renderSquadsOptimized;
fill();rebuildIndexes();clearSimulationCache();recalcOptimized();render();

function contextBadges(m){
  const engine=m.sim?.engine==="dixon-coles-v8"?"Dixon":m.sim?.engine==="poisson-exact"?"Poisson":"Model";
  const xi=m.matchLineups?"XI ufficiale manuale":"XI base";
  const cal=state.calibration?.sample?`Calibrato ${state.calibration.sample}`:"Calibrazione 1.00";
  return `<div class="badgeRow"><span class="miniBadge">${engine}</span><span class="miniBadge">${xi}</span><span class="miniBadge">${cal}</span></div>`;
}

function pickGridVisual(m){
  const p=m.aiPicks||{};
  const cell=(clsName,label,val)=>`<div class="item pickItem"><span class="${clsName}">${label}</span><strong>${val}</strong></div>`;
  return `<div class="grid picksGrid">
    ${cell("safe","Safe",p.safe?`${p.safe.label} · ${pct(p.safe.prob)} · fair ${p.safe.fair}`:"-")}
    ${cell("value","Value",p.value?`${p.value.label} · ${pct(p.value.prob)} · quota min ${p.value.fair}`:"-")}
    ${cell("crazy","Pazza",p.crazy?`${p.crazy.label} · fair ${p.crazy.fair}`:"-")}
    ${cell("combo","Combo",p.combo?`${p.combo.label} · fair ${p.combo.fair}`:"-")}
  </div>`;
}

function cardVisual(m,mode="all"){
  const b=topBonus(m),s=m.sim;
  let extra=mode==="money"?pickGridVisual(m):`<div class="grid">
    <div class="item"><span>PT / FT</span><strong>${m.pt} -> ${m.ft}</strong></div>
    <div class="item"><span>Status</span><strong class="${statusCls(m)}">${m.lineupStatus}</strong></div>
    <div class="item"><span>Safe</span><strong>${m.safe}</strong></div>
    <div class="item"><span>Value</span><strong>${m.value}</strong></div>
    <div class="item full"><span>Top 5 Bonus</span>${pill(b)}</div>
    ${s?`<div class="item"><span>1X2</span><strong>1 ${pct(s.probs.homeWin)} · X ${pct(s.probs.draw)} · 2 ${pct(s.probs.awayWin)}</strong></div><div class="item"><span>xG</span><strong>${s.lh.toFixed(2)} - ${s.la.toFixed(2)}</strong></div>`:""}
    ${impactBox(m)}
  </div>`;
  if(mode==="fantasy")extra=`<div class="grid"><div class="item"><span>Capitano</span><strong>${b[0]?.name||"-"}</strong></div><div class="item"><span>Vice</span><strong>${b[1]?.name||"-"}</strong></div><div class="item full"><span>Top 5 Bonus</span>${pill(b)}</div></div>`;
  return `<article class="card matchCard">
    <div class="cardHead"><div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">#${m.id} · ${m.date} · ${m.stage} ${m.group||""}</div>${contextBadges(m)}</div><div class="score ${cls(m.fg)}">${m.fg||"TBD"}</div></div>
    ${extra}
    <button class="ghost detailBtn" onclick="openDetail(${m.id})">Dettaglio</button>
  </article>`;
}

pickGrid=pickGridVisual;
card=cardVisual;
render();

const FG_V8=(()=>{
  const MAX_GOALS=10;

  function sideKey(m,team){return team===m.home?"home":team===m.away?"away":null}
  function byName(team,name){return playerIndex?.byTeamNormName?.get(team)?.get(normName(name))||null}
  function starters(m,team){
    const side=sideKey(m,team),names=side&&m.matchLineups?.[side]?.starters;
    if(names?.length)return names.map(n=>byName(team,n)).filter(Boolean);
    return active(team);
  }
  function teamPlayers(team){return playersForTeam(team)}
  function sig(m,team){return starters(m,team).map(p=>`${p.name}:${p.role}:${p.valueM||0}:${p.bonus||0}`).sort().join("|")}

  function teamStrength(m,team){
    const mt=tm(team),xi=starters(m,team),fifa=100-Math.min(95,mt.fifa);
    const xiVal=xi.length?xi.reduce((s,p)=>s+(p.valueM||10),0)/xi.length:10;
    const xiBonus=xi.length?xi.reduce((s,p)=>s+(p.bonus||60),0)/xi.length:60;
    return mt.elo*.030+fifa*.20+mt.form*.22+mt.squad*.25+xiVal*.12+xiBonus*.12;
  }

  function roleImpact(m,team){
    const xi=starters(m,team),all=teamPlayers(team),base=all.filter(p=>p.probableXI||p.status==="Titolare");
    const xiNames=new Set(xi.map(p=>p.name));
    const missingBase=base.filter(p=>!xiNames.has(p.name));
    const avgBonus=xi.length?xi.reduce((s,p)=>s+(p.bonus||60),0)/xi.length:60;
    const topAttack=xi.filter(p=>p.role==="ATT").reduce((s,p)=>s+(p.bonus||60),0);
    const defense=xi.filter(p=>p.role==="DIF"||p.role==="POR").reduce((s,p)=>s+(p.bonus||60),0);
    const gk=xi.find(p=>p.role==="POR");
    let attack=(avgBonus-70)/210+topAttack/2600;
    let defenseAdj=(defense-260)/3600+(gk?((gk.bonus||60)-65)/900:-.045);
    let absencePenalty=0,absenceNames=[];
    missingBase.forEach(p=>{
      const weight=p.role==="POR"?.07:p.role==="ATT"?.055:p.role==="CEN"?.038:.032;
      const val=weight*Math.max(0,((p.bonus||60)-68)/22);
      absencePenalty+=val;
      if(val>.018)absenceNames.push(p.name);
    });
    return {
      attack:clamp(attack-absencePenalty*.65,-.16,.18),
      defense:clamp(defenseAdj-absencePenalty*.45,-.16,.18),
      absencePenalty:clamp(absencePenalty,0,.22),
      absenceNames:absenceNames.slice(0,3),
      gkQuality:gk?gk.bonus||60:58
    };
  }

  function matchTempo(m){
    const H=tm(m.home),A=tm(m.away);
    const totalGF=H.gf+A.gf,totalGA=H.ga+A.ga;
    const gap=Math.abs(teamStrength(m,m.home)-teamStrength(m,m.away));
    let tempo=(totalGF+totalGA)/5.8;
    tempo+=gap>14?.04:gap<5?.025:0;
    tempo+=((H.form+A.form)-135)/1600;
    return clamp(tempo,.84,1.18);
  }

  function expectedGoalsV8(m,raw=false){
    const H=tm(m.home),A=tm(m.away),hImp=roleImpact(m,m.home),aImp=roleImpact(m,m.away);
    const diff=(teamStrength(m,m.home)-teamStrength(m,m.away))/18;
    let lh=(H.gf*.62+A.ga*.38)+diff*.43+.08;
    let la=(A.gf*.58+H.ga*.42)-diff*.38;
    lh*=.88+H.form/520+H.squad/730;
    la*=.86+A.form/540+A.squad/750;
    lh*=1+hImp.attack-aImp.defense*.55;
    la*=1+aImp.attack-hImp.defense*.55;
    const tempo=matchTempo(m);
    lh*=tempo;la*=tempo;
    if(!raw){const cal=state.calibration||{};lh*=cal.homeGoalFactor||1;la*=cal.awayGoalFactor||1}
    return [clamp(lh,.18,4.7),clamp(la,.14,4.1)];
  }

  function pmf(lambda,max=MAX_GOALS){
    const arr=[];let p=Math.exp(-lambda),sum=p;arr[0]=p;
    for(let k=1;k<=max;k++){p=p*lambda/k;arr[k]=p;sum+=p}
    arr[max]+=Math.max(0,1-sum);
    return arr;
  }

  function dixonRho(m,lh,la){
    const gap=Math.abs(teamStrength(m,m.home)-teamStrength(m,m.away));
    const total=lh+la;
    let rho=-.055;
    if(total<2.25)rho-=.025;
    if(gap<5)rho-=.015;
    if(total>3.2)rho+=.035;
    return clamp(rho,-.12,.02);
  }
  function tau(h,a,lh,la,rho){
    if(h===0&&a===0)return Math.max(.25,1-lh*la*rho);
    if(h===0&&a===1)return Math.max(.25,1+lh*rho);
    if(h===1&&a===0)return Math.max(.25,1+la*rho);
    if(h===1&&a===1)return Math.max(.25,1-rho);
    return 1;
  }

  function topScores(o,n=6){return Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([score,prob])=>({score,prob}))}

  function simV8(m){
    if(m.home.includes("Team ")||m.away.includes("Team "))return null;
    const cal=state.calibration||{},key=`v8|${m.id}|${m.date}|${sig(m,m.home)}|${sig(m,m.away)}|${cal.homeGoalFactor||1}|${cal.awayGoalFactor||1}`;
    if(simCache.has(key))return simCache.get(key);
    const [lh,la]=expectedGoalsV8(m),hp=pmf(lh),ap=pmf(la),rho=dixonRho(m,lh,la);
    let norm=0,hw=0,d=0,aw=0,o15=0,o25=0,u25=0,u45=0,btts=0,hcs=0,acs=0,exact={};
    for(let h=0;h<hp.length;h++)for(let a=0;a<ap.length;a++)norm+=hp[h]*ap[a]*tau(h,a,lh,la,rho);
    for(let h=0;h<hp.length;h++)for(let a=0;a<ap.length;a++){
      const p=hp[h]*ap[a]*tau(h,a,lh,la,rho)/norm,tot=h+a;
      if(h>a)hw+=p;else if(h===a)d+=p;else aw+=p;
      if(tot>1.5)o15+=p;if(tot>2.5)o25+=p;else u25+=p;if(tot<4.5)u45+=p;
      if(h&&a)btts+=p;if(!a)hcs+=p;if(!h)acs+=p;exact[`${h}-${a}`]=(exact[`${h}-${a}`]||0)+p;
    }
    const hhp=pmf(lh*.45,5),hap=pmf(la*.45,5),ht={};
    for(let h=0;h<hhp.length;h++)for(let a=0;a<hap.length;a++)ht[`${h}-${a}`]=(ht[`${h}-${a}`]||0)+hhp[h]*hap[a];
    const result={lh,la,rho,tempo:matchTempo(m),engine:"dixon-coles-v8",impacts:{home:roleImpact(m,m.home),away:roleImpact(m,m.away)},probs:{homeWin:hw,draw:d,awayWin:aw,over15:o15,over25:o25,under25:u25,under45:u45,btts:btts,homeCS:hcs,awayCS:acs},exactTop:topScores(exact),htTop:topScores(ht)};
    simCache.set(key,result);if(simCache.size>600)simCache.delete(simCache.keys().next().value);
    return result;
  }

  function recalcMatchV8(m){
    const s=simV8(m);if(!s){m.sim=null;m.oracle={signal:"avoid",label:"Evita",confidence:.15,pick:"-",pickProb:0,reasons:["Simulazione non disponibile."],risks:["Dati insufficienti o squadra placeholder."]};return}
    m.sim=s;m.aiPicks=picks(m,s);m.oracle=oracle(m,s);m.fg=Math.round(clamp(54+m.oracle.confidence*44,50,98));
    m.pt=s.htTop[0]?.score;m.ft=s.exactTop[0]?.score;
    m.safe=`${m.aiPicks.safe.label} · fair ${m.aiPicks.safe.fair}`;
    m.value=`${m.aiPicks.value.label} · quota min ${m.aiPicks.value.fair}`;
    m.crazy=`${m.aiPicks.crazy.label} · fair ${m.aiPicks.crazy.fair}`;
    m.combo=`${m.aiPicks.combo.label} · fair ${m.aiPicks.combo.fair}`;
  }

  function outcomeSpread(s){
    const vals=[s.probs.homeWin,s.probs.draw,s.probs.awayWin].sort((a,b)=>b-a);
    return vals[0]-vals[1];
  }
  function oracle(m,s=simV8(m)){
    if(!s)return {signal:"avoid",label:"Evita",confidence:.2,reasons:["Simulazione non disponibile."],risks:["Dati insufficienti."]};
    const probs=s.probs,total=s.lh+s.la,spread=outcomeSpread(s),safe=m.aiPicks?.safe||picks(m,s).safe;
    const fav=probs.homeWin>=probs.awayWin?m.home:m.away, favP=Math.max(probs.homeWin,probs.awayWin);
    const dog=probs.homeWin<probs.awayWin?m.home:m.away, dogP=Math.min(probs.homeWin,probs.awayWin);
    const hImp=s.impacts.home,aImp=s.impacts.away;
    const absences=hImp.absencePenalty+aImp.absencePenalty;
    let confidence=clamp(.35+safe.prob*.42+spread*.26-absences*.55,.08,.98);
    let signal="playable",label="Giocabile";
    const reasons=[],risks=[];
    if(confidence<.52||absences>.14||(total<2.45&&spread<.11)){signal="avoid";label="Evita";confidence*=.72;risks.push("Lettura fragile: margine basso, assenze o ritmo sporco.")}
    else if(favP>.58&&(probs.draw>.22||total<2.55||s.rho<-.08)){signal="trap";label="Trappola";confidence*=.80;risks.push("Favorita invitante, ma pareggio/ritmo basso la rendono scivolosa.")}
    else if(dogP>.20&&favP<.60){signal="upset";label="Upset possibile";confidence*=.86;reasons.push(`${dog} resta viva sopra il ${pct(dogP)}.`)}
    else if(safe.prob>.74&&absences<.08){signal="playable";label="Pick pulita";reasons.push("Probabilita alta e XI senza grossi allarmi.")}
    if(total>2.9)reasons.push(`Ritmo alto: xG totali ${total.toFixed(2)}.`);
    if(total<2.25)risks.push(`Ritmo basso: xG totali ${total.toFixed(2)}.`);
    if(hImp.absenceNames.length)risks.push(`${m.home} perde peso XI: ${hImp.absenceNames.join(", ")}.`);
    if(aImp.absenceNames.length)risks.push(`${m.away} perde peso XI: ${aImp.absenceNames.join(", ")}.`);
    if(s.tempo>1.06)reasons.push("Profilo partita aperto.");
    if(s.rho<-.08)risks.push("Correzione Dixon-Coles alza i punteggi bassi.");
    reasons.unshift(`Lettura migliore: ${safe.label} (${pct(safe.prob)}).`);
    if(!risks.length)risks.push("Rischio principale: episodio o rosso precoce.");
    return {signal,label,confidence:clamp(confidence,.05,.98),pick:safe.label,pickProb:safe.prob,fav,favP,dog,dogP,reasons:reasons.slice(0,4),risks:risks.slice(0,3)};
  }

  function signalClass(s){return s==="trap"?"trap":s==="upset"?"upset":s==="avoid"?"avoid":"playable"}
  function oracleCard(m){
    const s=m.sim||simV8(m),o=m.oracle||oracle(m,s),klass=signalClass(o.signal);
    if(!s)return `<article class="card oracleCard avoid">
      <div class="cardHead"><div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">#${m.id} · ${m.date} · dati insufficienti</div></div><div class="score low">TBD</div></div>
      <div class="signalRow"><span class="signal avoid">Evita</span><span class="miniBadge">No model</span></div>
      <div class="grid"><div class="item full"><span>Oracle dice</span><div class="explainList"><p>Simulazione non disponibile.</p></div></div><div class="item full"><span>Occhio a</span><div class="explainList"><p>Dati insufficienti o squadra placeholder.</p></div></div></div>
    </article>`;
    return `<article class="card oracleCard ${klass}">
      <div class="cardHead"><div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">#${m.id} · ${m.date} · ${s?.engine||"oracle"}</div>${contextBadges(m)}</div><div class="score ${cls(m.fg)}">${m.fg||"TBD"}</div></div>
      <div class="signalRow"><span class="signal ${klass}">${o.label}</span><span class="miniBadge">${o.pick} · ${pct(o.pickProb||0)}</span><span class="miniBadge">Fiducia ${pct(o.confidence)}</span></div>
      <div class="confidenceBar" style="--w:${Math.round(o.confidence*100)}%"><span></span></div>
      <div class="grid">
        <div class="item"><span>1X2</span><strong>1 ${pct(s.probs.homeWin)} · X ${pct(s.probs.draw)} · 2 ${pct(s.probs.awayWin)}</strong></div>
        <div class="item"><span>xG / ritmo</span><strong>${s.lh.toFixed(2)} - ${s.la.toFixed(2)} · ${s.tempo.toFixed(2)}</strong></div>
        <div class="item full"><span>Oracle dice</span><div class="explainList">${o.reasons.map(x=>`<p>${x}</p>`).join("")}</div></div>
        <div class="item full"><span>Occhio a</span><div class="explainList">${o.risks.map(x=>`<p>${x}</p>`).join("")}</div></div>
      </div>
      <button class="ghost detailBtn" onclick="openDetail(${m.id})">Dettaglio</button>
    </article>`;
  }

  function renderOracle(){
    const q=$("oracleSearch")?.value?.toLowerCase()||"",filter=$("oracleFilter")?.value||"";
    state.matches.forEach(m=>{if(m.sim&&!m.oracle)m.oracle=oracle(m,m.sim)});
    const all=state.matches.filter(m=>m.oracle);
    $("oraclePlayable").textContent=all.filter(m=>m.oracle.signal==="playable").length;
    $("oracleTraps").textContent=all.filter(m=>m.oracle.signal==="trap").length;
    $("oracleUpsets").textContent=all.filter(m=>m.oracle.signal==="upset").length;
    $("oracleAvoid").textContent=all.filter(m=>m.oracle.signal==="avoid").length;
    const list=all.filter(m=>(!q||matchTitle(m).toLowerCase().includes(q))&&(!filter||m.oracle.signal===filter));
    $("oracleCards").innerHTML=list.map(oracleCard).join("");
  }

  function renderV8(tabId=activeTabId()){
    const views={today:renderToday,oracle:renderOracle,database:()=>{},money:renderMoney,fantasy:renderFantasy,squads:renderSquadsOptimized,montecarlo:renderMC,manualxi:renderManualXI,precision:FG_V7.renderPrecision,lineups:renderLineups,best:renderBest};
    (views[tabId]||renderToday)();
  }

  return {simV8,recalcMatchV8,oracle,renderOracle,renderV8,expectedGoalsV8};
})();

mc=FG_V8.simV8;
recalcMatch=FG_V8.recalcMatchV8;
render=FG_V8.renderV8;
if($("oracleSearch"))$("oracleSearch").oninput=FG_V8.renderOracle;
if($("oracleFilter"))$("oracleFilter").onchange=FG_V8.renderOracle;
clearSimulationCache();recalcOptimized();render();

const FG_FANTA_RULES=(()=>{
  function sideKey(m,team){return team===m.home?"home":team===m.away?"away":null}
  function byName(team,name){return playerIndex?.byTeamNormName?.get(team)?.get(normName(name))||null}
  function activeForMatch(m,team){
    const side=sideKey(m,team),names=side&&m.matchLineups?.[side]?.starters;
    if(names?.length)return names.map(n=>byName(team,n)).filter(Boolean);
    return active(team);
  }
  function allActive(m){return activeForMatch(m,m.home).concat(activeForMatch(m,m.away))}
  function teamXg(m,team,s=m.sim||mc(m)){
    if(s)return team===m.home?s.lh:team===m.away?s.la:0;
    const t=tm(team);
    return clamp(t.gf||1.15,.35,3.1);
  }
  function roleGoalBase(p){
    return p.role==="ATT"?4.8:p.role==="CEN"?2.25:p.role==="DIF"?0.72:0.03;
  }
  function playerGoalWeight(p){
    const setPiece=/pen|rig|piazz|free|corner|pun/i.test(String(p.setPieces||""))?1.14:1;
    const quality=clamp((p.bonus||60)/70,.62,1.45);
    const scorer=1+clamp((p.goals||0)/36,0,.46);
    const value=1+clamp((p.valueM||0)/80,0,.28);
    return roleGoalBase(p)*quality*scorer*value*setPiece;
  }
  function goalShare(p,m){
    if(p.role==="POR")return 0;
    const mates=activeForMatch(m,p.team).filter(x=>x.role!=="POR");
    const weights=mates.map(x=>({key:normName(x.name),w:playerGoalWeight(x)}));
    const total=weights.reduce((sum,x)=>sum+x.w,0)||1;
    return (weights.find(x=>x.key===normName(p.name))?.w||0)/total;
  }
  function goalProb(p,m){
    const xg=teamXg(m,p.team)*goalShare(p,m);
    return clamp(1-Math.exp(-xg),0,.86);
  }
  function cleanSheetProb(p,m,s=m.sim||mc(m)){
    if(p.role!=="POR"&&p.role!=="DIF")return 0;
    if(!s)return 0;
    return p.team===m.home?s.probs.homeCS:p.team===m.away?s.probs.awayCS:0;
  }
  function cardRisk(p,m){
    const t=m.tactical||null;
    const pressure=t?(p.team===m.home?t.away.directness-t.home.defensiveBlock:t.home.directness-t.away.defensiveBlock):0;
    const roleBump=p.role==="DIF"?0.035:p.role==="CEN"?0.025:p.role==="POR"?-0.045:0.005;
    return clamp((p.yellow||0)/100+roleBump+clamp(pressure/240,-.035,.075),0,.86);
  }
  function penaltySignal(p){
    const txt=String(p.setPieces||"");
    let w=/pen|rig/i.test(txt)?1.35:/piazz|free|corner|pun/i.test(txt)?0.34:0;
    w+=p.role==="ATT"?0.55:p.role==="CEN"?0.30:p.role==="DIF"?0.08:0;
    w+=clamp((p.goals||0)/40,0,.28);
    w+=clamp(((p.bonus||60)-68)/45,0,.35);
    return Math.max(.02,w);
  }
  function penaltyMissRisk(p,m){
    const mates=activeForMatch(m,p.team).filter(x=>x.role!=="POR");
    const pool=mates.map(x=>({key:normName(x.name),w:penaltySignal(x)}));
    const total=pool.reduce((sum,x)=>sum+x.w,0)||1;
    const share=(pool.find(x=>x.key===normName(p.name))?.w||.02)/total;
    const award=clamp(.035+teamXg(m,p.team)*.032,.035,.12);
    return clamp(share*award*.22,0,.06);
  }
  function fantaScore(p,m){
    const g=goalProb(p,m),cs=cleanSheetProb(p,m),card=cardRisk(p,m),miss=penaltyMissRisk(p,m);
    const base=p.role==="ATT"?39:p.role==="CEN"?34:p.role==="DIF"?32:31;
    const goalLift=p.role==="DIF"?80:p.role==="CEN"?72:p.role==="ATT"?68:95;
    const csLift=p.role==="POR"?60:p.role==="DIF"?53:0;
    const formLift=clamp(((p.bonus||60)-60)/100,-.04,.12)*100;
    const starterBoost=p.probableXI?3:0;
    const fantasyScore=Math.round(clamp(base+g*goalLift+cs*csLift+formLift+starterBoost-card*20-miss*95,3,99));
    return {...p,fantasyScore,fanta:{goalProb:g,cleanSheetProb:cs,cardRisk:card,penaltyMissRisk:miss}};
  }
  function topBonusRules(m){
    return allActive(m).map(p=>fantaScore(p,m)).sort((a,b)=>b.fantasyScore-a.fantasyScore).slice(0,5);
  }
  function bestGKRules(m){
    return allActive(m).filter(p=>p.role==="POR").map(p=>fantaScore(p,m)).sort((a,b)=>b.fantasyScore-a.fantasyScore)[0];
  }
  function fantaParts(p){
    const parts=[`Goal ${pct(p.fanta.goalProb)}`];
    if(p.role==="POR"||p.role==="DIF")parts.push(`Porta inv. ${pct(p.fanta.cleanSheetProb)}`);
    parts.push(`Cart. ${pct(p.fanta.cardRisk)}`);
    if(p.fanta.penaltyMissRisk>.006)parts.push(`Rig. sb. ${pct(p.fanta.penaltyMissRisk)}`);
    return parts.join(" · ");
  }
  function fantaList(players){
    return `<div class="explainList">${players.map((p,i)=>`<p><b>${i+1}. ${p.name}</b> · ${p.team} · ${p.role} · score ${p.fantasyScore}<br>${fantaParts(p)}</p>`).join("")}</div>`;
  }
  function renderFantasyRules(){
    const el=$("fantasyCards");if(!el)return;
    el.innerHTML=state.matches.map(m=>{
      const b=topBonusRules(m),y=firstYellow(m),sub=firstSub(m),gk=bestGKRules(m),s=m.sim||mc(m);
      const leader=b[0];
      return `<article class="card">
        <div class="cardHead"><div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">${m.date} · ${m.group||m.stage}</div>${contextBadges(m)}</div><div class="score ${cls(m.fg)}">${m.fg||"TBD"}</div></div>
        <div class="signalRow"><span class="miniBadge">Regole: goal + porta inviolata</span><span class="miniBadge">Malus: cartellini + rigori sbagliati</span></div>
        <div class="grid">
          <div class="item"><span>Risultato primo tempo</span><strong>${m.pt||"-"}</strong></div>
          <div class="item"><span>Risultato finale</span><strong>${m.ft||"-"}</strong></div>
          <div class="item"><span>Clean Sheet</span><strong>${s?`${m.home} ${pct(s.probs.homeCS)} · ${m.away} ${pct(s.probs.awayCS)}`:"-"}</strong></div>
          <div class="item"><span>Portiere Fanta</span><strong>${gk?`${gk.name} · ${gk.fantasyScore} · PI ${pct(gk.fanta.cleanSheetProb)}`:"-"}</strong></div>
          <div class="item full"><span>Top 5 Fantamondiale</span>${fantaList(b)}</div>
          <div class="item"><span>Favorito goal</span><strong>${leader?`${leader.name} · ${pct(leader.fanta.goalProb)}`:"-"}</strong></div>
          <div class="item"><span>Rischio cartellino</span><strong>${y?`${y.name} · ${pct(cardRisk(y,m))}`:"-"}</strong></div>
          <div class="item"><span>Primo cambio</span><strong>${sub?`${sub.name} · ${sub.sub||0}%`:"-"}</strong></div>
        </div>
      </article>`;
    }).join("");
  }
  return {fantaScore,topBonusRules,bestGKRules,renderFantasyRules};
})();

topBonus=FG_FANTA_RULES.topBonusRules;
bestGK=FG_FANTA_RULES.bestGKRules;
renderFantasy=FG_FANTA_RULES.renderFantasyRules;
render();

const FG_TACTICS=(()=>{
  function sideKey(m,team){return team===m.home?"home":team===m.away?"away":null}
  function byName(team,name){return playerIndex?.byTeamNormName?.get(team)?.get(normName(name))||null}
  function starters(m,team){
    const side=sideKey(m,team),names=side&&m.matchLineups?.[side]?.starters;
    if(names?.length)return names.map(n=>byName(team,n)).filter(Boolean);
    return active(team);
  }
  function avg(arr,fn,fb=0){return arr.length?arr.reduce((s,x)=>s+fn(x),0)/arr.length:fb}
  function score100(x,min,max){return Math.round(clamp((x-min)/(max-min),0,1)*100)}
  function teamProfile(m,team){
    const mt=tm(team),xi=starters(m,team),all=playersForTeam(team);
    const att=xi.filter(p=>p.role==="ATT"),mid=xi.filter(p=>p.role==="CEN"),def=xi.filter(p=>p.role==="DIF"),gk=xi.find(p=>p.role==="POR");
    const attBonus=avg(att,p=>p.bonus||60,62),midBonus=avg(mid,p=>p.bonus||60,62),defBonus=avg(def,p=>p.bonus||60,62),gkBonus=gk?.bonus||58;
    const height=avg(def.concat(att),p=>p.height||180,180);
    const directness=score100(mt.gf*.62+att.length*.18+attBonus/52-mt.btts*.12,1.2,3.0);
    const control=score100(mt.elo/900+mt.squad/52+midBonus/48+mt.form/90,4.5,6.0);
    const defensiveBlock=score100((2.15-mt.ga)+mt.cs*1.2+defBonus/58+gkBonus/62,3.0,5.2);
    const tempo=score100(mt.gf+mt.ga+mt.btts+mt.cards*.12,2.1,4.3);
    const setPieces=score100(height+def.length*2.3+attBonus*.08,182,205);
    const discipline=score100(3.2-mt.cards-avg(xi,p=>p.yellow||18,18)/45,1.0,3.2);
    const style=styleLabel({directness,control,defensiveBlock,tempo});
    const vulnerabilities=[];
    if(defensiveBlock<43)vulnerabilities.push("Linea difensiva vulnerabile se viene attaccata con continuita.");
    if(gkBonus<64)vulnerabilities.push("Portiere/clean sheet sotto pressione.");
    if(control<45)vulnerabilities.push("Fatica a controllare ritmo e seconde palle.");
    if(discipline<42)vulnerabilities.push("Rischio cartellini e falli tattici alto.");
    if(attBonus<67&&directness<48)vulnerabilities.push("Produzione offensiva poco incisiva.");
    if(tempo>70&&defensiveBlock<58)vulnerabilities.push("Quando la partita si apre concede spazi.");
    const strengths=[];
    if(control>66)strengths.push("Buon controllo territoriale e gestione ritmo.");
    if(directness>65)strengths.push("Attacco verticale e capacità di creare volume.");
    if(defensiveBlock>66)strengths.push("Struttura difensiva solida.");
    if(setPieces>64)strengths.push("Minaccia su piazzati e duelli aerei.");
    if(discipline>62)strengths.push("Partita pulita, pochi regali emotivi.");
    return {team,style,directness,control,defensiveBlock,tempo,setPieces,discipline,vulnerabilities:vulnerabilities.slice(0,4),strengths:strengths.slice(0,4),roles:{att:att.length,mid:mid.length,def:def.length,gk:gk?1:0},gkBonus};
  }
  function styleLabel(p){
    if(p.control>68&&p.directness>60)return "Dominante e verticale";
    if(p.tempo>68&&p.directness>58)return "Transizione rapida";
    if(p.defensiveBlock>68&&p.tempo<56)return "Blocco basso ordinato";
    if(p.control>64&&p.tempo<62)return "Controllo paziente";
    if(p.tempo>70&&p.defensiveBlock<55)return "Partita aperta";
    if(p.directness<48&&p.control<50)return "Reattiva e fragile";
    return "Equilibrata";
  }
  function matchup(m){
    const home=teamProfile(m,m.home),away=teamProfile(m,m.away),sim=m.sim||mc(m);
    const edges=[],risks=[];
    if(home.directness-away.defensiveBlock>18)edges.push(`${m.home} puo attaccare la vulnerabilita difensiva di ${m.away}.`);
    if(away.directness-home.defensiveBlock>18)edges.push(`${m.away} puo trovare campo contro ${m.home}.`);
    if(home.control-away.control>18)edges.push(`${m.home} ha vantaggio nel controllo del ritmo.`);
    if(away.control-home.control>18)edges.push(`${m.away} puo sporcare il possesso di ${m.home}.`);
    if(home.setPieces-away.discipline>20)edges.push(`${m.home} pericolosa su piazzati e duelli.`);
    if(away.setPieces-home.discipline>20)edges.push(`${m.away} ha mismatch su piazzati.`);
    if(home.tempo>68&&away.tempo>68)risks.push("Entrambe portano ritmo: gara emotiva e meno controllabile.");
    if(home.defensiveBlock>67&&away.defensiveBlock>67)risks.push("Due blocchi solidi: rischio partita chiusa.");
    if(home.vulnerabilities.length&&away.directness>60)risks.push(`${m.home} vulnerabile se ${m.away} accelera.`);
    if(away.vulnerabilities.length&&home.directness>60)risks.push(`${m.away} vulnerabile se ${m.home} accelera.`);
    const openScore=(home.tempo+away.tempo+home.directness+away.directness-home.defensiveBlock*.35-away.defensiveBlock*.35)/3;
    const mismatchScore=Math.max(Math.abs(home.directness-away.defensiveBlock),Math.abs(away.directness-home.defensiveBlock),Math.abs(home.control-away.control));
    let tag="balanced";
    if(openScore>66)tag="open";
    if(openScore<45)tag="locked";
    if(mismatchScore>55)tag="mismatch";
    if(home.vulnerabilities.length+away.vulnerabilities.length>=5)tag="fragile";
    return {home,away,edges:edges.slice(0,4),risks:risks.slice(0,4),openScore:Math.round(openScore),mismatchScore:Math.round(mismatchScore),tag,sim};
  }
  function bar(label,val){return `<div class="barLine"><span>${label}</span><div class="barTrack"><i style="--w:${val}%"></i></div><strong>${val}</strong></div>`}
  function teamBox(p){
    return `<div class="item"><span>${p.team}</span><strong><span class="styleTag">${p.style}</span></strong>
      <div class="profileBars">${bar("Verticale",p.directness)}${bar("Controllo",p.control)}${bar("Difesa",p.defensiveBlock)}${bar("Ritmo",p.tempo)}${bar("Piazzati",p.setPieces)}</div>
    </div>`;
  }
  function tacticalCard(m){
    const t=m.tactical||matchup(m);
    return `<article class="card tacticalCard">
      <div class="cardHead"><div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">#${m.id} · ${m.date} · analisi stile e vulnerabilita</div>${contextBadges(m)}</div><div class="score ${cls(m.fg)}">${m.fg||"TBD"}</div></div>
      <div class="signalRow"><span class="styleTag">${t.tag==="mismatch"?"Mismatch":t.tag==="fragile"?"Fragilita":t.tag==="open"?"Aperta":t.tag==="locked"?"Bloccata":"Equilibrata"}</span><span class="miniBadge">Mismatch ${t.mismatchScore}</span><span class="miniBadge">Apertura ${t.openScore}</span></div>
      <div class="grid">${teamBox(t.home)}${teamBox(t.away)}
        <div class="item full"><span>Vantaggi tattici</span><div class="tacticalList">${(t.edges.length?t.edges:["Nessun mismatch netto: partita da leggere sui dettagli."]).map(x=>`<p class="advantage">${x}</p>`).join("")}</div></div>
        <div class="item full"><span>Vulnerabilita</span><div class="tacticalList">${t.home.vulnerabilities.concat(t.away.vulnerabilities).slice(0,5).map(x=>`<p class="vulnerability">${x}</p>`).join("")||"<p>Nessuna vulnerabilita forte dal profilo attuale.</p>"}</div></div>
        <div class="item full"><span>Rischi partita</span><div class="tacticalList">${(t.risks.length?t.risks:["Rischio principale: episodio, rosso o calo di ritmo."]).map(x=>`<p>${x}</p>`).join("")}</div></div>
      </div>
    </article>`;
  }
  function renderTactics(){
    const q=$("tacticalSearch")?.value?.toLowerCase()||"",filter=$("tacticalFilter")?.value||"";
    state.matches.forEach(m=>{m.tactical=matchup(m)});
    const all=state.matches.filter(m=>m.tactical);
    $("tacticalMismatch").textContent=all.filter(m=>m.tactical.mismatchScore>55).length;
    $("tacticalFragile").textContent=all.filter(m=>m.tactical.home.vulnerabilities.length+m.tactical.away.vulnerabilities.length>=5).length;
    $("tacticalOpen").textContent=all.filter(m=>m.tactical.openScore>66).length;
    $("tacticalLocked").textContent=all.filter(m=>m.tactical.openScore<45).length;
    const passFilter=m=>!filter||
      (filter==="mismatch"&&m.tactical.mismatchScore>55)||
      (filter==="fragile"&&m.tactical.home.vulnerabilities.length+m.tactical.away.vulnerabilities.length>=5)||
      (filter==="open"&&m.tactical.openScore>66)||
      (filter==="locked"&&m.tactical.openScore<45);
    const list=all.filter(m=>(!q||matchTitle(m).toLowerCase().includes(q)||m.home.toLowerCase().includes(q)||m.away.toLowerCase().includes(q))&&passFilter(m));
    $("tacticalCards").innerHTML=list.map(tacticalCard).join("");
  }
  function enrichOracle(m){
    if(!m.oracle)return;
    const t=m.tactical||matchup(m);
    const reason=t.edges[0],risk=t.risks[0];
    if(reason&&!m.oracle.reasons.includes(reason))m.oracle.reasons.splice(1,0,reason);
    if(risk&&!m.oracle.risks.includes(risk))m.oracle.risks.unshift(risk);
    if(t.tag==="fragile"&&m.oracle.signal==="playable"){m.oracle.signal="trap";m.oracle.label="Trappola tattica";m.oracle.confidence*=.86}
    if(t.tag==="mismatch"&&m.oracle.signal==="upset"){m.oracle.label="Upset tattico"}
  }
  function recalcMatchTactical(m){
    FG_V8.recalcMatchV8(m);
    m.tactical=matchup(m);
    enrichOracle(m);
  }
  function renderTactical(tabId=activeTabId()){
    const views={today:renderToday,oracle:FG_V8.renderOracle,tactics:renderTactics,database:()=>{},money:renderMoney,fantasy:renderFantasy,squads:renderSquadsOptimized,montecarlo:renderMC,manualxi:renderManualXI,precision:FG_V7.renderPrecision,lineups:renderLineups,best:renderBest};
    (views[tabId]||renderToday)();
  }
  return {teamProfile,matchup,renderTactics,recalcMatchTactical,renderTactical,enrichOracle};
})();

recalcMatch=FG_TACTICS.recalcMatchTactical;
render=FG_TACTICS.renderTactical;
if($("tacticalSearch"))$("tacticalSearch").oninput=FG_TACTICS.renderTactics;
if($("tacticalFilter"))$("tacticalFilter").onchange=FG_TACTICS.renderTactics;
clearSimulationCache();recalcOptimized();render();
