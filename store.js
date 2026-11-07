// Storage adapters: Local (demo, this browser only) and Firebase Realtime DB (REST, shared).
(function () {
  const cfg = window.ARCHERY_CONFIG || {};
  const LS = "archery.v1";

  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
  const writeLocal = (d) => localStorage.setItem(LS, JSON.stringify(d));

  const Local = {
    shared: false,
    async getUser(k) { return (readLocal().users || {})[k] || null; },
    async putUser(k, u) { const d = readLocal(); (d.users ||= {})[k] = u; writeLocal(d); },
    async getSession(sid) { return (readLocal().sessions || {})[sid] || {}; },
    async putScore(sid, uk, s) { const d = readLocal(); ((d.sessions ||= {})[sid] ||= {})[uk] = s; writeLocal(d); },
    async deleteScore(sid, uk) { const d = readLocal(); if (d.sessions?.[sid]) delete d.sessions[sid][uk]; writeLocal(d); },
    async getConfig(sid) { return (readLocal().configs || {})[sid] || null; },
    async putConfig(sid, c) { const d = readLocal(); (d.configs ||= {})[sid] = c; writeLocal(d); },
  };

  const base = (cfg.firebaseUrl || "").replace(/\/+$/, "");
  async function fb(path, method = "GET", body) {
    const r = await fetch(`${base}/${path}.json`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!r.ok) throw new Error(`Database error ${r.status}`);
    return r.json();
  }
  const Firebase = {
    shared: true,
    getUser: (k) => fb(`users/${k}`),
    putUser: (k, u) => fb(`users/${k}`, "PUT", u),
    async getSession(sid) { return (await fb(`sessions/${sid}`)) || {}; },
    putScore: (sid, uk, s) => fb(`sessions/${sid}/${uk}`, "PUT", s),
    deleteScore: (sid, uk) => fb(`sessions/${sid}/${uk}`, "DELETE"),
    getConfig: (sid) => fb(`configs/${sid}`),
    putConfig: (sid, c) => fb(`configs/${sid}`, "PUT", c),
  };

  window.Store = base ? Firebase : Local;
})();
