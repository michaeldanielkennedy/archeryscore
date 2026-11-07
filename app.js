(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const app = $("#app");
  const POLL = ((window.ARCHERY_CONFIG || {}).pollSeconds || 4) * 1000;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const prettyDate = (iso) => new Date(iso + "T12:00").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const userKey = (n) => n.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  let me = null;            // {name, key}
  let sess = null;          // {venue, date, id}
  let myScore = null;       // {name, round, arrows:"X,9,M", updated}
  let timer = null;
  let tab = "score";
  let config = null;        // session setup chosen by the admin: {def, admin, adminName}
  let editing = false;

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  function setTheme(t) { document.body.dataset.theme = t || "default"; }

  async function sha(text) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // ---------- scoring ----------
  const toks = (s) => (s.arrows ? s.arrows.split(",") : []);
  const val = (t) => (t === "X" ? 10 : t === "M" ? 0 : +t);
  function summarise(s) {
    const r = s.def || window.roundById(s.round); if (!r) return null;
    const a = toks(s), tot = window.roundTotals(r);
    const total = a.reduce((x, t) => x + val(t), 0);
    const top = r.zone === "worc" ? 5 : 9;
    return {
      r, a, total, arrows: a.length, max: tot.max, of: tot.arrows,
      hits: a.filter((t) => val(t) > 0).length,
      golds: a.filter((t) => val(t) >= top).length,
      xs: a.filter((t) => t === "X").length,
    };
  }

  // ---------- views ----------
  function renderHeader() {
    const w = $("#who");
    if (!me) { w.hidden = true; return; }
    w.hidden = false;
    w.innerHTML = `<span class="avatar">${esc(me.name[0].toUpperCase())}</span><span class="nm">${esc(me.name)}</span><button class="link" id="logout">Log out</button>`;
    $("#logout").onclick = logout;
  }
  function logout() {
    stopPoll(); me = null; sess = null; myScore = null; config = null;
    try { localStorage.removeItem("archery.me"); } catch {}
    setTheme("default"); renderHeader(); viewLogin();
  }

  function viewLogin() {
    setTheme("default"); stopPoll();
    const demo = !window.Store.shared;
    app.innerHTML = `
      <section class="hero">
        <h1>Score every arrow.<br><span class="grad">See everyone's score live.</span></h1>
        <p>UK Archery GB rounds. Pick your venue and date, then shoot together.</p>
      </section>
      <form class="card login" id="loginForm" autocomplete="off">
        <h2>Log in <small>or create an account</small></h2>
        <label>Your name<input id="ln" required maxlength="24" placeholder="e.g. Sam Archer" autocapitalize="words"></label>
        <label>PIN (4+ digits)<input id="lp" required inputmode="numeric" pattern="[0-9]{4,}" maxlength="12" type="password" placeholder="••••"></label>
        <button class="btn primary" type="submit">Enter the range →</button>
        <p class="hint" id="lerr"></p>
        ${demo ? `<p class="note">Demo mode: scores are stored in this browser only. See README to turn on shared live scoring.</p>` : ""}
      </form>`;
    $("#loginForm").onsubmit = async (e) => {
      e.preventDefault();
      const name = $("#ln").value.trim().replace(/\s+/g, " "), pin = $("#lp").value;
      const key = userKey(name), err = $("#lerr");
      if (!key) { err.textContent = "Please enter a name."; return; }
      try {
        const hash = await sha(`${key}:${pin}`);
        const u = await window.Store.getUser(key);
        if (!u) await window.Store.putUser(key, { name, hash });
        else if (u.hash !== hash) { err.textContent = "That name exists and the PIN doesn't match."; return; }
        me = { name: (u && u.name) || name, key };
        try { localStorage.setItem("archery.me", JSON.stringify(me)); } catch {}
        renderHeader(); viewPick(); toast(u ? `Welcome back, ${me.name}!` : `Account created. Welcome, ${me.name}!`);
      } catch (ex) { err.textContent = ex.message || "Something went wrong."; }
    };
  }

  function viewPick() {
    setTheme("default"); stopPoll(); sess = null; myScore = null; config = null; editing = false;
    let chosen = null;
    app.innerHTML = `
      <section class="pick">
        <h2>Where are you shooting?</h2>
        <div class="venues">
          ${window.VENUES.map((v) => `
            <button class="venue" data-id="${v.id}" data-theme="${v.theme}">
              <span class="v-emoji">${v.emoji}</span>
              <span class="v-name">${esc(v.name)}</span>
              <span class="v-sub">${esc(v.sub)}</span>
              <span class="v-bar"></span>
            </button>`).join("")}
        </div>
        <div class="card datebox">
          <label>Date<input type="date" id="date" value="${today()}"></label>
          <button class="btn primary" id="go" disabled>Join session →</button>
        </div>
      </section>`;
    app.querySelectorAll(".venue").forEach((b) => b.onclick = () => {
      app.querySelectorAll(".venue").forEach((x) => x.classList.remove("on"));
      b.classList.add("on"); chosen = b.dataset.id;
      setTheme(window.VENUES.find((v) => v.id === chosen).theme);
      $("#go").disabled = false;
    });
    $("#go").onclick = () => {
      const date = $("#date").value; if (!chosen || !date) return;
      joinSession(chosen, date);
    };
  }

  async function joinSession(venueId, date) {
    const venue = window.VENUES.find((v) => v.id === venueId);
    sess = { venue, date, id: `${venueId}_${date}` };
    setTheme(venue.theme);
    app.innerHTML = `<div class="loading">Loading session…</div>`;
    try {
      const [data, cfg] = await Promise.all([window.Store.getSession(sess.id), window.Store.getConfig(sess.id)]);
      config = cfg; editing = false;
      myScore = data[me.key] || null;
      tab = "score";
      lastData = data;
      ensureScore();
      viewSession(lastData);
      startPoll();
    } catch (ex) { toast(ex.message); viewPick(); }
  }

  function viewSession(data) {
    app.innerHTML = `
      <section class="session">
        <div class="s-head">
          <button class="link" id="back">← Change venue/date</button>
          <h2>${esc(sess.venue.name)}</h2>
          <p class="when">${prettyDate(sess.date)} <span class="live"><i></i>${window.Store.shared ? "Live" : "Local"}</span></p>
        </div>
        <nav class="tabs">
          <button data-t="score" class="${tab === "score" ? "on" : ""}">My scorecard</button>
          <button data-t="board" class="${tab === "board" ? "on" : ""}">Leaderboard <span class="count" id="cnt"></span></button>
        </nav>
        <div id="panel"></div>
      </section>`;
    $("#back").onclick = viewPick;
    app.querySelectorAll(".tabs button").forEach((b) => b.onclick = () => { tab = b.dataset.t; viewSession(lastData); });
    lastData = data; renderPanel();
  }
  let lastData = {};

  function renderPanel() {
    $("#cnt").textContent = Object.keys(lastData).length || "";
    if (tab === "board") renderBoard(); else renderScore();
  }

  // ----- leaderboard -----
  function renderBoard() {
    const rows = Object.entries(lastData).map(([k, s]) => ({ k, s, m: summarise(s) })).filter((x) => x.m);
    rows.sort((a, b) => b.m.total - a.m.total || b.m.xs - a.m.xs || b.m.golds - a.m.golds);
    const panel = $("#panel");
    if (!rows.length) { panel.innerHTML = `<div class="card empty">No scores yet. Be the first on the line! 🎯</div>`; return; }
    panel.innerHTML = `<div class="board">${rows.map((x, i) => {
      const pct = Math.round((x.m.arrows / x.m.of) * 100);
      const medal = ["🥇", "🥈", "🥉"][i] || i + 1;
      return `<article class="row ${x.k === me.key ? "me" : ""} ${i < 3 ? "podium p" + (i + 1) : ""}">
        <div class="rank">${medal}</div>
        <div class="who2"><b>${esc(x.s.name)}</b><span>${esc(x.m.r.name)} · ${x.m.arrows}/${x.m.of} arrows</span>
          <div class="prog"><i style="width:${pct}%"></i></div></div>
        <div class="stats"><span>${x.m.hits} hits</span><span>${x.m.golds} golds</span>${x.m.xs ? `<span>${x.m.xs} X</span>` : ""}</div>
        <div class="total">${x.m.total}<small>/ ${x.m.max}</small></div>
      </article>`;
    }).join("")}</div><p class="note c">Updates automatically${window.Store.shared ? "" : " (demo mode: this browser only)"}.</p>`;
  }

  // ----- scorecard -----
  function renderScore() {
    const panel = $("#panel");
    if (!config || editing) { renderSetup(); return; }
    ensureScore();
    const m = summarise(myScore), r = m.r;
    const done = m.arrows >= m.of;
    const endIdx = Math.floor(m.arrows / r.perEnd), inEnd = m.arrows % r.perEnd;
    const keys = window.ZONES[r.zone];
    // section progress
    let acc = 0;
    const secs = r.sections.map((s) => { const from = acc; acc += s.arrows;
      const part = m.a.slice(from, acc); return { ...s, from, part, sum: part.reduce((x, t) => x + val(t), 0) }; });
    const curSec = secs.find((s) => m.arrows >= s.from && m.arrows < s.from + s.arrows) || secs[secs.length - 1];
    const cur = m.a.slice(endIdx * r.perEnd, endIdx * r.perEnd + inEnd);

    panel.innerHTML = `
      <div class="setup-chip"><span>⚙️ ${esc(r.name)} · ${r.perEnd} arrows/end · set by <b>${esc(config.adminName || "admin")}</b></span>${config.admin === me.key ? `<button class="link" id="edit">Edit setup</button>` : ""}</div>
      <div class="card scorehead">
        <div><span class="lbl">${esc(r.name)}</span><span class="sub">${esc(curSec.label)} · End ${Math.min(endIdx + 1, Math.ceil(m.of / r.perEnd))} of ${Math.ceil(m.of / r.perEnd)}</span></div>
        <div class="big">${m.total}<small>/ ${m.max}</small></div>
      </div>
      ${done ? `<div class="card done">🏆 Round complete! Final score <b>${m.total}</b> (${m.golds} golds${m.xs ? `, ${m.xs} X` : ""}).</div>` : `
      <div class="card entry">
        <div class="slots">${Array.from({ length: r.perEnd }, (_, i) => {
          const t = cur[i]; const kc = t ? (keys.find((k) => k[0] === t) || [])[2] : "";
          return `<span class="slot ${t ? "f " + kc : ""} ${i === inEnd ? "next" : ""}">${t || ""}</span>`; }).join("")}</div>
        <div class="keys z-${r.zone}">${keys.map(([l, , c]) => `<button class="key ${c}" data-k="${l}">${l}</button>`).join("")}</div>
        <div class="actions"><button class="btn ghost" id="undo" ${m.arrows ? "" : "disabled"}>⌫ Undo arrow</button></div>
      </div>`}
      <div class="card ends">
        <h3>Scorecard</h3>
        ${secs.map((s) => {
          const nEnds = Math.ceil(s.arrows / r.perEnd);
          let run = 0;
          const rows = Array.from({ length: nEnds }, (_, e) => {
            const a = s.part.slice(e * r.perEnd, (e + 1) * r.perEnd); if (!a.length) return "";
            const es = a.reduce((x, t) => x + val(t), 0); run += es;
            return `<tr><td>${e + 1}</td><td class="arr">${a.map((t) => `<i class="a ${(keys.find((k) => k[0] === t) || [])[2]}">${t}</i>`).join("")}</td><td>${es}</td><td>${run}</td></tr>`;
          }).join("");
          return `<div class="sec"><div class="sec-h"><b>${esc(s.label)}</b><span>${s.sum} · ${s.part.length}/${s.arrows}</span></div>
            ${rows ? `<table><thead><tr><th>End</th><th>Arrows</th><th>End</th><th>Run</th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="note">Not started</p>`}</div>`;
        }).join("")}
        <div class="actions"><button class="btn ghost danger" id="reset">Clear my scorecard</button></div>
      </div>`;

    panel.querySelectorAll(".key").forEach((b) => b.onclick = () => {
      myScore.arrows = myScore.arrows ? myScore.arrows + "," + b.dataset.k : b.dataset.k;
      save(); renderScore();
      if (summarise(myScore).arrows >= m.of) toast("Round complete! 🏆");
    });
    const u = $("#undo"); if (u) u.onclick = () => { const a = toks(myScore); a.pop(); myScore.arrows = a.join(","); save(); renderScore(); };
    const ed = $("#edit"); if (ed) ed.onclick = () => { editing = true; renderScore(); };
    $("#reset").onclick = () => {
      if (!confirm("Clear all your arrows and start this round again?")) return;
      myScore = null; ensureScore(); renderScore();
    };
  }

  // Create my scorecard from the session setup (or adopt a changed setup if I haven't shot yet)
  function ensureScore() {
    if (!config || !config.def) return;
    if (!myScore || (!myScore.arrows && JSON.stringify(myScore.def) !== JSON.stringify(config.def))) {
      myScore = { name: me.name, round: config.def.id, def: config.def, arrows: "", updated: Date.now() };
      save();
    }
  }

  function buildDef(f) {
    const zl = { five: "5-zone", ten: "10-zone" };
    if (f.mode.startsWith("q:")) { const [, d, z] = f.mode.split(":"); f = { dist: d, unit: "m", zone: z, ends: 5, perEnd: 6 }; }
    else if (f.mode !== "custom") return window.roundById(f.mode);
    const label = `${f.dist} ${f.unit}`;
    return { id: "custom", name: `${label} · ${zl[f.zone]}`, group: "Custom", zone: f.zone, perEnd: f.perEnd,
      sections: [{ label, arrows: f.ends * f.perEnd }] };
  }

  function renderSetup() {
    const c = config && config.def && config.def.id === "custom" ? config.def : null;
    const dist = c ? parseFloat(c.sections[0].label) : 12, unit = c ? c.sections[0].label.split(" ")[1] : "m";
    const zone = c ? c.zone : "ten", perEnd = c ? c.perEnd : 6, ends = c ? c.sections[0].arrows / c.perEnd : 5;
    const groups = [...new Set(window.ROUNDS.map((r) => r.group))];
    const curMode = config && config.def && config.def.id !== "custom" ? config.def.id : "custom";
    const startMode = config && config.def ? curMode : "q:10:ten";
    $("#panel").innerHTML = `<form class="card setup" id="setup">
      <h3>${editing ? "Edit tonight's setup" : "Set up tonight's session"}</h3>
      <p class="note" style="margin-top:-6px">${editing ? "Archers who haven't shot yet will switch to the new setup." : "You're first here, so you're the admin. Everyone who joins this venue and date will use this setup."}</p>
      <label>Round<select id="mode"><optgroup label="Quick setups (6 arrows × 5 ends)">${[10, 12, 15].flatMap((d) => [["ten", "10-zone"], ["five", "5-zone"]].map(([z, zl]) => `<option value="q:${d}:${z}">${d} m · 6 arrows × 5 ends · ${zl}</option>`)).join("")}</optgroup>
        <optgroup label="Custom"><option value="custom">Custom (pick distance, target and ends)</option></optgroup>
        ${groups.map((g) => `<optgroup label="${g}">${window.ROUNDS.filter((r) => r.group === g).map((r) => { const t = window.roundTotals(r);
          return `<option value="${r.id}">${esc(r.name)} · ${t.arrows} arrows</option>`; }).join("")}</optgroup>`).join("")}</select></label>
      <div id="customBox">
        <label>Distance
          <div class="chips">${[10, 12, 15, 18, 20].map((d) => `<button type="button" class="chip" data-d="${d}">${d}</button>`).join("")}</div>
          <div class="two"><input id="dist" type="number" min="1" max="200" step="any" value="${dist}" required>
          <select id="unit"><option value="m">metres</option><option value="yd">yards</option></select></div></label>
        <label>Target zones<select id="zone"><option value="ten">10-zone (X, 10 to 1)</option><option value="five">5-zone (9, 7, 5, 3, 1)</option></select></label>
        <div class="two"><label>Number of ends<input id="ends" type="number" min="1" max="60" value="${ends}" required></label>
        <label>Arrows per end<select id="pe">${[3, 5, 6].map((n) => `<option>${n}</option>`).join("")}</select></label></div>
      </div>
      <p class="note" id="sum"></p>
      <div class="actions" style="gap:10px"><button class="btn primary" type="submit">${editing ? "Save setup" : "Start session"} →</button>
      ${editing ? `<button class="btn ghost" type="button" id="cancel">Cancel</button>` : ""}</div></form>`;
    $("#mode").value = startMode; $("#unit").value = unit; $("#zone").value = zone; $("#pe").value = perEnd;
    const read = () => ({ mode: $("#mode").value, dist: $("#dist").value, unit: $("#unit").value, zone: $("#zone").value, ends: +$("#ends").value, perEnd: +$("#pe").value });
    const upd = () => { const f = read(); $("#customBox").hidden = f.mode !== "custom";
      const d = buildDef(f), t = window.roundTotals(d); $("#sum").textContent = `${d.name} · ${t.arrows} arrows · max ${t.max}`;
      document.querySelectorAll(".chip").forEach((b) => b.classList.toggle("on", b.dataset.d === String(f.dist))); };
    $("#setup").oninput = upd; $("#setup").onchange = upd;
    document.querySelectorAll(".chip").forEach((b) => b.onclick = () => { $("#dist").value = b.dataset.d; upd(); });
    const cn = $("#cancel"); if (cn) cn.onclick = () => { editing = false; renderScore(); };
    upd();
    $("#setup").onsubmit = async (e) => {
      e.preventDefault();
      const f = read(); if (f.mode === "custom" && !(f.ends >= 1 && +f.dist > 0)) return;
      const admin = config && config.admin ? config.admin : me.key, adminName = config && config.adminName ? config.adminName : me.name;
      const next = { def: buildDef(f), admin, adminName };
      try { await window.Store.putConfig(sess.id, next); } catch (ex) { toast("Save failed: " + ex.message); return; }
      config = next; editing = false; ensureScore(); renderScore(); toast("Session setup saved");
    };
  }

  let saving = Promise.resolve();
  function save() {
    myScore.updated = Date.now(); lastData[me.key] = { ...myScore };
    const snap = { ...myScore }; $("#cnt") && ($("#cnt").textContent = Object.keys(lastData).length);
    saving = saving.then(() => window.Store.putScore(sess.id, me.key, snap)).catch((e) => toast("Save failed: " + e.message));
  }

  // ----- polling -----
  function startPoll() {
    stopPoll();
    timer = setInterval(async () => {
      if (!sess || document.hidden) return;
      try {
        const [d, cfg] = await Promise.all([window.Store.getSession(sess.id), window.Store.getConfig(sess.id)]);
        const cfgChanged = JSON.stringify(cfg) !== JSON.stringify(config);
        if (cfgChanged && !editing) { config = cfg; ensureScore(); if (tab === "score") renderScore(); }
        const mine = lastData[me.key]; d[me.key] = mine && (!d[me.key] || (mine.updated || 0) >= (d[me.key].updated || 0)) ? mine : d[me.key];
        if (!d[me.key]) delete d[me.key];
        lastData = d; if (tab === "board") renderPanel(); else $("#cnt") && ($("#cnt").textContent = Object.keys(d).length || "");
      } catch {}
    }, POLL);
  }
  function stopPoll() { clearInterval(timer); timer = null; }
  window.addEventListener("storage", (e) => { if (e.key === "archery.v1" && sess && !window.Store.shared) window.Store.getSession(sess.id).then((d) => { lastData = d; if (tab === "board") renderPanel(); }); });

  // ---------- boot ----------
  $("#brand").onclick = (e) => { e.preventDefault(); if (me) viewPick(); };
  try { me = JSON.parse(localStorage.getItem("archery.me")); } catch { me = null; }
  renderHeader();
  me && me.key ? viewPick() : viewLogin();
})();
