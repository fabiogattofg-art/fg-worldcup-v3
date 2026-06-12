import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.static(__dirname));
const PORT = process.env.PORT || 3000;

function normalizeForMatch(s){
  return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
}
function clean(s){return (s||"").replace(/\s+/g," ").trim();}

app.get("/", (_, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/api/import-official-squads", (_, res) => {
  try {
    const players = JSON.parse(fs.readFileSync(path.join(__dirname, "official_players.json"), "utf8"));
    const teams = new Set(players.map(p => p.team)).size;
    res.json({ ok:true, source:"Local embedded FIFA official squad list", extraction:"local-json", players, teams });
  } catch(e) { res.json({ ok:false, error:e.message }); }
});

function findWindows(text){
  const signals = ["confirmed lineups","lineups","starting xi","starting lineups","formazioni ufficiali","formazioni","titolari","official lineups","probable lineups"];
  const low = text.toLowerCase();
  const windows=[];
  for(const sig of signals){
    let idx = low.indexOf(sig);
    while(idx >= 0){
      windows.push({sig, start:Math.max(0,idx-1500), end:Math.min(text.length,idx+9000)});
      idx = low.indexOf(sig, idx+sig.length);
    }
  }
  // prefer official/confirmed over probable
  windows.sort((a,b)=>{
    const score=w=>/confirmed|official|ufficial/i.test(w.sig)?0:/probable/i.test(w.sig)?2:1;
    return score(a)-score(b) || a.start-b.start;
  });
  return windows.slice(0,12).map(w=>text.slice(w.start,w.end));
}

function classifyKnownPlayers(text, knownPlayers, home, away){
  const windows=findWindows(text);
  if(!windows.length) return {players:[], reason:"nessun blocco lineups/formazioni"};
  let best={players:[], score:0, reason:""};

  for(const win of windows){
    const nwin=normalizeForMatch(win);
    const found=[];
    for(const p of knownPlayers||[]){
      const key=normalizeForMatch(p.name);
      if(!key || key.length<4) continue;
      const idx=nwin.indexOf(key);
      if(idx>=0 && !found.some(x=>x.name===p.name && x.team===p.team)) found.push({...p, idx});
    }
    const byTeam={};
    for(const team of [home,away]) byTeam[team]=found.filter(p=>p.team===team).sort((a,b)=>a.idx-b.idx);
    const counts=[byTeam[home].length, byTeam[away].length];
    const officialSignal=/confirmed lineups|official lineups|formazioni ufficiali|starting xi|starting lineups|titolari/i.test(win);
    const score=Math.min(counts[0],11)+Math.min(counts[1],11)+(officialSignal?6:0)-(/probable/i.test(win)?4:0);
    if(score>best.score){
      const result=[];
      for(const team of [home,away]){
        const rows=byTeam[team];
        // If a substitutes marker appears, classify names after it as bench. Otherwise first 11 are starters.
        const markerIdx = Math.min(...["substitutes","bench","panchina","riserve"].map(s=>normalizeForMatch(win).indexOf(normalizeForMatch(s))).filter(i=>i>=0));
        rows.forEach((p,i)=>{
          let status="Panchina";
          if(Number.isFinite(markerIdx) && markerIdx>=0){
            status = p.idx < markerIdx ? "Titolare" : "Panchina";
          }else{
            status = i<11 ? "Titolare" : "Panchina";
          }
          // absent marker nearby
          const rawApprox = Math.max(0, Math.floor(p.idx * win.length / Math.max(1,nwin.length))-300);
          const ctx = win.slice(rawApprox, rawApprox+900).toLowerCase();
          if(/injured|suspended|absent|doubtful|indisponibile|squalificato|infortunato|fuori/i.test(ctx)) status="Fuori";
          result.push({name:p.name,team:p.team,role:p.role,status});
        });
      }
      best={players:result, score, reason:officialSignal?"official window":"lineup window"};
    }
  }
  return best;
}

async function fetchText(url){
  try{
    const r=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/plain"}});
    if(!r.ok) return "";
    return await r.text();
  }catch(e){return "";}
}

async function getCandidateText(home,away){
  const q1=encodeURIComponent(`${home} ${away} confirmed lineups`);
  const q2=encodeURIComponent(`${home} ${away} formazioni ufficiali`);
  const q3=encodeURIComponent(`${home} ${away} starting xi`);
  const urls=[
    `https://r.jina.ai/http://www.google.com/search?q=${q1}`,
    `https://r.jina.ai/http://www.google.com/search?q=${q2}`,
    `https://r.jina.ai/http://www.bing.com/search?q=${q1}`,
    `https://r.jina.ai/http://www.bing.com/search?q=${q3}`,
    `https://r.jina.ai/http://www.sofascore.com/search/all?q=${encodeURIComponent(home+" "+away)}`,
    `https://r.jina.ai/http://www.diretta.it/cerca/?q=${encodeURIComponent(home+" "+away)}`,
    `https://r.jina.ai/http://www.flashscore.com/search/?q=${encodeURIComponent(home+" "+away)}`
  ];
  let text="";
  for(const url of urls){
    const t=await fetchText(url);
    if(t) text += `\n\nSOURCE: ${url}\n${t.slice(0,80000)}`;
  }
  return text;
}

app.post("/api/find-official-lineups", async (req, res) => {
  const {home, away, knownPlayers} = req.body || {};
  if(!home || !away) return res.json({ok:false,error:"Squadre mancanti"});
  try{
    const text=await getCandidateText(home,away);
    if(!text || text.length<500) return res.json({ok:false,error:"Nessuna fonte leggibile",source:"Official lineup checker"});
    const parsed=classifyKnownPlayers(text,knownPlayers||[],home,away);
    const players=parsed.players||[];
    const homeXI=players.filter(p=>p.team===home&&p.status==="Titolare").length;
    const awayXI=players.filter(p=>p.team===away&&p.status==="Titolare").length;
    const homeKnown=players.filter(p=>p.team===home).length;
    const awayKnown=players.filter(p=>p.team===away).length;
    if(homeXI<10 || awayXI<10){
      return res.json({ok:false,error:`Ufficiali non affidabili: titolari ${homeXI}/${awayXI}, nomi ${homeKnown}/${awayKnown}.`,source:"Official lineup checker",debug:{reason:parsed.reason,homeXI,awayXI,homeKnown,awayKnown}});
    }
    res.json({ok:true,source:"Official lineup checker",players,confidence:"high",counts:{homeXI,awayXI,homeKnown,awayKnown},reason:parsed.reason});
  }catch(e){res.json({ok:false,error:e.message,source:"Official lineup checker"});}
});


function ssNorm(s){
  return (s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]/g,"");
}

function fuzzyKnownName(name, knownPlayers, team){
  const n = ssNorm(name);
  if(!n) return null;
  let exact = knownPlayers.find(p => p.team===team && ssNorm(p.name)===n);
  if(exact) return exact;
  let partial = knownPlayers.find(p => p.team===team && (ssNorm(p.name).includes(n) || n.includes(ssNorm(p.name))));
  if(partial) return partial;
  // match surname-like last token
  const last = n.slice(Math.max(0,n.length-8));
  return knownPlayers.find(p => p.team===team && ssNorm(p.name).endsWith(last)) || null;
}

async function ssFetch(url){
  const r = await fetch(url, {
    headers:{
      "User-Agent":"Mozilla/5.0",
      "Accept":"application/json,text/plain,*/*",
      "Referer":"https://www.sofascore.com/"
    }
  });
  if(!r.ok) return null;
  return await r.json();
}

async function findSofascoreEventId(home, away, date){
  const q = encodeURIComponent(`${home} ${away}`);
  const searchUrls = [
    `https://www.sofascore.com/api/v1/search/all?q=${q}`,
    `https://www.sofascore.com/api/v1/search/events?q=${q}`
  ];

  for(const url of searchUrls){
    try{
      const data = await ssFetch(url);
      const candidates = [];
      function walk(x){
        if(!x) return;
        if(Array.isArray(x)) return x.forEach(walk);
        if(typeof x === "object"){
          if(x.id && x.homeTeam && x.awayTeam) candidates.push(x);
          for(const v of Object.values(x)) walk(v);
        }
      }
      walk(data);
      const hN = ssNorm(home), aN = ssNorm(away);
      const scored = candidates.map(e=>{
        const eh = ssNorm(e.homeTeam?.name || e.homeTeam?.shortName || "");
        const ea = ssNorm(e.awayTeam?.name || e.awayTeam?.shortName || "");
        let score = 0;
        if(eh.includes(hN) || hN.includes(eh)) score += 5;
        if(ea.includes(aN) || aN.includes(ea)) score += 5;
        if(ea.includes(hN) || hN.includes(ea)) score += 3;
        if(eh.includes(aN) || aN.includes(eh)) score += 3;
        if(date && String(e.startTimestamp||"").length){
          const d = new Date(e.startTimestamp*1000).toISOString().slice(0,10);
          if(d===date) score += 4;
        }
        return {e, score};
      }).sort((a,b)=>b.score-a.score);
      if(scored[0]?.score >= 6) return scored[0].e.id;
    }catch(e){}
  }
  return null;
}

function parseSofascoreLineups(data, home, away, knownPlayers){
  const result = [];
  const addPlayer = (raw, team, status) => {
    const name = raw?.player?.name || raw?.player?.shortName || raw?.name || raw?.shortName || "";
    const known = fuzzyKnownName(name, knownPlayers, team);
    if(!known) return;
    if(result.some(x=>x.team===known.team && ssNorm(x.name)===ssNorm(known.name))) return;
    result.push({name:known.name, team:known.team, role:known.role, status});
  };

  const homeObj = data?.home || data?.homeTeam || {};
  const awayObj = data?.away || data?.awayTeam || {};

  const hPlayers = homeObj.players || homeObj.startingXI || homeObj.lineup || [];
  const aPlayers = awayObj.players || awayObj.startingXI || awayObj.lineup || [];
  const hSubs = homeObj.substitutes || homeObj.bench || [];
  const aSubs = awayObj.substitutes || awayObj.bench || [];
  const hMissing = homeObj.missingPlayers || homeObj.missing || [];
  const aMissing = awayObj.missingPlayers || awayObj.missing || [];

  for(const p of hPlayers) addPlayer(p, home, "Titolare");
  for(const p of aPlayers) addPlayer(p, away, "Titolare");
  for(const p of hSubs) addPlayer(p, home, "Panchina");
  for(const p of aSubs) addPlayer(p, away, "Panchina");
  for(const p of hMissing) addPlayer(p, home, "Fuori");
  for(const p of aMissing) addPlayer(p, away, "Fuori");

  // Some SofaScore structures use confirmedLineups + players arrays with substitute flag
  function walkLineupSide(obj, team){
    const arr = obj?.players || [];
    for(const item of arr){
      if(item.substitute || item.isSubstitute) addPlayer(item, team, "Panchina");
      else addPlayer(item, team, "Titolare");
    }
  }
  walkLineupSide(homeObj, home);
  walkLineupSide(awayObj, away);

  return result;
}

app.post("/api/sofascore-lineups", async (req, res) => {
  const {home, away, date, knownPlayers, eventId} = req.body || {};
  if(!home || !away) return res.json({ok:false,error:"Squadre mancanti",source:"SofaScore"});

  try{
    const id = eventId || await findSofascoreEventId(home, away, date);
    if(!id) return res.json({ok:false,error:"Event ID SofaScore non trovato",source:"SofaScore search"});

    const url = `https://www.sofascore.com/api/v1/event/${id}/lineups`;
    const data = await ssFetch(url);
    if(!data) return res.json({ok:false,error:"Endpoint lineups non disponibile",eventId:id,source:url});

    const players = parseSofascoreLineups(data, home, away, knownPlayers || []);
    const homeXI = players.filter(p=>p.team===home && p.status==="Titolare").length;
    const awayXI = players.filter(p=>p.team===away && p.status==="Titolare").length;

    if(homeXI < 8 || awayXI < 8){
      return res.json({
        ok:false,
        error:`Lineups non affidabili: ${homeXI}/${awayXI} titolari riconosciuti`,
        eventId:id,
        source:url,
        debug:{homeXI,awayXI,total:players.length, keys:Object.keys(data||{})}
      });
    }

    res.json({ok:true,eventId:id,source:url,players,counts:{homeXI,awayXI,total:players.length}});
  }catch(e){
    res.json({ok:false,error:e.message,source:"SofaScore"});
  }
});

app.listen(PORT, () => console.log("FG World Cup AI V5.7 lineups dynamic on " + PORT));
