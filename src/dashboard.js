import { slugify } from "./slug.js";

const SCENE_TITLES = {
  momentum: "Momentum",
  flow: "Flow & Trend",
  race: "The Race",
  backlogHealth: "Backlog Health",
  spotlight: "Spotlight",
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sceneId(i) {
  let n = i + 1, s = "";
  while (n > 0) {
    n--;
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

export function renderDashboard(config) {
  const scenes = config.scenes.map((s, i) => ({
    id: sceneId(i),
    type: s.type,
    name: s.type === "spotlight" ? (s.name || "Spotlight") : SCENE_TITLES[s.type] || s.type,
    ...(s.type === "spotlight"
      ? { slug: slugify(s.name), sprints: Boolean(s.sprints), bugs: Boolean(s.bugs) }
      : {}),
  }));

  const cfg = JSON.stringify({ ...config, scenes: config.scenes, derivedScenes: scenes })
    .replace(/</g, "\\u003c");
  const sceneSections = scenes
    .map(s => '<section id="scene-' + s.id + '" class="scene sc-' + s.type + '"></section>')
    .join("\n    ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(config.brand.name)} · ${escapeHtml(config.brand.sub)}</title>
<style>
  :root {
    --bg:#000; --surface:#141518; --border:#33363b; --sep:#585858;
    --text:#f8fafc; --muted:#8a8f98; --faint:#5b6672;
    --accent:#22c55e; --info:#5b8def; --good:#22c55e; --warn:#e3a008; --danger:#ef4444;
    --track:#26282c;
    --sans:'Helvetica Neue', Helvetica, Arial, sans-serif;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { height:100%; }
  body {
    background:var(--bg); color:var(--text); font-family:var(--sans);
    height:100vh; width:100vw; overflow:hidden; display:flex; flex-direction:column;
    -webkit-font-smoothing:antialiased;
  }

  /* ── Masthead (departures board) ── */
  .masthead {
    flex:0 0 auto; display:flex; align-items:center; justify-content:space-between;
    padding:1rem 1.6rem; border-bottom:2px solid var(--sep); background:#000;
  }
  .brand { display:flex; flex-direction:column; gap:0.3rem; }
  .wordmark { font-size:clamp(1.3rem,2vw,2rem); font-weight:700; letter-spacing:0.02em; display:flex; align-items:center; gap:0.55rem; }
  .wordmark .diamond { color:var(--accent); font-size:0.8em; }
  .brand-sub { font-size:0.72rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.18em; }
  .demo-chip { display:inline-block; background:var(--danger); color:#fff; font-weight:700; font-size:0.95rem; padding:0.3em 0.7em; border-radius:4px; text-transform:uppercase; letter-spacing:0.12em; margin-top:0.35rem; align-self:flex-start; animation:demo-pulse 1.6s ease-in-out infinite; }
  @keyframes demo-pulse { 0%,100% { opacity:1; } 50% { opacity:0.55; } }
  .clock { display:flex; flex-direction:column; align-items:flex-end; gap:0.35rem; }
  .clock-date { font-size:0.72rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:0.18em; }

  /* ── Split-flap tiles ── */
  .flaps { display:inline-flex; gap:3px; }
  .flap-char {
    position:relative; min-width:0.86em; padding:0.2em 0.13em; text-align:center;
    font-weight:700; font-variant-numeric:tabular-nums; color:var(--text);
    background:linear-gradient(to bottom,#2b2d31 0 calc(50% - 0.5px),#0c0d0f calc(50% + 0.5px) 100%);
    border-radius:4px; box-shadow:0 1px 2px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05);
  }
  .flap-char::after { content:""; position:absolute; left:0; right:0; top:50%; height:1px; background:#000; transform:translateY(-0.5px); }
  .flap-sign { min-width:0.6em; }
  .flap-sep { align-self:center; padding:0 0.04em; font-weight:700; color:var(--muted); }
  .flap-gap { width:0.28em; }
  .flaps.good .flap-char, .flaps.accent .flap-char, .flaps.good .flap-sep, .flaps.accent .flap-sep { color:var(--accent); }
  .flaps.info .flap-char, .flaps.info .flap-sep { color:var(--info); }
  .flaps.warn .flap-char, .flaps.warn .flap-sep { color:var(--warn); }
  .flaps.danger .flap-char, .flaps.danger .flap-sep { color:var(--danger); }
  .clock-flaps .flap-char { font-size:clamp(1.2rem,1.7vw,1.7rem); }
  .clock-flaps .flap-sep { font-size:clamp(1.2rem,1.7vw,1.7rem); }

  /* ── Stage / scenes ── */
  .stage { position:relative; flex:1 1 auto; min-height:0; cursor:pointer; }
  .progress { position:absolute; left:0; top:0; height:2px; background:var(--accent); width:0; z-index:5; }
  .scene { position:absolute; inset:0; opacity:0; transition:opacity .55s ease; pointer-events:none; padding:1.4rem 1.6rem; gap:1rem; }
  .scene.active { opacity:1; pointer-events:auto; }

  .card { background:var(--surface); border:1px solid var(--border); border-radius:0.6rem; padding:clamp(12px,1.3vw,22px); display:flex; flex-direction:column; min-height:0; }
  .ptitle { font-size:clamp(11px,.8vw,13px); text-transform:uppercase; letter-spacing:.18em; color:var(--muted); font-weight:700; margin:0 0 0.7rem; }

  .l { color:var(--muted); font-size:clamp(11px,.85vw,14px); text-transform:uppercase; letter-spacing:.12em; font-weight:700; margin-top:0.7rem; }
  .s { color:var(--faint); font-size:clamp(11px,.8vw,13px); margin-top:0.35rem; min-height:14px; text-transform:uppercase; letter-spacing:.06em; }
  .t-good{color:var(--good)} .t-danger{color:var(--danger)} .t-faint{color:var(--faint)}

  /* ring */
  .ring { position:relative; width:clamp(150px,15vw,240px); height:clamp(150px,15vw,240px); flex:0 0 auto; }
  .ring .mid { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; }
  .ring .mid .n { font-size:clamp(40px,5vw,84px); font-weight:800; line-height:1; font-variant-numeric:tabular-nums; }
  .ring .mid .n.n-sm { font-size:clamp(30px,3.7vw,62px); }
  .ring .mid .n .u { font-size:0.42em; font-weight:700; margin-left:0.05em; }
  .ring .mid .of { color:var(--muted); font-size:clamp(9px,.75vw,13px); margin-top:5px; text-transform:uppercase; letter-spacing:.1em; text-align:center; max-width:68%; }

  /* flow chart */
  .flow { display:flex; align-items:flex-end; gap:clamp(10px,1.4vw,28px); flex:1; min-height:0; padding-top:6px; }
  .flow .col { flex:1; display:flex; flex-direction:column; align-items:center; gap:6px; height:100%; justify-content:flex-end; }
  .flow .bars { display:flex; align-items:flex-end; gap:6px; height:100%; width:100%; justify-content:center; }
  .flow .bar { width:28%; max-width:34px; border-radius:3px 3px 0 0; min-height:2px; }
  .flow .bar.created { background:var(--info); } .flow .bar.completed { background:var(--accent); }
  .flow .wk { color:var(--faint); font-size:clamp(10px,.8vw,12px); white-space:nowrap; text-transform:uppercase; letter-spacing:.08em; }
  .legend { display:flex; gap:18px; color:var(--muted); font-size:12px; margin-top:8px; text-transform:uppercase; letter-spacing:.1em; }
  .legend i { display:inline-block; width:10px; height:10px; border-radius:2px; margin-right:6px; vertical-align:-1px; }

  /* rows (race + aging) */
  .rows { display:flex; flex-direction:column; justify-content:center; flex:1; min-height:0; overflow:hidden; }
  .row { display:grid; align-items:center; gap:clamp(10px,1.2vw,20px); padding:clamp(4px,.7vh,11px) 0; }
  .row.team { grid-template-columns:1fr auto; }
  .row.bucket { grid-template-columns:7.5em 1fr auto; }
  .row + .row { border-top:1px solid var(--border); }
  .row .mid { display:flex; align-items:center; gap:0.9rem; min-width:0; }
  .row .mid > .stack { min-width:0; flex:1; }
  .row .name { font-weight:700; font-size:clamp(15px,1.4vw,22px); text-transform:uppercase; letter-spacing:.02em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .row .area, .row .cap { color:var(--faint); font-size:clamp(10px,.78vw,12px); text-transform:uppercase; letter-spacing:.1em; margin-top:2px; }
  .row .track { background:var(--track); border-radius:5px; height:clamp(9px,1.2vh,14px); overflow:hidden; margin-top:6px; }
  .row .fill { height:100%; border-radius:5px; background:var(--accent); }
  .row .fill.warn { background:var(--warn); } .row .fill.danger { background:var(--danger); }
  .row .nums { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; font-size:clamp(12px,1vw,16px); color:var(--muted); text-transform:uppercase; letter-spacing:.06em; }
  .row .nums b { color:var(--text); font-size:clamp(19px,1.7vw,28px); }

  /* MTA line bullet */
  .bullet { flex-shrink:0; width:2.1rem; height:2.1rem; border-radius:50%; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.05rem; color:#fff; }

  /* Momentum scene */
  .sc-momentum { display:grid; grid-template-columns:1.1fr 1fr; }
  .hero { flex-direction:row; align-items:center; gap:clamp(16px,2vw,44px); }
  .hero .say .k { color:var(--muted); text-transform:uppercase; letter-spacing:.16em; font-size:clamp(11px,.95vw,15px); font-weight:700; }
  .hero .say .big { display:flex; align-items:baseline; gap:0.5rem; margin-top:0.6rem; flex-wrap:wrap; }
  .hero .say .big .flap-char { font-size:clamp(22px,2.6vw,42px); }
  .hero .say .unit { color:var(--muted); text-transform:uppercase; letter-spacing:.1em; font-size:clamp(12px,1.1vw,17px); font-weight:700; }
  .hero .say .delta { font-size:clamp(14px,1.3vw,20px); margin-top:0.85rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em; }
  .hero .say .mom { font-size:clamp(12px,1vw,16px); margin-top:0.4rem; color:var(--muted); text-transform:uppercase; letter-spacing:.08em; }
  .chips { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  .chip { background:var(--surface); border:1px solid var(--border); border-radius:0.6rem; padding:clamp(10px,1.1vw,18px); display:flex; flex-direction:column; justify-content:center; }
  .chip .flap-char { font-size:clamp(26px,3.2vw,52px); }

  /* Flow scene */
  .sc-flow { display:grid; grid-template-rows:auto 1fr; }
  .sc-flow .top { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
  .sc-flow .top .flap-char { font-size:clamp(28px,3.4vw,56px); }

  /* Race scene */
  .sc-race { display:grid; grid-template-rows:auto 1fr auto; }
  .tow { flex-direction:row; align-items:center; gap:0.9rem; }
  .tow .lbl { color:var(--muted); text-transform:uppercase; letter-spacing:.18em; font-size:clamp(11px,.95vw,15px); font-weight:700; }
  .tow .big { font-size:clamp(20px,2.4vw,36px); font-weight:800; text-transform:uppercase; letter-spacing:.02em; }
  .tow .flap-char { font-size:clamp(22px,2.6vw,40px); }
  .tow .racepage { margin-left:auto; color:var(--faint); font-size:clamp(10px,.85vw,13px); text-transform:uppercase; letter-spacing:.12em; }
  .totbar { flex-direction:row; align-items:center; justify-content:center; gap:0.8rem; }
  .totbar .flap-char { font-size:clamp(18px,2vw,32px); }
  .totbar .l { margin:0; }

  /* Backlog health scene */
  .sc-backlogHealth { display:grid; grid-template-rows:1fr 1fr; }
  .sc-backlogHealth .top3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:1rem; }
  .sc-backlogHealth .top3 .flap-char { font-size:clamp(30px,4vw,66px); }
  .sc-backlogHealth .stat { display:flex; flex-direction:column; justify-content:center; }

  /* Spotlight scene */
  .sc-spotlight { display:grid; grid-template-columns:1.1fr 1fr; }
  .sc-spotlight .chips { grid-template-columns:1fr 1fr; }
  .sc-spotlight .hero .say .k { font-size:clamp(11px,.95vw,15px); }
  .sc-spotlight .hero .say .big .flap-char { font-size:clamp(22px,2.4vw,38px); }

  /* Footer bar */
  .footer-bar {
    flex:0 0 auto; display:flex; align-items:center; justify-content:space-between;
    padding:0.7rem 1.6rem; border-top:1px solid var(--sep); background:#000;
    font-size:0.7rem; font-weight:600; color:var(--muted); text-transform:uppercase; letter-spacing:.16em;
  }
  .foot-right { display:inline-flex; align-items:center; gap:1rem; }
  .dots { display:inline-flex; gap:7px; }
  .dots span { width:9px; height:9px; border-radius:50%; background:var(--border); cursor:pointer; }
  .dots span.on { background:var(--accent); }
  .footer-bar button { background:transparent; color:var(--muted); border:1px solid var(--border); border-radius:5px; padding:5px 11px; font-family:var(--sans); font-size:0.66rem; font-weight:700; letter-spacing:.14em; text-transform:uppercase; cursor:pointer; }
  .footer-bar button:hover { border-color:var(--accent); color:var(--accent); }
</style>
</head>
<body>
  <div class="masthead">
    <div class="brand">
      <span class="wordmark">${config.brand.glyph ? '<span class="diamond">' + escapeHtml(config.brand.glyph) + '</span>' : ''}${escapeHtml(config.brand.name)}</span>
      <span class="brand-sub" id="brandSub">${escapeHtml(config.brand.sub)}</span>
      <span class="demo-chip" id="demoChip" style="display:none">DEMO DATA</span>
    </div>
    <div class="clock">
      <span class="flaps clock-flaps" id="clock"></span>
      <span class="clock-date" id="clockdate">&nbsp;</span>
    </div>
  </div>

  <div class="stage" id="stage">
    <div class="progress" id="prog"></div>
    ${sceneSections}
  </div>

  <div class="footer-bar">
    <span>${escapeHtml(config.brand.footer)}</span>
    <span class="foot-right">
      <span id="status">Loading…</span>
      <span class="dots" id="dots"></span>
      <button id="refresh">Refresh</button>
    </span>
  </div>

<script>
  var CFG = ${cfg};

  var WEEKLY_GOAL = CFG.goals.weeklyShipped;
  var ROTATE_MS = CFG.display.rotateMs;
  var POLL_MS = CFG.display.pollMs;
  var RACE_PAGE_SIZE = CFG.display.racePageSize;
  var FLOW_WEEKS = CFG.display.flowWeeks;
  var LINE = CFG.areaColors;
  var LINE_DARK_TEXT = {};
  (CFG.darkTextAreas || []).forEach(function(a){ LINE_DARK_TEXT[a] = true; });

  var SCENES = CFG.derivedScenes;
  var qp = new URLSearchParams(location.search);
  var ROTATE = qp.get("rotate") !== "0";

  var idIdx = {}, slugIdx = {};
  SCENES.forEach(function(s, i){ idIdx[s.id] = i; if (s.slug) slugIdx[s.slug] = i; });
  var sceneIdx = 0;
  (function(){
    var raw = qp.get("scene");
    if (!raw) return;
    if (idIdx[raw] !== undefined) { sceneIdx = idIdx[raw]; return; }
    if (slugIdx[raw] !== undefined) { sceneIdx = slugIdx[raw]; return; }
    var n = parseInt(raw, 10);
    if (n >= 0 && n < SCENES.length) sceneIdx = n;
  })();

  var lastGeneratedAt = null;
  var racePages = [], racePageIdx = 0, raceMax = 1, raceTeamCount = 0, racePager = null;

  function fmt(n){ return (n === null || n === undefined) ? "—" : Number(n).toLocaleString(); }
  function num(n){ return (typeof n === "number") ? n : null; }
  function signed(n){ return n > 0 ? "+" + n : String(n); }
  function pad(n){ return String(n).padStart(2,"0"); }
  function sumKeys(v, keys, suffix){
    var any = false, total = 0;
    keys.forEach(function(k){ var x = v["team_" + k + suffix]; if (typeof x === "number"){ total += x; any = true; } });
    return any ? total : null;
  }
  function el(tag, attrs, kids){
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs){
      if (k === "class") e.className = attrs[k];
      else if (k === "text") e.textContent = attrs[k];
      else if (k === "html") e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    if (kids){ if (!Array.isArray(kids)) kids = [kids];
      for (var i=0;i<kids.length;i++){ var c=kids[i]; if(c==null) continue;
        e.appendChild(typeof c === "string" ? document.createTextNode(c) : c); } }
    return e;
  }
  function fill(id, kids){ var e = document.getElementById(id); e.innerHTML = ""; (Array.isArray(kids)?kids:[kids]).forEach(function(c){ if(c!=null) e.appendChild(c); }); return e; }

  function flapHTML(str){
    var s = String(str), h = "";
    for (var i=0;i<s.length;i++){
      var c = s[i];
      if (c === " ") h += '<span class="flap-gap"></span>';
      else if (c === "+" || c === "-") h += '<span class="flap-char flap-sign">' + c + '</span>';
      else if ("%:.,".indexOf(c) > -1) h += '<span class="flap-sep">' + c + '</span>';
      else h += '<span class="flap-char">' + c + '</span>';
    }
    return h;
  }
  function flapsEl(value, tone){
    var w = el("span", { class:"flaps" + (tone ? " " + tone : "") });
    w.innerHTML = flapHTML(value === null || value === undefined ? "—" : value);
    return w;
  }
  function makeBullet(name, area){
    var color = LINE[area] || "#7a7f88";
    var textc = LINE_DARK_TEXT[area] ? "#000" : "#fff";
    return el("span", { class:"bullet", style:"background:" + color + ";color:" + textc, text:(name || "?").charAt(0).toUpperCase() });
  }

  function ringSvg(value, goal, ofLabel, unit){
    var pct = goal > 0 ? Math.min(1, (value || 0) / goal) : 0;
    var r = 52, c = 2 * Math.PI * r, off = c * (1 - pct);
    var color = pct >= 1 ? "var(--good)" : "var(--accent)";
    var s = '<svg viewBox="0 0 120 120" width="100%" height="100%">';
    s += '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="11"/>';
    s += '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="11" stroke-linecap="round" ';
    s += 'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 60 60)"/></svg>';
    var text = fmt(value);
    var cls = "n" + (text.length >= 3 ? " n-sm" : "");
    var u = unit ? '<span class="u">' + unit + '</span>' : "";
    s += '<div class="mid"><div class="' + cls + '">' + text + u + '</div><div class="of">' + ofLabel + '</div></div>';
    var d = el("div", { class:"ring" }); d.innerHTML = s; return d;
  }
  function chip(value, label, tone, sub){
    return el("div", { class:"chip" }, [
      flapsEl(value === null ? "—" : value, tone),
      el("div", { class:"l", text:label }),
      el("div", { class:"s", text:sub || "" }),
    ]);
  }
  function statCard(value, label, tone, sub){
    return el("div", { class:"card stat" }, [ flapsEl(value, tone), el("div",{class:"l",text:label}), el("div",{class:"s",text:sub||""}) ]);
  }
  function deltaText(cur, prev, unit){
    if (cur === null || prev === null) return { cls:"t-faint", txt:"" };
    var d = cur - prev;
    return { cls: d > 0 ? "t-good" : d < 0 ? "t-danger" : "t-faint",
             txt: (d > 0 ? "▲ " : d < 0 ? "▼ " : "= ") + Math.abs(d) + " " + unit };
  }

  function renderMomentum(v, id){
    var week = num(v.flow_completed_0), month = num(v.g_completed_30d), prevMonth = num(v.g_completed_prev30d);
    var lastWeek = num(v.flow_completed_1);
    var wow = deltaText(week, lastWeek, "vs 7-14d ago");
    var mom = deltaText(month, prevMonth, "vs previous 30 days");
    var open = num(v.g_open), created7 = num(v.flow_created_0);
    var net7 = (created7 !== null && week !== null) ? week - created7 : null;

    var hero = el("div", { class:"card hero" }, [
      ringSvg(week, WEEKLY_GOAL, "of " + WEEKLY_GOAL + " goal"),
      el("div", { class:"say" }, [
        el("div", { class:"k", text:"Shipped, last 30 days" }),
        el("div", { class:"big" }, [ flapsEl(month, "accent"), el("span", { class:"unit", text:"last 30 days" }) ]),
        el("div", { class:"delta " + wow.cls, text:wow.txt }),
        el("div", { class:"mom", text:(mom.txt ? mom.txt + " · " : "") + fmt(prevMonth) + " previous 30 days" }),
      ]),
    ]);
    var chips = el("div", { class:"card chips" }, [
      chip(open, "Open work", null, ""),
      chip(net7 === null ? "—" : signed(net7), "Net flow (7d)", net7 === null ? null : (net7 >= 0 ? "good" : "danger"),
           net7 === null ? "" : (net7 >= 0 ? "clearing backlog" : "backlog growing")),
      chip(num(v.g_overdue), "Overdue", "danger", ""),
      chip(num(v.g_due_7d), "Due next 7d", "warn", ""),
    ]);
    fill(id, [hero, chips]);
  }

  function renderFlow(v, id){
    var created30 = num(v.g_created_30d), done30 = num(v.g_completed_30d), prev30 = num(v.g_completed_prev30d);
    var net30 = (created30 !== null && done30 !== null) ? done30 - created30 : null;
    var mom = deltaText(done30, prev30, "vs previous 30 days");

    var top = el("div", { class:"top" }, [
      el("div", { class:"card" }, [
        flapsEl(net30 === null ? "—" : signed(net30), net30 === null ? null : net30 >= 0 ? "good" : "danger"),
        el("div", { class:"l", text:"Net flow (30d): completed minus created" }),
        el("div", { class:"s", text: net30 === null ? "" : (net30 >= 0 ? "backlog shrinking" : fmt(created30) + " in · " + fmt(done30) + " out") }),
      ]),
      el("div", { class:"card" }, [
        flapsEl(done30, "accent"),
        el("div", { class:"l", text:"Completed, last 30 days" }),
        el("div", { class:"s " + mom.cls, text:mom.txt }),
      ]),
    ]);

    var weeks = [];
    for (var w = FLOW_WEEKS - 1; w >= 0; w--) weeks.push({ created:num(v["flow_created_"+w]), completed:num(v["flow_completed_"+w]), label: w === 0 ? "last 7 days" : w + "w ago" });
    var maxFlow = 1;
    weeks.forEach(function(wk){ if(wk.created) maxFlow=Math.max(maxFlow,wk.created); if(wk.completed) maxFlow=Math.max(maxFlow,wk.completed); });
    var flow = el("div", { class:"flow" });
    weeks.forEach(function(wk){
      function bar(cls,val){ var h = val ? Math.max(2, Math.round(val/maxFlow*100)) : 1; return el("div",{class:"bar "+cls,style:"height:"+h+"%",title:cls+": "+fmt(val)}); }
      flow.appendChild(el("div",{class:"col"},[ el("div",{class:"bars"},[bar("created",wk.created),bar("completed",wk.completed)]), el("div",{class:"wk",text:wk.label}) ]));
    });
    var flowCard = el("div", { class:"card" }, [
      el("p", { class:"ptitle", text:"Flow: created vs completed, by week" }), flow,
      el("div", { class:"legend", html:'<span><i style="background:var(--info)"></i>Created</span><span><i style="background:var(--accent)"></i>Completed</span>' }),
    ]);
    fill(id, [top, flowCard]);
  }

  function renderRace(v, id){
    var teams = CFG.teams.map(function(t){
      return { name:t.name, area:t.area, done:sumKeys(v, t.keys, "_completed_30d"), open:sumKeys(v, t.keys, "_open") };
    });
    teams.sort(function(a,b){ return (b.done||0)-(a.done||0); });
    raceMax = 1; teams.forEach(function(t){ if(t.done) raceMax=Math.max(raceMax,t.done); });
    raceTeamCount = teams.length;
    var totalShipped = teams.reduce(function(s,t){ return s + (t.done||0); }, 0);
    var activeTeams = teams.filter(function(t){ return (t.done||0) > 0; }).length;

    racePages = [];
    for (var i = 0; i < teams.length; i += RACE_PAGE_SIZE) racePages.push(teams.slice(i, i + RACE_PAGE_SIZE));
    if (racePageIdx >= racePages.length) racePageIdx = 0;

    var lead = teams[0];
    var headKids = [ el("span", { class:"lbl", text:"Top team, last 30 days" }) ];
    if (lead && lead.done){ headKids.push(makeBullet(lead.name, lead.area)); headKids.push(el("span", { class:"big", text:lead.name })); headKids.push(flapsEl(lead.done, "accent")); }
    else headKids.push(el("span", { class:"big", text:"—" }));
    headKids.push(el("span", { class:"racepage", id:"racePage" }));
    var head = el("div", { class:"card tow" }, headKids);

    var board = el("div", { class:"card" }, [ el("div", { class:"rows", id:"raceBoard" }) ]);
    var foot = el("div", { class:"card totbar" }, [
      flapsEl(totalShipped, "accent"),
      el("span", { class:"l", text:"items shipped across " + activeTeams + " teams, last 30 days" }),
    ]);
    fill(id, [head, board, foot]);
    renderRacePage(racePageIdx);
  }

  function renderRacePage(p){
    if (!racePages.length) return;
    racePageIdx = ((p % racePages.length) + racePages.length) % racePages.length;
    var page = racePages[racePageIdx];
    var start = racePageIdx * RACE_PAGE_SIZE;
    var rows = document.getElementById("raceBoard");
    if (!rows) return;
    rows.innerHTML = "";
    page.forEach(function(t){
      var pct = t.done ? Math.round(t.done/raceMax*100) : 0;
      var color = LINE[t.area] || "#7a7f88";
      var mid = el("div", { class:"mid" }, [
        makeBullet(t.name, t.area),
        el("div", { class:"stack" }, [
          el("div", { class:"name", text:t.name }),
          el("div", { class:"area", text:t.area }),
          el("div", { class:"track" }, [ el("div", { class:"fill", style:"width:" + pct + "%;background:" + color }) ]),
        ]),
      ]);
      var nums = el("div", { class:"nums" }, [ el("b", { text:fmt(t.done) }), document.createTextNode(" · " + fmt(t.open) + " open") ]);
      rows.appendChild(el("div", { class:"row team" }, [ mid, nums ]));
    });
    var lbl = document.getElementById("racePage");
    if (lbl) lbl.textContent = racePages.length > 1 ? (start+1) + "–" + (start+page.length) + " / " + raceTeamCount : "";
  }

  function renderBacklogHealth(v, id){
    var top3 = el("div", { class:"top3" }, [
      statCard(num(v.g_open), "Open work items", null, "across all teams"),
      statCard(num(v.g_overdue), "Overdue", "danger", "past due date, not done"),
      statCard(num(v.g_due_7d), "Due next 7 days", "warn", ""),
    ]);
    var open = num(v.g_open);
    var hasOpen = open !== null && open > 0;
    var buckets = [
      { label:"Older than 30d", val:num(v.g_aging_30d), cls:"warn" },
      { label:"Older than 60d", val:num(v.g_aging_60d), cls:"warn" },
      { label:"Older than 90d", val:num(v.g_aging_90d), cls:"danger" },
    ];
    var maxB = Math.max(1, num(v.g_aging_30d) || 1);
    var rows = el("div", { class:"rows" });
    buckets.forEach(function(b){
      var pct = b.val ? Math.round(b.val/maxB*100) : 0;
      var pctText = hasOpen ? Math.round((b.val || 0)/open*100) + "% of open" : "—";
      rows.appendChild(el("div",{class:"row bucket"},[
        el("div",{class:"cap",text:b.label}),
        el("div",{class:"track"},[ el("div",{class:"fill "+b.cls,style:"width:"+pct+"%"}) ]),
        el("div",{class:"nums"},[ el("b",{text:fmt(b.val)}), document.createTextNode(" · " + pctText) ]),
      ]));
    });
    var agingCard = el("div", { class:"card" }, [ el("p",{class:"ptitle",text:"Aging backlog: how long open work has been sitting"}), rows ]);
    fill(id, [top3, agingCard]);
  }

  function renderSpotlight(v, scene, id){
    var slug = scene.slug;
    var prefix = "spot_" + slug + "_";
    var total = num(v[prefix + "sprint_total"]), done = num(v[prefix + "sprint_done"]);
    var hasSprints = scene.sprints && (typeof v[prefix + "sprint_total"] !== "undefined");
    var hasBugs = scene.bugs && (typeof v[prefix + "bugs_open"] !== "undefined");

    var heroSections = [];

    if (hasSprints) {
      var pct = (total && total > 0) ? Math.round((done||0)/total*100) : null;
      heroSections.push(ringSvg(pct === null ? null : pct, 100, "sprint complete", "%"));
      heroSections.push(el("div", { class:"say" }, [
        el("div", { class:"k", text:scene.name + " · current sprints" }),
        el("div", { class:"big" }, [ flapsEl(done, "accent"), el("span",{class:"unit",text:"of " + fmt(total) + " done"}) ]),
      ]));
    } else {
      heroSections.push(el("div", { class:"say", style:"grid-column:1/-1" }, [
        el("div", { class:"k", text:scene.name }),
        el("div", { class:"big" }, [ flapsEl(num(v[prefix + "open"]), null), el("span",{class:"unit",text:"open"}) ]),
        el("div", { class:"delta", style:"margin-top:0.5rem" }, [ el("span",{text:fmt(num(v[prefix + "wip"])) + " in progress · " + fmt(num(v[prefix + "completed_30d"])) + " completed (30d)"}) ]),
      ]));
    }

    var hero = el("div", { class:"card hero" }, heroSections);

    var chipDefs = hasSprints ? [
      { id:"open", label:"Open", tone:null, sub:"" },
      { id:"wip", label:"In progress", tone:"info", sub:"" },
      { id:"completed_30d", label:"Completed (30d)", tone:"accent", sub:fmt(num(v[prefix + "completed_7d"])) + " this week" },
    ] : [
      { id:"wip", label:"In progress", tone:"info", sub:"" },
      { id:"completed_7d", label:"Completed (7d)", tone:"accent", sub:"" },
      { id:"completed_30d", label:"Completed (30d)", tone:"accent", sub:"" },
    ];

    if (hasBugs) {
      chipDefs.push({ id:"bugs_open", label:"Bugs open", tone:"danger", sub:fmt(num(v[prefix + "bugs_closed_7d"])) + " closed / " + fmt(num(v[prefix + "bugs_created_7d"])) + " new" });
    }

    var chips = el("div", { class:"card chips" }, chipDefs.map(function(cd){
      return chip(num(v[prefix + cd.id]), cd.label, cd.tone, cd.sub);
    }));

    fill(id, [hero, chips]);
  }

  function render(d){
    var v = d.values || {};
    document.getElementById("demoChip").style.display = d.demo ? "inline-block" : "none";
    for (var i = 0; i < SCENES.length; i++) {
      var s = SCENES[i];
      var id = "scene-" + s.id;
      if (s.type === "momentum") renderMomentum(v, id);
      else if (s.type === "flow") renderFlow(v, id);
      else if (s.type === "race") renderRace(v, id);
      else if (s.type === "backlogHealth") renderBacklogHealth(v, id);
      else if (s.type === "spotlight") renderSpotlight(v, s, id);
    }
    if (SCENES[sceneIdx].type === "race") startRacePager();
    lastGeneratedAt = d.generatedAt; updateAge();
  }

  function showScene(i){
    sceneIdx = (i + SCENES.length) % SCENES.length;
    SCENES.forEach(function(s, idx){ document.getElementById("scene-" + s.id).classList.toggle("active", idx === sceneIdx); });
    document.getElementById("brandSub").textContent = SCENES[sceneIdx].name.toUpperCase();
    Array.prototype.forEach.call(document.querySelectorAll("#dots span"), function(sp, idx){ sp.classList.toggle("on", idx === sceneIdx); });
    if (SCENES[sceneIdx].type === "race"){ racePageIdx = 0; renderRacePage(0); startRacePager(); } else stopRacePager();
  }
  function buildDots(){
    var dots = document.getElementById("dots"); dots.innerHTML = "";
    SCENES.forEach(function(_, idx){ var sp = el("span", {}); sp.addEventListener("click", function(e){ e.stopPropagation(); showScene(idx); restartRotation(); }); dots.appendChild(sp); });
  }
  var rotTimer = null, progStart = 0, progRAF = null;
  function tickProgress(){ var pct = Math.min(1, (Date.now() - progStart) / ROTATE_MS); document.getElementById("prog").style.width = (pct * 100) + "%"; if (pct < 1) progRAF = requestAnimationFrame(tickProgress); }
  function restartRotation(){
    if (progRAF) cancelAnimationFrame(progRAF);
    if (rotTimer) clearInterval(rotTimer);
    if (!ROTATE) { document.getElementById("prog").style.width = "0"; return; }
    progStart = Date.now(); tickProgress();
    rotTimer = setInterval(function(){ showScene(sceneIdx + 1); progStart = Date.now(); }, ROTATE_MS);
  }
  function startRacePager(){
    stopRacePager();
    if (racePages.length <= 1) return;
    var iv = Math.max(3000, Math.floor(ROTATE_MS / racePages.length));
    racePager = setInterval(function(){ renderRacePage(racePageIdx + 1); }, iv);
  }
  function stopRacePager(){ if (racePager){ clearInterval(racePager); racePager = null; } }

  function updateAge(){
    if (!lastGeneratedAt) return;
    var secs = Math.round((Date.now() - new Date(lastGeneratedAt).getTime())/1000);
    document.getElementById("status").textContent = "Updated " + (secs < 60 ? "just now" : secs < 3600 ? Math.round(secs/60)+"m ago" : Math.round(secs/3600)+"h ago");
  }
  function clockTick(){
    try {
      var opts = { timeZone: CFG.display.timeZone, hour12: false, hour:"2-digit", minute:"2-digit", second:"2-digit" };
      var pf = Intl.DateTimeFormat(CFG.display.locale, opts);
      var parts = pf.formatToParts(new Date());
      var h = "00", m = "00", s = "00";
      parts.forEach(function(p){ if (p.type==="hour") h=p.value; if (p.type==="minute") m=p.value; if (p.type==="second") s=p.value; });
      document.getElementById("clock").innerHTML = flapHTML(h + ":" + m + ":" + s);

      var dateOpts = { timeZone: CFG.display.timeZone, weekday:"short", month:"short", day:"numeric" };
      var df = Intl.DateTimeFormat(CFG.display.locale, dateOpts);
      document.getElementById("clockdate").textContent = df.format(new Date());
    } catch(e) { /* fall through to browser local */ }
    updateAge();
  }
  var loadInFlight = false;
  function load(force){
    if (loadInFlight) return;
    loadInFlight = true;
    var btn = document.getElementById("refresh"); btn.disabled = true;
    document.getElementById("status").textContent = force ? "Refreshing…" : "Loading…";
    var q = [];
    if (force) q.push("refresh=1");
    if (qp.get("demo") === "1") q.push("demo=1");
    fetch("/api/kpis" + (q.length ? "?" + q.join("&") : ""))
      .then(function(r){ return r.json(); })
      .then(function(d){
        if (d && d.pending){ document.getElementById("status").textContent = "Warming up…"; return; }
        if (d && d.error){ document.getElementById("status").textContent = "Error: " + d.error; return; }
        render(d);
      })
      .catch(function(e){ document.getElementById("status").textContent = "Error: " + e; })
      .then(function(){ btn.disabled = false; loadInFlight = false; });
  }

  document.getElementById("stage").addEventListener("click", function(e){ if (e.target.closest("button") || e.target.closest(".dots")) return; showScene(sceneIdx + 1); restartRotation(); });
  document.addEventListener("keydown", function(e){ if (e.key === "ArrowRight"){ showScene(sceneIdx + 1); restartRotation(); } else if (e.key === "ArrowLeft"){ showScene(sceneIdx - 1); restartRotation(); } });
  document.getElementById("refresh").addEventListener("click", function(e){ e.stopPropagation(); load(false); });

  buildDots();
  showScene(sceneIdx);
  restartRotation();
  clockTick();
  setInterval(clockTick, 1000);
  load(false);
  setInterval(function(){ load(false); }, POLL_MS);
</script>
</body>
</html>`;
}
