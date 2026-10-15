/* ============================================================
   js/app.js
   Perfil, bienvenida, cabecera, app principal y arranque.
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   PERFIL
   ========================================================= */
// PERFIL: editar nombre y correo, cargar datos de ejemplo o borrar todo.
// Al abrir, copia los datos actuales a los campos.
function ProfileModal({ open, onClose, cloud }) {
  const app = useApp();
  const [name, setName] = useState(""), [email, setEmail] = useState(""), [err, setErr] = useState("");
  useEffect(() => { if (open) { setName(app.profile.name || ""); setEmail(app.profile.email || ""); setErr(""); } }, [open]);
  // Valida nombre obligatorio y formato de correo, y guarda el perfil.
  const save = () => {
    if (!name.trim()) return setErr("Escribe tu nombre.");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setErr("El correo no es válido.");
    actions.setProfile({ name: name.trim().slice(0, 40), email: email.trim() }); toast("Perfil actualizado"); onClose();
  };
  // Reemplaza todo por los datos de ejemplo (pide confirmación).
  const demo = async () => { if (await confirmAsk({ title: "Cargar datos de demostración", body: "Se reemplazarán todos tus datos actuales por movimientos, presupuestos, metas y deudas de ejemplo.", confirmLabel: "Reemplazar datos", danger: true })) { actions.replaceAll({ ...buildDemo(), profile: app.profile }); toast("Datos de demostración cargados"); onClose(); } };
  // Borra todos los datos y deja la app vacía (pide confirmación).
  const wipe = async () => { if (await confirmAsk({ title: "Borrar todos los datos", body: "Se eliminarán todos los movimientos, presupuestos, metas, deudas y categorías personalizadas. Esta acción no se puede deshacer.", confirmLabel: "Borrar todo", danger: true })) { actions.replaceAll({ ...emptyState(), profile: app.profile }); toast("Datos borrados", "info"); onClose(); } };
  return html`<${Modal} open=${open} onClose=${onClose} title="Tu perfil" width=${440}>
    <div className="field"><label htmlFor="pf-n">Nombre</label><input id="pf-n" className="input" maxLength=${40} value=${name} onChange=${(e) => setName(e.target.value)} /></div>
    <div className="field"><label htmlFor="pf-e">Correo (opcional)</label><input id="pf-e" type="email" className="input" value=${email} onChange=${(e) => setEmail(e.target.value)} /></div>
    ${err && html`<p className="err"><${Icon} name="alert" size=${13} />${err}</p>`}
    <p className="xs muted" style=${{ margin: "0 0 14px" }}>${cloud ? "Tus datos se guardan en tu espacio privado: nadie más puede verlos, aunque compartas el enlace." : "Tus datos se guardan en este navegador."}</p>
    <div className="modal-f" style=${{ justifyContent: "space-between" }}>
      <div className="row wrap"><button className="btn sm ghost" onClick=${demo}>Cargar demo</button><button className="btn sm ghost" style=${{ color: "#ff8a8a" }} onClick=${wipe}>Borrar todo</button></div>
      <button className="btn primary" onClick=${save}>Guardar perfil</button>
    </div>
  <//>`;
}

/* =========================================================
   BIENVENIDA: empezar con datos propios o con ejemplo
   ========================================================= */
// Estado del PRIMER USO: vacío y con onboarded=false para mostrar la bienvenida.
function firstRun() { const s = emptyState(); s.settings.onboarded = false; return s; }
// BIENVENIDA (solo se muestra si settings.onboarded es false).
// - "Empezar con mis datos": deja todo vacío, guarda el nombre y pone el foco en el monto.
// - "Ver con datos de ejemplo": carga la demo.
// - Si ya había datos guardados: permite empezar de cero o conservarlos.
function Welcome() {
  const app = useApp();
  const open = !app.settings.onboarded;
  const [name, setName] = useState("");
  const hasData = app.transactions.length > 0;
  // Nombre escrito (o el actual si se dejó vacío).
  const nm = () => (name.trim() ? name.trim().slice(0, 40) : app.profile.name);
  // Empezar desde cero con datos propios.
  const start = () => { actions.replaceAll({ ...emptyState(), profile: { ...app.profile, name: nm() } }); toast("Listo. Registra tu primer movimiento para empezar"); setTimeout(() => { const el = document.getElementById("qf-amount"); el && el.focus(); }, 250); };
  // Conservar los datos actuales y no volver a mostrar la bienvenida.
  const keep = () => { actions.setProfile({ name: nm() }); actions.setSettings({ onboarded: true }); };
  // Cargar datos de ejemplo.
  const demo = () => { actions.replaceAll({ ...buildDemo(), profile: { ...app.profile, name: nm() } }); };
  return html`<${Modal} open=${open} onClose=${hasData ? keep : start} title="Bienvenido a Finanzas" width=${460}>
    <p className="muted" style=${{ marginTop: 0 }}>${hasData ? "Tienes datos guardados, posiblemente los de ejemplo. Puedes empezar desde cero con tus propios movimientos o conservarlos." : "Empieza con la app vacía y registra tus propios ingresos y gastos, o explórala primero con datos de ejemplo."}</p>
    <div className="field"><label htmlFor="wl-n">¿Cómo te llamas?</label><input id="wl-n" className="input" maxLength=${40} placeholder="Tu nombre" value=${name} onChange=${(e) => setName(e.target.value)} /></div>
    <div style=${{ display: "grid", gap: 8 }}>
      <button className="btn primary block" onClick=${start}>${hasData ? "Empezar desde cero con mis datos" : "Empezar con mis datos"}</button>
      <button className="btn ghost block" onClick=${hasData ? keep : demo}>${hasData ? "Conservar los datos actuales" : "Ver con datos de ejemplo"}</button>
    </div>
  <//>`;
}
// AVISO "Estás viendo datos de ejemplo" con botón para borrarlos y empezar.
// Solo aparece si los datos actuales son la demo (isDemo).
function DemoBanner() {
  const app = useApp();
  if (!app.isDemo || !app.settings.onboarded) return null;
  const clear = async () => {
    if (await confirmAsk({ title: "Empezar con tus datos", body: "Se borrarán los movimientos, presupuestos, metas y deudas de ejemplo para que registres los tuyos.", confirmLabel: "Borrar ejemplos", danger: true })) {
      actions.replaceAll({ ...emptyState(), profile: app.profile }); toast("Listo. Ya puedes registrar tus propios movimientos");
    }
  };
  return html`<div className="card" role="region" aria-label="Datos de ejemplo" style=${{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16, padding: "12px 16px", borderColor: "var(--primary-line)" }}>
    <${Icon} name="info" style=${{ color: "var(--primary-l)" }} />
    <span style=${{ flex: "1 1 240px" }}>Estás viendo datos de ejemplo. Bórralos cuando quieras empezar con tus propias finanzas.</span>
    <button className="btn sm primary" onClick=${clear}>Empezar con mis datos</button>
  </div>`;
}

/* =========================================================
   CABECERA, NAVEGACIÓN Y APP
   ========================================================= */
// Secciones de la app: [id, nombre en escritorio, nombre corto en móvil, ícono].
const VIEWS = [
  ["dashboard", "Resumen", "Resumen", "home"],
  ["movements", "Movimientos", "Movim.", "list"],
  ["budgets", "Presupuestos", "Presup.", "target"],
  ["goals", "Ahorro y deudas", "Metas", "wallet"],
  ["calendar", "Calendario", "Calend.", "calendar"],
  ["analysis", "Análisis", "Análisis", "chart"],
];
// CABECERA: nombre, fecha de hoy, selector de mes (anterior / actual / siguiente),
// Exportar, Agregar movimiento y avatar con las iniciales del nombre (abre el perfil).
function Header({ ym, setYm, onAdd, onProfile, onExport }) {
  const app = useApp();
  // Fecha larga en español: "Viernes 25 de septiembre de 2026".
  const today = cap(new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()).replace(",", ""));
  // Iniciales del nombre para el avatar: "Sebastian Lopez" -> "SL".
  const initials = (app.profile.name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";
  return html`<header className="header">
    <div className="brand"><h1>Finanzas</h1><span className="today">${today}</span></div>
    <div className="period" role="group" aria-label="Periodo">
      <button className="icon-btn sm" aria-label="Mes anterior" onClick=${() => setYm(shiftYM(ym, -1))}><${Icon} name="left" size=${16} /></button>
      <button className="lbl" onClick=${() => setYm(currentYM())} title="Volver al mes actual" aria-label=${`Periodo: ${ymLabel(ym)}. Volver al mes actual`}>${ymLabel(ym)}</button>
      <button className="icon-btn sm" aria-label="Mes siguiente" onClick=${() => setYm(shiftYM(ym, 1))}><${Icon} name="right" size=${16} /></button>
    </div>
    <button className="btn hide-sm" onClick=${onExport}><${Icon} name="download" size=${16} />Exportar</button>
    <button className="btn primary" onClick=${onAdd} aria-label="Agregar movimiento"><${Icon} name="plus" /><span className="hide-sm">Agregar movimiento</span></button>
    <button className="avatar" onClick=${onProfile} aria-label=${`Perfil de ${app.profile.name}`}>${initials}</button>
  </header>`;
}

// PANTALLA DE CARGA: bloques grises animados con la forma del dashboard mientras llegan los datos.
function Skeleton() {
  const b = (h, extra = {}) => html`<div className="sk" style=${{ height: h, ...extra }}></div>`;
  return html`<div className="app" aria-busy="true" aria-label="Cargando tus finanzas">
    <div className="row" style=${{ marginBottom: 22, justifyContent: "space-between" }}>${b(40, { width: 200 })}${b(40, { width: 260 })}</div>
    <div className="dash">
      <div className="a-form">${b(460)}</div>
      <div className="a-main">
        <div className="grid-kpi">${b(116)}${b(116)}${b(116)}</div>
        <div className="grid-2">${b(260)}${b(260)}</div>${b(220)}
      </div>
      <div className="a-list">${b(560)}</div>
    </div></div>`;
}

// APLICACIÓN PRINCIPAL.
// Estado de la interfaz:
// - ym: mes elegido (afecta todo el dashboard).
// - view: sección visible.
// - txModal: modal de crear/editar movimiento ({} = nuevo, {tx} = editar, null = cerrado).
// - exp: modal de exportar. profile: modal de perfil.
function App({ cloud }) {
  const [ym, setYm] = useState(currentYM());
  const [view, setView] = useState("dashboard");
  const [txModal, setTxModal] = useState(null);
  const [exp, setExp] = useState(null);
  const [profile, setProfile] = useState(false);
  // Cambia de sección y sube al inicio de la página.
  const go = (v) => { setView(v); window.scrollTo({ top: 0, behavior: "smooth" }); };
  // Abre el modal para editar un movimiento.
  const edit = (tx) => setTxModal({ tx });
  useEffect(() => {
    // Atajo de teclado: la tecla N abre un movimiento nuevo (si no se está escribiendo en un campo).
    const onKey = (e) => { if (e.key === "n" && !e.metaKey && !e.ctrlKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !modalStack.length) { e.preventDefault(); setTxModal({}); } };
    document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey);
  }, []);
  // Según la sección elegida se arma el contenido:
  // - Resumen: 3 columnas (formulario | KPI, gráficos, presupuestos, ahorro, análisis | movimientos).
  // - Movimientos, Presupuestos, Ahorro y deudas, Calendario y Análisis: vistas completas.
  // Después se dibujan la cabecera, la navegación (arriba en escritorio, abajo en móvil),
  // el aviso de demo, los modales, la bienvenida, las confirmaciones y los avisos.
  let body;
  if (view === "dashboard") body = html`<div className="dash">
    <aside className="a-form" aria-labelledby="qf-t"><section className="card"><div className="card-h"><h2 id="qf-t" className="ttl">Cargar movimiento</h2></div><${TransactionForm} idPrefix="qf" /></section></aside>
    <main className="a-main">
      <${FinancialSummary} ym=${ym} />
      <div className="grid-2"><${CategoryChart} ym=${ym} /><${MonthlyChart} ym=${ym} onPick=${setYm} /></div>
      <${BudgetSection} ym=${ym} compact onMore=${() => go("budgets")} />
      <div className="grid-2"><${SavingsCard} ym=${ym} /><${FinancialAnalysis} ym=${ym} limit=${4} onMore=${() => go("analysis")} /></div>
    </main>
    <aside className="a-list"><${RecentPanel} ym=${ym} onEdit=${edit} onAll=${() => go("movements")} /></aside>
  </div>`;
  else if (view === "movements") body = html`<main><${MovementsView} onEdit=${edit} onExport=${(f) => setExp(f)} /></main>`;
  else if (view === "budgets") body = html`<main className="stack"><${BudgetSection} ym=${ym} /><${CategoriesSection} /></main>`;
  else if (view === "goals") body = html`<main className="stack"><div className="grid-2"><${SavingsCard} ym=${ym} full /><${GoalsSection} /></div><${DebtSection} /></main>`;
  else if (view === "calendar") body = html`<main><${CalendarView} ym=${ym} setYm=${setYm} onEdit=${edit} /></main>`;
  else body = html`<main className="stack"><${FinancialSummary} ym=${ym} /><div className="grid-2"><${FinancialAnalysis} ym=${ym} /><div className="stack"><${StatsCard} ym=${ym} /><${MonthlyChart} ym=${ym} onPick=${setYm} /></div></div></main>`;
  return html`<div className="app">
    <${Header} ym=${ym} setYm=${setYm} onAdd=${() => setTxModal({})} onProfile=${() => setProfile(true)} onExport=${() => setExp({})} />
    <nav className="nav" aria-label="Secciones">${VIEWS.map(([k, l, , ic]) => html`<button key=${k} aria-current=${view === k ? "page" : undefined} onClick=${() => go(k)}><${Icon} name=${ic} size=${16} />${l}</button>`)}</nav>
    <${DemoBanner} />
    ${body}
    <nav className="bnav" aria-label="Secciones">${VIEWS.map(([k, l, s, ic]) => html`<button key=${k} aria-current=${view === k ? "page" : undefined} aria-label=${l} onClick=${() => go(k)}><${Icon} name=${ic} size=${20} /><span aria-hidden="true">${s}</span></button>`)}</nav>
    <${Modal} open=${!!txModal} onClose=${() => setTxModal(null)} title=${txModal && txModal.tx ? "Editar movimiento" : "Nuevo movimiento"} width=${460}>
      ${txModal && html`<${TransactionForm} key=${txModal.tx ? txModal.tx.id : "new"} idPrefix="mf" initial=${txModal.tx} onDone=${() => setTxModal(null)} />`}
    <//>
    <${ExportModal} open=${!!exp} onClose=${() => setExp(null)} ym=${ym} preset=${exp} />
    <${ProfileModal} open=${profile} onClose=${() => setProfile(false)} cloud=${cloud} />
    <${Welcome} /><${ConfirmHost} /><${ToastHost} />
  </div>`;
}

/* =========================================================
   ARRANQUE: carga local inmediata, luego sincroniza con la nube
   ========================================================= */
// ARRANQUE DE LA APP.
// Paso 1: si hay datos en el navegador, se muestran de inmediato.
// Paso 2: intenta conectar con la nube (máximo 4 s de espera).
// Paso 3a: sin nube (localhost o sin conexión): si no había nada, crea el estado de primer uso.
//          En segundo plano sigue intentando conectar por si la nube responde tarde.
// Paso 3b: con nube: descarga los datos; si la nube está vacía, sube lo que hay localmente.
// Mientras no haya datos se muestra el Skeleton.
function Root() {
  const s = useApp();
  const [cloud, setCloud] = useState(false);
  useEffect(() => {
    let done = false;
    const local = Storage.loadLocal();
    if (local) { store.init(local); }
    const timeout = new Promise((r) => setTimeout(() => r("timeout"), 4000));
    (async () => {
      let ok = false;
      try { ok = (await Promise.race([Storage.connect(), timeout])) === true; } catch { ok = false; }
      if (!ok) {
        if (!store.get()) { const s0 = firstRun(); store.init(s0); Storage.saveLocal(s0); }
        // Si la nube responde tarde, seguimos intentando conectar en segundo plano
        Storage.connect().then(async (late) => { if (late && !done) await attach(); }).catch(() => {});
        return;
      }
      await attach();
    })();
    // Conecta los datos con la nube:
    // descarga lo guardado o, si no hay nada, sube los datos locales.
    async function attach() {
      done = true;
      try {
        const remote = await Storage.loadRemote();
        if (remote) { store.init(remote); Storage.saveLocal(remote); }
        else { const base = store.get() || firstRun(); if (!store.get()) store.init(base); await Storage.pushAll(base); }
        setCloud(true);
      } catch { if (!store.get()) { const s0 = firstRun(); store.init(s0); Storage.saveLocal(s0); } }
    }
  }, []);
  if (!s) return html`<${Skeleton} />`;
  return html`<${App} cloud=${cloud} />`;
}
// Punto de entrada: monta la aplicación dentro de <div id="root">.
ReactDOM.createRoot(document.getElementById("root")).render(html`<${Root} />`);
