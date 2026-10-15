/* ============================================================
   js/ui-base.js
   Componentes base: íconos, avisos (toasts), confirmaciones, modal y campos.
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   ICONOS (trazos de Lucide, inline)
   ========================================================= */
// ÍCONOS: trazos SVG copiados del estilo Lucide, guardados como datos.
// Cada ícono es una lista de piezas: ["path", {d: ...}], ["circle", {...}], ["rect", {...}].
// Así no hace falta descargar ninguna librería de íconos.
const ICONS = {
  plus: [["path", { d: "M5 12h14" }], ["path", { d: "M12 5v14" }]],
  x: [["path", { d: "M18 6 6 18" }], ["path", { d: "m6 6 12 12" }]],
  pencil: [["path", { d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" }], ["path", { d: "m15 5 4 4" }]],
  trash: [["path", { d: "M3 6h18" }], ["path", { d: "M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" }], ["path", { d: "M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" }]],
  copy: [["rect", { x: 9, y: 9, width: 13, height: 13, rx: 2 }], ["path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" }]],
  search: [["circle", { cx: 11, cy: 11, r: 8 }], ["path", { d: "m21 21-4.3-4.3" }]],
  left: [["path", { d: "m15 18-6-6 6-6" }]],
  right: [["path", { d: "m9 18 6-6-6-6" }]],
  calendar: [["rect", { x: 3, y: 4, width: 18, height: 18, rx: 2 }], ["path", { d: "M16 2v4" }], ["path", { d: "M8 2v4" }], ["path", { d: "M3 10h18" }]],
  home: [["rect", { x: 3, y: 3, width: 7, height: 9, rx: 1 }], ["rect", { x: 14, y: 3, width: 7, height: 5, rx: 1 }], ["rect", { x: 14, y: 12, width: 7, height: 9, rx: 1 }], ["rect", { x: 3, y: 16, width: 7, height: 5, rx: 1 }]],
  list: [["path", { d: "M8 6h13" }], ["path", { d: "M8 12h13" }], ["path", { d: "M8 18h13" }], ["path", { d: "M3 6h.01" }], ["path", { d: "M3 12h.01" }], ["path", { d: "M3 18h.01" }]],
  target: [["circle", { cx: 12, cy: 12, r: 10 }], ["circle", { cx: 12, cy: 12, r: 6 }], ["circle", { cx: 12, cy: 12, r: 2 }]],
  wallet: [["path", { d: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" }], ["path", { d: "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" }]],
  card: [["rect", { x: 2, y: 5, width: 20, height: 14, rx: 2 }], ["path", { d: "M2 10h20" }]],
  download: [["path", { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }], ["path", { d: "m7 10 5 5 5-5" }], ["path", { d: "M12 15V3" }]],
  up: [["path", { d: "m22 7-8.5 8.5-5-5L2 17" }], ["path", { d: "M16 7h6v6" }]],
  down: [["path", { d: "m22 17-8.5-8.5-5 5L2 7" }], ["path", { d: "M16 17h6v-6" }]],
  check: [["path", { d: "M20 6 9 17l-5-5" }]],
  alert: [["path", { d: "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" }], ["path", { d: "M12 9v4" }], ["path", { d: "M12 17h.01" }]],
  bulb: [["path", { d: "M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" }], ["path", { d: "M9 18h6" }], ["path", { d: "M10 22h4" }]],
  chart: [["path", { d: "M3 3v18h18" }], ["path", { d: "M18 17V9" }], ["path", { d: "M13 17V5" }], ["path", { d: "M8 17v-3" }]],
  tag: [["path", { d: "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" }], ["circle", { cx: 7.5, cy: 7.5, r: 0.5 }]],
  info: [["circle", { cx: 12, cy: 12, r: 10 }], ["path", { d: "M12 16v-4" }], ["path", { d: "M12 8h.01" }]],
  undo: [["path", { d: "M9 14 4 9l5-5" }], ["path", { d: "M4 9h10.5a5.5 5.5 0 0 1 0 11H11" }]],
};
// Componente que dibuja un ícono por nombre.
// Paso 1: crea un <svg> de 24x24 que usa el color del texto (currentColor).
// Paso 2: dibuja cada pieza del ícono. aria-hidden lo oculta a lectores de pantalla
// (el botón que lo contiene lleva su propia etiqueta aria-label).
function Icon({ name, size = 18, ...rest }) {
  return React.createElement("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true", focusable: "false", ...rest },
    (ICONS[name] || []).map(([t, a], i) => React.createElement(t, { key: i, ...a })));
}

/* =========================================================
   TOASTS y CONFIRMACIONES
   ========================================================= */
// TOASTS (avisos flotantes). toastBus es un pequeño "canal" global:
// - items: avisos visibles. - subs: componentes que escuchan cambios.
const toastBus = { subs: new Set(), items: [] };
// Muestra un aviso. tone: "success" (verde), "danger" (rojo) o "info".
// Paso 1: crea el aviso con un id y lo agrega (máximo 4 visibles).
// Paso 2: avisa a los que escuchan para redibujar.
// Paso 3: lo quita solo después de 3,8 s (6 s si tiene botón, como "Deshacer").
function toast(text, tone = "success", action) {
  const id = uid();
  toastBus.items = [...toastBus.items, { id, text, tone, action }].slice(-4);
  toastBus.subs.forEach((f) => f());
  setTimeout(() => dismissToast(id), action ? 6000 : 3800);
}
// Quita un aviso por su id y redibuja.
function dismissToast(id) { toastBus.items = toastBus.items.filter((t) => t.id !== id); toastBus.subs.forEach((f) => f()); }
// Dibuja la pila de avisos en la esquina.
// role="status" + aria-live="polite" hace que los lectores de pantalla los anuncien.
function ToastHost() {
  const items = useSyncExternalStore((f) => { toastBus.subs.add(f); return () => toastBus.subs.delete(f); }, () => toastBus.items);
  const ic = { success: "check", danger: "alert", info: "info" };
  return html`<div className="toasts" role="status" aria-live="polite">
    ${items.map((t) => html`<div key=${t.id} className=${"toast " + t.tone}>
      <${Icon} name=${ic[t.tone] || "info"} />
      <span>${t.text}</span>
      <div className="row" style=${{ gap: 2 }}>
        ${t.action && html`<button className="btn ghost sm" onClick=${() => { t.action.run(); dismissToast(t.id); }}>${t.action.label}</button>`}
        <button className="icon-btn sm" aria-label="Cerrar aviso" onClick=${() => dismissToast(t.id)}><${Icon} name="x" size=${15} /></button>
      </div>
    </div>`)}
  </div>`;
}

// CONFIRMACIONES: permite pedir confirmación desde cualquier lugar con
//   const ok = await confirmAsk({ title, body, confirmLabel, danger })
// setConfirmState lo conecta ConfirmHost al dibujarse.
let setConfirmState = null;
// Devuelve una Promesa que se resuelve con true (Confirmar) o false (Cancelar).
// Guarda la función "res" para llamarla cuando el usuario elija.
const confirmAsk = (opts) => new Promise((res) => setConfirmState({ ...opts, res }));
// Ventana de confirmación única para toda la app.
// Al cerrar (por botón, Esc o clic fuera) responde a la promesa y se oculta.
function ConfirmHost() {
  const [c, setC] = useState(null);
  setConfirmState = setC;
  const close = (v) => { if (c) c.res(v); setC(null); };
  return html`<${Modal} open=${!!c} onClose=${() => close(false)} title=${c ? c.title : ""} width=${420}>
    ${c && html`<p className="muted" style=${{ marginTop: 0 }}>${c.body}</p>
    <div className="modal-f">
      <button className="btn ghost" onClick=${() => close(false)}>Cancelar</button>
      <button className=${"btn " + (c.danger ? "danger" : "primary")} onClick=${() => close(true)}>${c.confirmLabel || "Confirmar"}</button>
    </div>`}
  <//>`;
}

/* =========================================================
   MODAL accesible (Esc, foco atrapado, restaura foco)
   ========================================================= */
// Pila de modales abiertos. Sirve para que Esc y Tab solo afecten
// al modal de más arriba cuando hay uno encima de otro (ej. confirmar dentro de editar).
const modalStack = [];
// MODAL ACCESIBLE reutilizable (ventana emergente).
// Props: open (visible o no), onClose (cerrar), title (título), width (ancho máximo).
function Modal({ open, onClose, title, children, width = 520 }) {
  // ref: el contenedor del modal. closeRef: siempre la última función de cerrar.
  // idRef: id único para enlazar el título con aria-labelledby.
  const ref = useRef(null), closeRef = useRef(onClose), idRef = useRef("m" + uid().slice(0, 6));
  closeRef.current = onClose;
  useEffect(() => {
    // Al abrirse el modal:
    // Paso 1: se registra en la pila y recuerda qué elemento tenía el foco.
    if (!open) return;
    const me = idRef.current; modalStack.push(me);
    const last = document.activeElement;
    const el = ref.current;
    // Paso 2: pone el foco en el primer campo o botón del modal.
    const first = el && el.querySelector("input:not([type=hidden]),select,textarea,.modal-f button,button:not(.modal-x)");
    first && first.focus();
    // Paso 3: manejo de teclado (solo si es el modal de arriba):
    // - Esc cierra.
    // - Tab y Shift+Tab "dan la vuelta" dentro del modal (el foco no se escapa).
    const onKey = (e) => {
      if (modalStack[modalStack.length - 1] !== me) return;
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); }
      if (e.key === "Tab") {
        const items = [...el.querySelectorAll("button,input,select,textarea,[tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled && x.offsetParent !== null);
        if (!items.length) return;
        const a = items[0], b = items[items.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
        else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    // Paso 4: bloquea el scroll de la página de fondo.
    document.body.style.overflow = "hidden";
    return () => {
      // Al cerrarse: deja de escuchar teclas, sale de la pila,
      // devuelve el scroll y regresa el foco al botón que lo abrió.
      document.removeEventListener("keydown", onKey);
      const i = modalStack.indexOf(me); if (i >= 0) modalStack.splice(i, 1);
      if (!modalStack.length) document.body.style.overflow = "";
      last && last.focus && last.focus();
    };
  }, [open]);
  // Dibujo: si está cerrado no se dibuja nada.
  // Si está abierto se dibuja con un "portal" directo en <body> (encima de todo).
  // Hacer clic en el fondo oscuro también cierra.
  if (!open) return null;
  const hid = idRef.current + "-t";
  return ReactDOM.createPortal(html`<div className="overlay" onMouseDown=${(e) => { if (e.target === e.currentTarget) closeRef.current(); }}>
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby=${hid} ref=${ref} style=${{ maxWidth: width }}>
      <div className="modal-h"><h2 id=${hid}>${title}</h2>
        <button className="icon-btn modal-x" aria-label="Cerrar" onClick=${() => closeRef.current()}><${Icon} name="x" /></button></div>
      ${children}
    </div></div>`, document.body);
}

/* =========================================================
   CAMPOS
   ========================================================= */
// Campo de dinero reutilizable (metas, deudas, abonos).
// Muestra el símbolo $, formatea con puntos mientras se escribe y guarda solo dígitos.
// Si hay error lo muestra debajo y lo enlaza con aria-describedby.
function MoneyField({ id, label, value, onChange, error, placeholder = "0" }) {
  return html`<div className="field">
    <label htmlFor=${id}>${label}</label>
    <div className="search">
      <span aria-hidden="true" style=${{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)" }}>$</span>
      <input id=${id} className="input num" style=${{ paddingLeft: 26 }} inputMode="numeric" autoComplete="off" placeholder=${placeholder}
        value=${value === "" || value == null ? "" : groupThousands(Number(value))}
        aria-invalid=${!!error} aria-describedby=${error ? id + "-e" : undefined}
        onChange=${(e) => onChange(digitsOnly(e.target.value))} />
    </div>
    ${error && html`<span id=${id + "-e"} className="err"><${Icon} name="alert" size=${13} />${error}</span>`}
  </div>`;
}

// Campo pequeño para el presupuesto de cada categoría.
// Paso 1: guarda un "borrador" local mientras el usuario escribe.
// Paso 2: si el valor guardado cambia desde fuera, actualiza el borrador.
// Paso 3: guarda (commit) al salir del campo o con Enter; Esc deshace lo escrito.
// Vacío = "Sin límite".
function BudgetInput({ value, onCommit, label }) {
  const [draft, setDraft] = useState(value ? String(value) : "");
  useEffect(() => setDraft(value ? String(value) : ""), [value]);
  const commit = () => { const n = draft ? Number(draft) : null; if ((n || null) !== (value || null)) onCommit(n); };
  return html`<input className="bud-in num" inputMode="numeric" aria-label=${label} placeholder="Sin límite"
    value=${draft ? groupThousands(Number(draft)) : ""}
    onChange=${(e) => setDraft(digitsOnly(e.target.value))}
    onBlur=${commit}
    onKeyDown=${(e) => { if (e.key === "Enter") e.target.blur(); if (e.key === "Escape") { setDraft(value ? String(value) : ""); } }} />`;
}
