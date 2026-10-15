/* ============================================================
   js/almacenamiento.js
   Almacenamiento: navegador (localStorage) y nube de Claude si existe.
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   ALMACENAMIENTO
   Caché local (localStorage) + base de datos privada por usuario
   (claude db: data/users/<id>/config y data/users/<id>/tx-AAAA-MM)
   ========================================================= */
// Nombre de la "caja" donde se guarda todo en el navegador (localStorage).
const LS_KEY = "finanzas.v1";
// Memoria de las capacidades ya pedidas al entorno, para no pedirlas dos veces.
const cap$ = {};
// Pide una capacidad del entorno de Claude (base de datos, usuario, descargas).
// Si la app corre fuera de Claude (por ejemplo, en localhost) devuelve null y
// la app sigue funcionando solo con localStorage.
const getCap = (name) => {
  if (!(window.claude && typeof window.claude.use === "function")) return Promise.resolve(null);
  if (!cap$[name]) cap$[name] = window.claude.use(name).catch(() => null);
  return cap$[name];
};
// CAPA DE ALMACENAMIENTO. Guarda en dos lugares:
// 1) localStorage del navegador: inmediato, funciona siempre (también en localhost).
// 2) Base de datos privada del usuario (solo si la app está publicada en Claude).
//    Se guarda un documento "config" y un documento por mes "tx-AAAA-MM".
const Storage = {
  db: null, uid: null, dirtyMonths: new Set(), dirtyConfig: false, timer: null, warned: false, latest: null,
  // Lee el estado guardado en el navegador. Si no hay nada o está dañado, devuelve null.
  loadLocal() { try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } },
  // Guarda todo el estado en el navegador como texto JSON.
  saveLocal(s) { try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {} },
  // Intenta conectarse a la base de datos en la nube.
  // Paso 1: pide las capacidades "db" (datos) y "user" (quién es el usuario).
  // Paso 2: obtiene el id del usuario. Paso 3: si todo existe, queda conectado.
  async connect() {
    const [db, user] = await Promise.all([getCap("db"), getCap("user")]);
    if (!db || !user) return false;
    const id = await user.id();
    if (!id) return false;
    this.db = db; this.uid = id; return true;
  },
  // Ruta de la colección privada del usuario en la base de datos.
  col() { return this.db.collection(`data/users/${this.uid}`); },
  // Descarga todos los datos del usuario desde la nube.
  // Paso 1: trae todos los documentos de su colección.
  // Paso 2: "config" trae categorías, presupuestos, metas, deudas y ajustes.
  // Paso 3: cada "tx-AAAA-MM" trae los movimientos de ese mes y se juntan en una sola lista.
  async loadRemote() {
    const snap = await this.col().get();
    let config = null; const txs = [];
    snap.docs.forEach((d) => {
      const v = d.data() || {};
      if (d.id === "config") config = v;
      else if (d.id.startsWith("tx-")) txs.push(...(v.items || []));
    });
    return config ? { ...config, transactions: txs } : null;
  },
  // Se llama en CADA cambio de datos.
  // Paso 1: guarda inmediatamente en el navegador.
  // Paso 2: si hay nube, anota qué meses y si la configuración cambiaron ("sucios").
  // Paso 3: espera 600 ms sin cambios nuevos y entonces sube todo junto (menos escrituras).
  schedule(state, meta) {
    this.latest = state;
    this.saveLocal(state);
    if (!this.db) return;
    (meta.months || []).forEach((m) => m && this.dirtyMonths.add(m));
    if (meta.config) this.dirtyConfig = true;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 600);
  },
  // Marca TODO como pendiente y lo sube (se usa la primera vez que se conecta la nube).
  pushAll(state) {
    new Set(state.transactions.map((t) => t.date.slice(0, 7))).forEach((m) => this.dirtyMonths.add(m));
    this.dirtyConfig = true; this.latest = state; return this.flush();
  },
  // Sube a la nube solo lo que cambió.
  // Paso 1: copia la lista de meses y config pendientes y la vacía.
  // Paso 2: escribe cada mes y, si cambió, la configuración.
  // Paso 3: si falla, vuelve a marcar como pendiente y avisa una sola vez (los datos siguen en el navegador).
  async flush() {
    const s = this.latest; if (!this.db || !s) return;
    const months = [...this.dirtyMonths]; const cfg = this.dirtyConfig;
    this.dirtyMonths.clear(); this.dirtyConfig = false;
    try {
      for (const m of months) await this.col().doc(`tx-${m}`).set({ month: m, items: s.transactions.filter((t) => t.date.slice(0, 7) === m), updated_at: new Date().toISOString() });
      if (cfg) { const { transactions, ...config } = s; await this.col().doc("config").set({ ...config, updated_at: new Date().toISOString() }); }
    } catch (e) {
      months.forEach((m) => this.dirtyMonths.add(m)); if (cfg) this.dirtyConfig = true;
      if (!this.warned) { this.warned = true; toast("No se pudo sincronizar con la nube. Tus datos siguen guardados en este navegador.", "danger"); }
    }
  },
};
