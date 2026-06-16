
const KEY = "fg_wc_easy_v9_2_clean_engine";

let state = loadState();
let playerIndex = null;
let simCache = new Map();

const $ = (id) => document.getElementById(id);

function freshState() {
  const cloned = JSON.parse(JSON.stringify(window.SEED_DATA || { matches: [], players: [], groups: {} }));
  cloned.meta = cloned.meta || {};
  cloned.meta.version = "easy-v9-2-clean-engine";
  cloned.results = cloned.results || {};
  cloned.calibration = cloned.calibration || { homeFactor: 1, awayFactor: 1, drawBoost: 0, teams: {} };
  cloned.matches = cloned.matches || [];
  cloned.players = cloned.players || [];
  return cloned;
}

function loadState() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.meta?.version === "easy-v9-2-clean-engine") return parsed;
    }
  } catch (e) {}
  return freshState();
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function displayName(name) {
  return String(name || "").trim();
}

function teamName(t) {
  const map = {
    Turkiye: "Turkey",
    Czechia: "Czech Republic",
    DRC: "DR Congo",
    "Ivory Coast": "Cote d'Ivoire",
    "Cape Verde": "Cabo Verde",
    Bosnia: "Bosnia and Herzegovina",
    USA: "United States",
    Curacao: "Curacao"
  };
  return map[t] || t;
}

function matchTitle(m) {
  return `${teamName(m.home)} - ${teamName(m.away)}`;
}

function clamp(x, a, b) {
  return Math.max(a, Math.min(b, x));
}

function pct(p) {
  return `${Math.round((p || 0) * 100)}%`;
}

function fair(p) {
  return p > 0 ? (1 / p).toFixed(2) : "-";
}

function cls(v) {
  return v >= 82 ? "high" : v >= 68 ? "mid" : "low";
}

function pill(items) {
  return `<div>${items.map(p => `<span class="pill">${displayName(p.name || p)}${p.fantasyScore ? " · " + p.fantasyScore : p.role ? " · " + p.role : ""}</span>`).join(" ")}</div>`;
}

function rebuildIndexes() {
  const byTeam = new Map();
  const byTeamNormName = new Map();
  const teams = [];
  for (const p of state.players) {
    if (!byTeam.has(p.team)) {
      byTeam.set(p.team, []);
      byTeamNormName.set(p.team, new Map());
      teams.push(p.team);
    }
    byTeam.get(p.team).push(p);
    byTeamNormName.get(p.team).set(normalize(p.name), p);
  }
  playerIndex = { byTeam, byTeamNormName, teams };
}

function playersForTeam(team) {
  return playerIndex?.byTeam?.get(team) || [];
}

function playersForMatch(m) {
  return playersForTeam(m.home).concat(playersForTeam(m.away));
}

function activeForMatch(m, team) {
  if (m.matchLineups && m.matchLineups[team]) {
    return m.matchLineups[team]
      .map(name => findPlayer(team, name))
      .filter(Boolean);
  }
  return playersForTeam(team).filter(p => p.status === "Titolare");
}

function allActive(m) {
  return activeForMatch(m, m.home).concat(activeForMatch(m, m.away));
}

function findPlayer(team, name) {
  const key = normalize(name);
  const exact = playerIndex?.byTeamNormName?.get(team)?.get(key);
  if (exact) return exact;

  const list = playersForTeam(team);
  let byContains = list.find(p => normalize(p.name).includes(key) || key.includes(normalize(p.name)));
  if (byContains) return byContains;

  const tokens = key.match(/[a-z0-9]+/g) || [];
  return list.find(p => tokens.some(t => t.length >= 4 && normalize(p.name).includes(t))) || null;
}

function tm(team) {
  return state.teamMetrics?.[team] || { elo: 1650, fifa: 80, form: 65, gf: 1.25, ga: 1.25, cs: .25, btts: .5, squad: 68, cards: 1.8 };
}

function lineupSignature(m) {
  return [m.home, m.away].map(team => {
    return activeForMatch(m, team).map(p => `${p.name}:${p.valueM || 0}:${p.bonus || 0}`).sort().join("|");
  }).join("||");
}

function hash(str) {
  let h = 2166136261;
  for (const c of String(str)) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed) {
  return function () {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pois(lambda, rand) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

function teamPower(m, team) {
  const metrics = tm(team);
  const xi = activeForMatch(m, team);
  const avgValue = xi.length ? xi.reduce((s, p) => s + (p.valueM || 10), 0) / xi.length : 10;
  const avgBonus = xi.length ? xi.reduce((s, p) => s + (p.bonus || 60), 0) / xi.length : 60;
  const fifaInverse = 100 - Math.min(95, metrics.fifa || 80);
  return (metrics.elo || 1650) * .030 + fifaInverse * .20 + (metrics.form || 65) * .22 + (metrics.squad || 68) * .25 + avgValue * .12 + avgBonus * .12;
}

function expectedGoals(m) {
  const H = tm(m.home);
  const A = tm(m.away);
  const diff = (teamPower(m, m.home) - teamPower(m, m.away)) / 18;

  let lh = ((H.gf || 1.25) * .62 + (A.ga || 1.25) * .38) + diff * .45 + .08;
  let la = ((A.gf || 1.25) * .58 + (H.ga || 1.25) * .42) - diff * .40;

  const cal = state.calibration || {};
  lh *= cal.homeFactor || 1;
  la *= cal.awayFactor || 1;

  lh *= .88 + (H.form || 65) / 500 + (H.squad || 68) / 700;
  la *= .86 + (A.form || 65) / 520 + (A.squad || 68) / 720;

  return [clamp(lh, .25, 4.3), clamp(la, .18, 3.7)];
}

function mc(m, n = 7000) {
  if (!m || String(m.home || "").includes("Team ") || String(m.away || "").includes("Team ")) return null;
  const key = `${m.id}|${m.date}|${n}|${lineupSignature(m)}|${JSON.stringify(state.calibration || {})}`;
  if (simCache.has(key)) return simCache.get(key);

  const [lh, la] = expectedGoals(m);
  const rand = rng(hash(matchTitle(m) + m.date + lineupSignature(m)));

  let hw = 0, d = 0, aw = 0, o15 = 0, o25 = 0, u25 = 0, u45 = 0, btts = 0, hcs = 0, acs = 0;
  const exact = {}, ht = {};

  for (let i = 0; i < n; i++) {
    const hg = pois(lh, rand), ag = pois(la, rand), total = hg + ag;
    if (hg > ag) hw++; else if (hg === ag) d++; else aw++;
    if (total > 1.5) o15++;
    if (total > 2.5) o25++; else u25++;
    if (total < 4.5) u45++;
    if (hg > 0 && ag > 0) btts++;
    if (ag === 0) hcs++;
    if (hg === 0) acs++;
    exact[`${hg}-${ag}`] = (exact[`${hg}-${ag}`] || 0) + 1;

    const hh = pois(lh * .45, rand), ah = pois(la * .45, rand);
    ht[`${hh}-${ah}`] = (ht[`${hh}-${ah}`] || 0) + 1;
  }

  const top = obj => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([score, c]) => ({ score, prob: c / n }));
  const result = {
    lh, la,
    probs: {
      homeWin: hw / n, draw: d / n, awayWin: aw / n,
      over15: o15 / n, over25: o25 / n, under25: u25 / n, under45: u45 / n,
      btts: btts / n, homeCS: hcs / n, awayCS: acs / n
    },
    exactTop: top(exact),
    htTop: top(ht)
  };

  simCache.set(key, result);
  if (simCache.size > 300) simCache.delete(simCache.keys().next().value);
  return result;
}

function picks(m, s = mc(m)) {
  if (!s) return {};

  const candidates = {
    "1": s.probs.homeWin,
    "X": s.probs.draw,
    "2": s.probs.awayWin,
    "Over 1.5": s.probs.over15,
    "Over 2.5": s.probs.over25,
    "Under 2.5": s.probs.under25,
    "Under 4.5": s.probs.under45,
    "BTTS Sì": s.probs.btts
  };

  const arr = Object.entries(candidates).sort((a, b) => b[1] - a[1]);
  const safe = arr[0];
  const value = arr.find(x => x[1] >= .42 && x[1] <= .72) || arr[1] || arr[0];
  const crazy = s.exactTop.find(x => x.prob < .13) || s.exactTop[2] || s.exactTop[0];

  const fav = s.probs.homeWin >= s.probs.awayWin ? m.home : m.away;
  const comboP = Math.max(s.probs.homeWin, s.probs.awayWin) * Math.max(s.probs.over15, s.probs.under45);
  const risk = matchRisk(m, s);

  return {
    safe: { label: safe[0], prob: safe[1], fair: fair(safe[1]) },
    value: { label: value[0], prob: value[1], fair: fair(value[1]) },
    crazy: { label: `Risultato esatto ${crazy.score}`, prob: crazy.prob, fair: fair(crazy.prob) },
    combo: { label: `${teamName(fav)} DNB + ${s.probs.over15 > .70 ? "Over 1.5" : "Under 4.5"}`, prob: clamp(comboP, .05, .90), fair: fair(clamp(comboP, .05, .90)) },
    risk
  };
}

function matchRisk(m, s = mc(m)) {
  if (!s) return { label: "No data", score: 100, type: "avoid" };
  const margin = Math.abs(s.probs.homeWin - s.probs.awayWin);
  const drawRisk = s.probs.draw;
  const chaos = s.probs.btts + s.probs.over25;
  let score = Math.round(100 - (margin * 90) + (drawRisk * 30) + (chaos > 1.1 ? 8 : 0));
  score = clamp(score, 5, 95);
  let type = score > 68 ? "avoid" : score > 55 ? "lean" : "strong";
  let label = type === "strong" ? "Forte" : type === "lean" ? "Cautela" : "No play";
  return { label, score, type, margin, drawRisk, chaos };
}

function offensiveGoalScore(p, m, s = mc(m)) {
  if (!s) return 0;
  const teamXg = p.team === m.home ? s.lh : p.team === m.away ? s.la : 1;
  const roleBase = p.role === "ATT" ? 1.15 : p.role === "CEN" ? .78 : p.role === "DIF" ? .42 : .05;
  const personal = (p.goals || 0) * .015 + (p.bonus || 60) / 100 * .55 + (p.valueM || 10) / 120;
  const setPiece = p.setPieces ? .14 : 0;
  return clamp((teamXg * roleBase) + personal + setPiece, .02, 2.8);
}

function fantasyScore(p, m) {
  const s = mc(m);
  if (!s) return 0;

  // REGOLA FANTA DEFINITIVA:
  // PORTIERI: clean sheet.
  // DIF/CEN/ATT: solo potenziale gol/bonus offensivo, niente porta inviolata.
  if (p.role === "POR") {
    const cs = p.team === m.home ? s.probs.homeCS : p.team === m.away ? s.probs.awayCS : 0;
    const saveBase = (p.bonus || 60) / 100;
    return Math.round(100 * clamp(.35 + cs * .58 + saveBase * .18, .05, .99));
  }

  const goalScore = offensiveGoalScore(p, m, s);
  const base = (p.bonus || 60) / 100;
  const roleMult = p.role === "ATT" ? 1.00 : p.role === "CEN" ? .82 : p.role === "DIF" ? .58 : .70;
  return Math.round(100 * clamp(base * .42 + goalScore * .28 * roleMult, .05, .98));
}

function topBonus(m, limit = 5) {
  return allActive(m)
    .filter(p => p.role !== "POR")
    .map(p => ({ ...p, fantasyScore: fantasyScore(p, m), goalScore: offensiveGoalScore(p, m) }))
    .sort((a, b) => b.fantasyScore - a.fantasyScore)
    .slice(0, limit);
}

function topGoalCandidates(m, limit = 5) {
  return allActive(m)
    .filter(p => p.role !== "POR")
    .map(p => ({ ...p, fantasyScore: fantasyScore(p, m), goalScore: offensiveGoalScore(p, m) }))
    .sort((a, b) => b.goalScore - a.goalScore)
    .slice(0, limit);
}

function bestGK(m) {
  return allActive(m)
    .filter(p => p.role === "POR")
    .map(p => ({ ...p, fantasyScore: fantasyScore(p, m) }))
    .sort((a, b) => b.fantasyScore - a.fantasyScore)[0];
}

function firstYellow(m) {
  return allActive(m)
    .filter(p => p.role !== "POR")
    .sort((a, b) => (b.yellow || 0) - (a.yellow || 0))[0];
}

function firstSub(m) {
  return allActive(m)
    .filter(p => p.role !== "POR")
    .sort((a, b) => (b.sub || 0) - (a.sub || 0))[0];
}

function recalcMatch(m) {
  const s = mc(m);
  if (!s) {
    m.sim = null;
    return;
  }

  m.sim = s;
  m.aiPicks = picks(m, s);
  m.fg = Math.round(clamp(54 + m.aiPicks.safe.prob * 43 - (m.aiPicks.risk.score > 68 ? 8 : 0), 45, 98));
  m.pt = s.htTop[0]?.score || "-";
  m.ft = s.exactTop[0]?.score || "-";
  m.safe = `${m.aiPicks.safe.label} · fair ${m.aiPicks.safe.fair}`;
  m.value = `${m.aiPicks.value.label} · quota min ${m.aiPicks.value.fair}`;
  m.crazy = `${m.aiPicks.crazy.label} · fair ${m.aiPicks.crazy.fair}`;
  m.combo = `${m.aiPicks.combo.label} · fair ${m.aiPicks.combo.fair}`;
}

function recalc(matches = state.matches) {
  clearSimulationCache();
  (Array.isArray(matches) ? matches : [matches]).forEach(recalcMatch);
  save();
}

function filtered(base = state.matches) {
  const q = ($("search")?.value || "").toLowerCase();
  const stage = $("stageFilter")?.value || "";
  const group = $("groupFilter")?.value || "";
  return base.filter(m =>
    (!q || matchTitle(m).toLowerCase().includes(q)) &&
    (!stage || m.stage === stage) &&
    (!group || m.group === group)
  );
}

function matchCard(m) {
  const s = m.sim || mc(m);
  const b = topBonus(m, 3);
  const risk = m.aiPicks?.risk || matchRisk(m, s);
  const riskClass = risk.type === "strong" ? "safe" : risk.type === "lean" ? "combo" : "bad";
  return `<article class="card matchCard">
    <div class="cardHead">
      <div>
        <div class="matchTitle">${matchTitle(m)}</div>
        <div class="meta">#${m.id} · ${m.date} · ${m.stage} ${m.group || ""} · ${m.lineupStatus || "Rose locali"}</div>
      </div>
      <div class="score ${cls(m.fg)}">${m.fg || "TBD"}</div>
    </div>
    <div class="grid">
      <div class="item"><span>Pick</span><strong>${m.aiPicks?.safe ? `${m.aiPicks.safe.label} · ${pct(m.aiPicks.safe.prob)} · fair ${m.aiPicks.safe.fair}` : "-"}</strong></div>
      <div class="item"><span>Rischio</span><strong class="${riskClass}">${risk.label} · ${risk.score}/100</strong></div>
      <div class="item"><span>PT / FT</span><strong>${m.pt || "-"} → ${m.ft || "-"}</strong></div>
      <div class="item"><span>xG</span><strong>${s ? `${s.lh.toFixed(2)} - ${s.la.toFixed(2)}` : "-"}</strong></div>
      <div class="item full"><span>Top Fanta movimento</span>${pill(b)}</div>
    </div>
    <button class="ghost detailBtn" onclick="openDetail(${m.id})">Dettaglio</button>
  </article>`;
}

function moneyCard(m) {
  const s = m.sim || mc(m);
  const p = m.aiPicks || picks(m, s);
  const risk = p.risk || matchRisk(m, s);
  const tag = risk.type === "strong" ? "Forte" : risk.type === "lean" ? "Cautela" : "No play";
  return `<article class="card">
    <div class="cardHead">
      <div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">${m.date} · ${tag} · dati ${dataQuality(m)}/100</div></div>
      <div class="score ${cls(m.fg)}">${m.fg || "TBD"}</div>
    </div>
    <div class="grid">
      <div class="item"><span>Safe</span><strong class="safe">${p.safe?.label || "-"} · ${pct(p.safe?.prob)} · fair ${p.safe?.fair || "-"}</strong></div>
      <div class="item"><span>Value</span><strong class="value">${p.value?.label || "-"} · quota min ${p.value?.fair || "-"}</strong></div>
      <div class="item"><span>Combo</span><strong class="combo">${p.combo?.label || "-"} · fair ${p.combo?.fair || "-"}</strong></div>
      <div class="item"><span>Rischio</span><strong>${risk.label} · ${risk.score}/100</strong></div>
    </div>
    <button class="ghost" onclick="openDetail(${m.id})">Dettaglio</button>
  </article>`;
}

function dataQuality(m) {
  const h = playersForTeam(m.home).length;
  const a = playersForTeam(m.away).length;
  const xiH = activeForMatch(m, m.home).length;
  const xiA = activeForMatch(m, m.away).length;
  let q = 35;
  q += Math.min(20, h) + Math.min(20, a);
  q += xiH === 11 ? 12 : Math.min(10, xiH);
  q += xiA === 11 ? 12 : Math.min(10, xiA);
  if (m.matchLineups) q += 12;
  return Math.round(clamp(q, 0, 100));
}

function analysisCard(m) {
  const s = m.sim || mc(m);
  const risk = m.aiPicks?.risk || matchRisk(m, s);
  const margin = s ? Math.abs(s.probs.homeWin - s.probs.awayWin) : 0;
  const openGame = s ? s.probs.btts > .52 || s.probs.over25 > .48 : false;
  const trap = risk.type === "avoid" || (margin < .12 && m.aiPicks?.safe?.prob > .60);
  const mismatch = margin > .23;
  return `<article class="card">
    <div class="matchTitle">${matchTitle(m)}</div>
    <div class="signalRow">
      <span class="signal ${mismatch ? "playable" : "trap"}">${mismatch ? "Mismatch" : "Equilibrata"}</span>
      <span class="signal ${openGame ? "upset" : "playable"}">${openGame ? "Aperta" : "Controllata"}</span>
      <span class="signal ${trap ? "trap" : "playable"}">${trap ? "Trappola possibile" : "Pulita"}</span>
    </div>
    <div class="grid">
      <div class="item"><span>1X2</span><strong>1 ${pct(s?.probs.homeWin)} · X ${pct(s?.probs.draw)} · 2 ${pct(s?.probs.awayWin)}</strong></div>
      <div class="item"><span>Goal</span><strong>Over 2.5 ${pct(s?.probs.over25)} · BTTS ${pct(s?.probs.btts)}</strong></div>
      <div class="item full"><span>Lettura</span><strong>${risk.label}. Margine ${(margin * 100).toFixed(0)}%. ${openGame ? "Partita da gol/episodi." : "Partita più bloccata."}</strong></div>
    </div>
  </article>`;
}

function fantasyCard(m) {
  const b = topBonus(m, 5);
  const goals = topGoalCandidates(m, 5);
  const gk = bestGK(m);
  const y = firstYellow(m);
  const sub = firstSub(m);
  const s = m.sim || mc(m);
  return `<article class="card">
    <div class="cardHead">
      <div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">${m.date} · ${m.group || m.stage}</div></div>
      <div class="score ${cls(m.fg)}">${m.fg || "TBD"}</div>
    </div>
    <div class="grid">
      <div class="item"><span>Risultato primo tempo</span><strong>${m.pt || "-"}</strong></div>
      <div class="item"><span>Risultato finale</span><strong>${m.ft || "-"}</strong></div>
      <div class="item"><span>Capitano</span><strong>${b[0] ? displayName(b[0].name) : "-"}</strong></div>
      <div class="item"><span>Vice</span><strong>${b[1] ? displayName(b[1].name) : "-"}</strong></div>
      <div class="item full"><span>Top 5 movimento: solo gol/bonus offensivo</span>${pill(b)}</div>
      <div class="item full"><span>Top gol</span>${pill(goals)}</div>
      <div class="item"><span>Portiere Clean Sheet</span><strong>${gk ? `${displayName(gk.name)} · ${gk.fantasyScore}` : "-"}</strong></div>
      <div class="item"><span>Clean Sheet % solo portieri</span><strong>${s ? `${teamName(m.home)} ${pct(s.probs.homeCS)} · ${teamName(m.away)} ${pct(s.probs.awayCS)}` : "-"}</strong></div>
      <div class="item"><span>Primo ammonito</span><strong>${y ? `${displayName(y.name)} · rischio ${y.yellow}` : "-"}</strong></div>
      <div class="item"><span>Primo sostituito</span><strong>${sub ? `${displayName(sub.name)} · rischio ${sub.sub}` : "-"}</strong></div>
    </div>
  </article>`;
}

function renderDashboard() {
  const list = filtered().sort((a, b) => {
    const sort = $("dashboardSort")?.value || "rating";
    return sort === "date" ? String(a.date).localeCompare(String(b.date)) : (b.fg || 0) - (a.fg || 0);
  });

  $("allCards").innerHTML = list.map(matchCard).join("");
  $("kpiVisible").textContent = list.length;
  $("kpiPlayers").textContent = state.players.length;

  const best = [...list].filter(m => m.aiPicks?.safe).sort((a, b) => b.aiPicks.safe.prob - a.aiPicks.safe.prob)[0];
  $("kpiSafe").textContent = best ? `${matchTitle(best)}: ${best.aiPicks.safe.label}` : "-";

  const all = [];
  list.forEach(m => topBonus(m, 2).forEach(p => all.push({ ...p, match: matchTitle(m) })));
  all.sort((a, b) => b.fantasyScore - a.fantasyScore);
  $("kpiBonus").textContent = all[0] ? `${displayName(all[0].name)} ${all[0].fantasyScore}` : "-";
}

function moneyFiltered() {
  const q = ($("moneySearch")?.value || "").toLowerCase();
  const filter = $("moneyFilter")?.value || "open";
  let list = state.matches.filter(m => !q || matchTitle(m).toLowerCase().includes(q));

  if (filter === "strong") list = list.filter(m => m.aiPicks?.risk?.type === "strong");
  if (filter === "lean") list = list.filter(m => m.aiPicks?.risk?.type === "lean");
  if (filter === "avoid") list = list.filter(m => m.aiPicks?.risk?.type === "avoid");
  if (filter === "value") list = list.filter(m => Number(m.aiPicks?.value?.prob || 0) >= .42);
  if (filter === "played") list = list.filter(m => m.played);
  if (filter === "open") list = list.filter(m => !m.played && m.aiPicks?.risk?.type !== "avoid");

  const sort = $("moneySort")?.value || "score";
  list.sort((a, b) => {
    if (sort === "date") return String(a.date).localeCompare(String(b.date));
    if (sort === "risk") return (a.aiPicks?.risk?.score || 100) - (b.aiPicks?.risk?.score || 100);
    if (sort === "data") return dataQuality(b) - dataQuality(a);
    if (sort === "edge") return (b.aiPicks?.value?.prob || 0) - (a.aiPicks?.value?.prob || 0);
    return (b.fg || 0) - (a.fg || 0);
  });
  return list;
}

function renderMoney() {
  const list = moneyFiltered();
  $("moneyCards").innerHTML = list.map(moneyCard).join("");
  const strong = state.matches.filter(m => m.aiPicks?.risk?.type === "strong").length;
  const lean = state.matches.filter(m => m.aiPicks?.risk?.type === "lean").length;
  const avoid = state.matches.filter(m => m.aiPicks?.risk?.type === "avoid").length;
  const value = state.matches.filter(m => Number(m.aiPicks?.value?.prob || 0) >= .42).length;
  const dq = state.matches.length ? Math.round(state.matches.reduce((s, m) => s + dataQuality(m), 0) / state.matches.length) : 0;
  if ($("moneyStrong")) $("moneyStrong").textContent = strong;
  if ($("moneyValue")) $("moneyValue").textContent = value;
  if ($("moneyLean")) $("moneyLean").textContent = lean;
  if ($("moneyAvoid")) $("moneyAvoid").textContent = avoid;
  if ($("moneyData")) $("moneyData").textContent = dq + "/100";
}

function renderFantasy() {
  $("fantasyCards").innerHTML = state.matches.filter(m => !String(m.home).includes("Team ")).map(fantasyCard).join("");
}

function renderAnalysis() {
  const q = ($("analysisSearch")?.value || "").toLowerCase();
  const f = $("analysisFilter")?.value || "";
  let list = state.matches.filter(m => !q || matchTitle(m).toLowerCase().includes(q));
  list = list.filter(m => {
    const s = m.sim || mc(m);
    const risk = m.aiPicks?.risk || matchRisk(m, s);
    const margin = s ? Math.abs(s.probs.homeWin - s.probs.awayWin) : 0;
    const openGame = s ? s.probs.btts > .52 || s.probs.over25 > .48 : false;
    if (!f) return true;
    if (f === "strong") return risk.type === "strong";
    if (f === "trap") return risk.type === "lean" || risk.type === "avoid";
    if (f === "chaos") return openGame;
    if (f === "avoid") return risk.type === "avoid";
    if (f === "mismatch") return margin > .23;
    return true;
  });

  $("analysisCards").innerHTML = list.map(analysisCard).join("");

  const all = state.matches.map(m => ({ m, s: m.sim || mc(m), risk: m.aiPicks?.risk || matchRisk(m, m.sim || mc(m)) }));
  if ($("easyStrong")) $("easyStrong").textContent = all.filter(x => x.risk.type === "strong").length;
  if ($("easyTrap")) $("easyTrap").textContent = all.filter(x => x.risk.type === "lean").length;
  if ($("easyChaos")) $("easyChaos").textContent = all.filter(x => x.s && (x.s.probs.btts > .52 || x.s.probs.over25 > .48)).length;
  if ($("easyAvoid")) $("easyAvoid").textContent = all.filter(x => x.risk.type === "avoid").length;
}

function renderManage() {
  const qSquad = ($("squadSearch")?.value || "").toLowerCase();
  const qLineup = ($("lineupSearch")?.value || "").toLowerCase();

  const teams = playerIndex.teams
    .filter(t => !qSquad || teamName(t).toLowerCase().includes(qSquad) || playersForTeam(t).some(p => displayName(p.name).toLowerCase().includes(qSquad)))
    .slice(0, 24);

  const teamCards = teams.map(t => {
    const ps = playersForTeam(t).filter(p => !qSquad || teamName(t).toLowerCase().includes(qSquad) || displayName(p.name).toLowerCase().includes(qSquad));
    return `<article class="card"><h3>${teamName(t)}</h3><p>${ps.length} giocatori · XI base: ${playersForTeam(t).filter(p => p.status === "Titolare").length}</p>${ps.slice(0, 26).map(p => `<span class="pill">${displayName(p.name)} · ${p.role} · ${p.status}</span>`).join(" ")}</article>`;
  });

  const lineupCards = state.matches
    .filter(m => !qLineup || matchTitle(m).toLowerCase().includes(qLineup))
    .slice(0, 16)
    .map(m => `<article class="card"><div class="matchTitle">${matchTitle(m)}</div><p>${m.lineupStatus || "XI base"} · ${m.source || "-"}</p><button class="ghost" onclick="openLineups(${m.id})">Apri formazioni</button></article>`);

  $("manageCards").innerHTML = teamCards.concat(lineupCards).join("");
}

function splitManualNames(raw) {
  return String(raw || "").split(/\n|,|;|\|/).map(x => x.trim()).filter(x => x.length >= 2);
}

function renderManualXI() {
  const el = $("manualXiCards");
  if (!el) return;
  el.innerHTML = state.matches.filter(m => !String(m.home).includes("Team ")).slice(0, 72).map(m => {
    const homeNames = m.matchLineups?.[m.home]?.join("\n") || activeForMatch(m, m.home).map(p => p.name).join("\n");
    const awayNames = m.matchLineups?.[m.away]?.join("\n") || activeForMatch(m, m.away).map(p => p.name).join("\n");
    return `<article class="card">
      <div class="cardHead">
        <div><div class="matchTitle">${matchTitle(m)}</div><div class="meta">${m.date} · ${m.lineupStatus || "XI base"}</div></div>
        <div class="score ${cls(m.fg)}">${m.fg || "TBD"}</div>
      </div>
      <div class="grid">
        <div class="item full"><span>${teamName(m.home)} - 11 titolari ufficiali</span><textarea id="homeXI_${m.id}" placeholder="Scrivi 11 nomi, uno per riga">${homeNames}</textarea></div>
        <div class="item full"><span>${teamName(m.away)} - 11 titolari ufficiali</span><textarea id="awayXI_${m.id}" placeholder="Scrivi 11 nomi, uno per riga">${awayNames}</textarea></div>
        <div class="item full"><span>Fonte attiva</span><strong>${m.matchLineups ? "XI ufficiale manuale" : "XI base/probabile"}</strong></div>
      </div>
      <button onclick="applyManualXI(${m.id})">Applica XI ufficiale</button>
      <button class="ghost" onclick="clearManualXI(${m.id})">Reset XI partita</button>
    </article>`;
  }).join("");
}

function applyManualXI(id) {
  const m = state.matches.find(x => x.id === id);
  if (!m) return;

  const homeRaw = splitManualNames($(`homeXI_${id}`)?.value);
  const awayRaw = splitManualNames($(`awayXI_${id}`)?.value);

  const homeMatched = [], awayMatched = [], homeMiss = [], awayMiss = [];

  for (const name of homeRaw) {
    const p = findPlayer(m.home, name);
    if (p && !homeMatched.includes(p)) homeMatched.push(p);
    else homeMiss.push(name);
  }
  for (const name of awayRaw) {
    const p = findPlayer(m.away, name);
    if (p && !awayMatched.includes(p)) awayMatched.push(p);
    else awayMiss.push(name);
  }

  if (homeMatched.length !== 11 || awayMatched.length !== 11) {
    alert(`Servono esattamente 11 riconosciuti per squadra.\n${teamName(m.home)}: ${homeMatched.length}/11. Non riconosciuti: ${homeMiss.join(", ") || "-"}\n${teamName(m.away)}: ${awayMatched.length}/11. Non riconosciuti: ${awayMiss.join(", ") || "-"}`);
    return;
  }

  m.matchLineups = {
    [m.home]: homeMatched.map(p => p.name),
    [m.away]: awayMatched.map(p => p.name)
  };
  m.lineupStatus = "XI ufficiale manuale";
  m.source = "XI ufficiale manuale";
  m.lastAutoUpdate = new Date().toLocaleString();

  recalc(m);
  render();
  alert("XI ufficiale manuale applicato. Il resto non figura nel modello della partita.");
}

function clearManualXI(id) {
  const m = state.matches.find(x => x.id === id);
  if (!m) return;
  delete m.matchLineups;
  m.lineupStatus = "XI base/probabile";
  m.source = "Database locale";
  recalc(m);
  render();
}

function openLineups(id) {
  const m = state.matches.find(x => x.id === id);
  if (!m) return;
  const block = team => {
    const xi = activeForMatch(m, team);
    return `<h3>${teamName(team)}</h3><p>${m.matchLineups ? "XI ufficiale manuale: gli altri non figurano nel modello." : "XI base/probabile."}</p>${xi.map(p => `<p><b>${displayName(p.name)}</b> · ${p.role} · ${p.club || ""}</p>`).join("")}`;
  };
  $("modalContent").innerHTML = `<h2>${matchTitle(m)}</h2>${block(m.home)}${block(m.away)}`;
  $("modal").hidden = false;
}

function openDetail(id) {
  const m = state.matches.find(x => x.id === id);
  if (!m) return;
  const s = m.sim || mc(m);
  const b = topBonus(m, 5);
  const gk = bestGK(m);
  $("modalContent").innerHTML = `<h2>${matchTitle(m)}</h2>
    <div class="grid">
      <div class="item"><span>1X2</span><strong>1 ${pct(s?.probs.homeWin)} · X ${pct(s?.probs.draw)} · 2 ${pct(s?.probs.awayWin)}</strong></div>
      <div class="item"><span>xG</span><strong>${s ? `${s.lh.toFixed(2)} - ${s.la.toFixed(2)}` : "-"}</strong></div>
      <div class="item"><span>Safe</span><strong>${m.aiPicks?.safe?.label || "-"} · ${pct(m.aiPicks?.safe?.prob)}</strong></div>
      <div class="item"><span>Rischio</span><strong>${m.aiPicks?.risk?.label || "-"} · ${m.aiPicks?.risk?.score || "-"}/100</strong></div>
      <div class="item full"><span>Top Fanta movimento</span>${pill(b)}</div>
      <div class="item"><span>Portiere Clean Sheet</span><strong>${gk ? `${displayName(gk.name)} · ${gk.fantasyScore}` : "-"}</strong></div>
      <div class="item full"><span>Nota Fanta</span><strong>Clean sheet solo portieri. Movimento: gol/bonus offensivo.</strong></div>
    </div>`;
  $("modal").hidden = false;
}

async function importOfficial() {
  const log = $("importLog");
  if (log) log.textContent = "Caricamento rose locali...";
  try {
    const res = await fetch("/api/import-official-squads");
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Errore import");
    state.players = json.players;
    rebuildIndexes();
    recalc();
    if (log) log.textContent = `Rose locali caricate: ${json.players.length} giocatori, ${json.teams} squadre.`;
    render();
  } catch (e) {
    if (log) log.textContent = "Errore: " + e.message;
  }
}

function resetState() {
  localStorage.removeItem(KEY);
  state = freshState();
  rebuildIndexes();
  recalc();
  render();
}

function exportState() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "fg-worldcup-state-v9-2.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importStateFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      state = parsed;
      state.meta = state.meta || {};
      state.meta.version = "easy-v9-2-clean-engine";
      rebuildIndexes();
      recalc();
      render();
      if ($("importLog")) $("importLog").textContent = "Dati importati.";
    } catch (e) {
      alert("File non valido: " + e.message);
    }
  };
  reader.readAsText(file);
}

function renderPrecision() {
  if (!$("precisionCards")) return;
  const results = Object.values(state.results || {});
  if ($("btCount")) $("btCount").textContent = results.length;
  if ($("btAccuracy")) $("btAccuracy").textContent = results.length ? "Da calibrare" : "-";
  if ($("btBrier")) $("btBrier").textContent = "-";
  if ($("btGoalMae")) $("btGoalMae").textContent = "-";
  if ($("calHome")) $("calHome").textContent = (state.calibration?.homeFactor || 1).toFixed(2);
  if ($("calAway")) $("calAway").textContent = (state.calibration?.awayFactor || 1).toFixed(2);
  if ($("calDraw")) $("calDraw").textContent = Math.round((state.calibration?.drawBoost || 0) * 100) + "%";
  if ($("calTeams")) $("calTeams").textContent = Object.keys(state.calibration?.teams || {}).length;
  $("precisionCards").innerHTML = `<article class="card"><p>Modulo precisione pulito: pronto per risultati reali. La calibrazione verrà aggiornata quando registreremo abbastanza partite concluse.</p></article>`;
}

function render() {
  const tab = document.querySelector(".tab.active")?.dataset.tab || "dashboard";
  rebuildIndexes();

  if (tab === "dashboard") renderDashboard();
  if (tab === "money") renderMoney();
  if (tab === "fantasy") renderFantasy();
  if (tab === "analysis") renderAnalysis();
  if (tab === "manage") {
    renderManage();
    renderManualXI();
    renderPrecision();
  }
}

function fillFilters() {
  const stages = [...new Set(state.matches.map(m => m.stage).filter(Boolean))];
  const groups = [...new Set(state.matches.map(m => m.group).filter(Boolean))];

  if ($("stageFilter") && $("stageFilter").children.length <= 1) {
    stages.forEach(s => $("stageFilter").insertAdjacentHTML("beforeend", `<option value="${s}">${s}</option>`));
  }
  if ($("groupFilter") && $("groupFilter").children.length <= 1) {
    groups.forEach(g => $("groupFilter").insertAdjacentHTML("beforeend", `<option value="${g}">${g}</option>`));
  }
}

function init() {
  rebuildIndexes();
  recalc();
  fillFilters();

  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
      btn.classList.add("active");
      const target = $(btn.dataset.tab);
      if (target) target.classList.add("active");
      render();
    };
  });

  ["search", "stageFilter", "groupFilter", "dashboardSort", "moneySearch", "moneyFilter", "moneySort", "analysisSearch", "analysisFilter", "squadSearch", "lineupSearch"].forEach(id => {
    if ($(id)) $(id).oninput = render;
    if ($(id)) $(id).onchange = render;
  });

  if ($("importOfficial")) $("importOfficial").onclick = importOfficial;
  if ($("resetBtn")) $("resetBtn").onclick = resetState;
  if ($("exportStateBtn")) $("exportStateBtn").onclick = exportState;
  if ($("importStateBtn")) $("importStateBtn").onclick = () => $("importStateFile")?.click();
  if ($("importStateFile")) $("importStateFile").onchange = e => {
    const file = e.target.files?.[0];
    if (file) importStateFile(file);
  };
  if ($("loadManualXi")) $("loadManualXi").onclick = renderManualXI;
  if ($("closeModal")) $("closeModal").onclick = () => $("modal").hidden = true;
  if ($("calibrateBtn")) $("calibrateBtn").onclick = () => alert("Calibrazione disponibile dopo inserimento risultati reali.");
  if ($("resetCalibrationBtn")) $("resetCalibrationBtn").onclick = () => {
    state.calibration = { homeFactor: 1, awayFactor: 1, drawBoost: 0, teams: {} };
    recalc();
    render();
  };

  render();
}

init();
