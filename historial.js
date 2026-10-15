/* ============================================================
   js/historial.js
   Filtros, historial completo y categorías personalizadas.
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   FILTROS + HISTORIAL
   ========================================================= */
// Filtros vacíos: texto, tipo, categoría, método de pago y rango de fechas.
const emptyFilters = () => ({ q: "", type: "all", cat: "", pay: "", from: "", to: "" });
// APLICA LOS FILTROS a una lista de movimientos (sin recargar la página).
// Paso 1: descarta los que no coinciden con tipo, categoría, método o fechas.
// Paso 2: buscador: junta en un solo texto la nota, categoría, método, monto y fecha
//         y revisa si contiene lo escrito (sin distinguir mayúsculas).
function applyFilters(txs, f, cats) {
  const q = f.q.trim().toLowerCase();
  return txs.filter((t) => {
    if (f.type !== "all" && t.type !== f.type) return false;
    if (f.cat && t.categoryId !== f.cat) return false;
    if (f.pay && t.paymentMethod !== f.pay) return false;
    if (f.from && t.date < f.from) return false;
    if (f.to && t.date > f.to) return false;
    if (q) {
      const hay = [t.description, catName(cats, t.categoryId), payName(t.paymentMethod), String(t.amount), groupThousands(t.amount), dayLabel(t.date)].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
// Caja de búsqueda con ícono de lupa y etiqueta accesible (oculta visualmente).
function SearchBox({ value, onChange, id }) {
  return html`<div className="search"><${Icon} name="search" size=${15} />
    <label htmlFor=${id} className="sr-only">Buscar movimiento</label>
    <input id=${id} type="search" className="input" placeholder="Buscar movimiento..." value=${value} onChange=${(e) => onChange(e.target.value)} /></div>`;
}
// PANEL DERECHO "MOVIMIENTOS DEL MES".
// Paso 1: toma los movimientos del mes elegido.
// Paso 2: aplica el filtro de tipo (Todos/Gastos/Ingresos) y la búsqueda.
// Paso 3: muestra la lista, el conteo y el enlace al historial completo.
function RecentPanel({ ym, onEdit, onAll }) {
  const app = useApp();
  const [type, setType] = useState("all");
  const [q, setQ] = useState("");
  const month = useMemo(() => F.inMonth(app.transactions, ym), [app.transactions, ym]);
  const list = useMemo(() => applyFilters(month, { ...emptyFilters(), type, q }, app.categories), [month, type, q, app.categories]);
  return html`<section className="card" aria-labelledby="rp-t">
    <div className="card-h" style=${{ marginBottom: 10 }}><h2 id="rp-t" className="ttl">Movimientos del mes</h2>
      <label htmlFor="rp-type" className="sr-only">Filtrar por tipo</label>
      <select id="rp-type" className="input" style=${{ width: "auto", height: 30, fontSize: 12.5, borderRadius: 999, padding: "0 10px" }} value=${type} onChange=${(e) => setType(e.target.value)}>
        <option value="all">Todos</option><option value="expense">Gastos</option><option value="income">Ingresos</option>
      </select></div>
    <${SearchBox} id="rp-q" value=${q} onChange=${setQ} />
    <div className="scroll-y" style=${{ marginTop: 8 }}>
      ${month.length && !list.length
        ? html`<${Empty} icon="search" title="Sin resultados" text="Ningún movimiento coincide con la búsqueda." />`
        : html`<${TransactionList} txs=${list} onEdit=${onEdit} />`}
    </div>
    <div className="row" style=${{ justifyContent: "space-between", marginTop: 10 }}>
      <span className="xs muted">${list.length} de ${month.length} en ${monthName(ym)}</span>
      <button className="link" onClick=${onAll}>Ver historial completo</button>
    </div>
  </section>`;
}
// HISTORIAL COMPLETO con todos los filtros.
// - f: filtros actuales. - n: cuántos se muestran (se cargan de 60 en 60).
// Muestra totales del resultado filtrado y permite exportar con el rango elegido.
function MovementsView({ onEdit, onExport }) {
  const app = useApp();
  const [f, setF] = useState(emptyFilters());
  // Cambia un filtro.
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  // Resultado filtrado; se recalcula solo cuando cambian los datos o los filtros.
  const list = useMemo(() => applyFilters(app.transactions, f, app.categories), [app.transactions, f, app.categories]);
  const T = F.totals(list);
  const [n, setN] = useState(60);
  // Al cambiar los filtros vuelve a mostrar solo los primeros 60.
  useEffect(() => setN(60), [f]);
  // ¿Hay algún filtro activo? (para mostrar "Limpiar filtros").
  const active = JSON.stringify(f) !== JSON.stringify(emptyFilters());
  // Error si la fecha "Desde" es posterior a "Hasta".
  const rangeBad = f.from && f.to && f.from > f.to;
  return html`<div className="stack">
    <section className="card" aria-labelledby="mv-t">
      <div className="card-h"><h2 id="mv-t" className="ttl">Historial de movimientos</h2>
        <button className="btn sm" onClick=${() => onExport(f)}><${Icon} name="download" size=${15} />Exportar</button></div>
      <div className="filters">
        <div className="field" style=${{ gridColumn: "1 / -1" }}><${SearchBox} id="mv-q" value=${f.q} onChange=${(v) => set("q", v)} /></div>
        <div className="field"><span className="lbl" id="mv-type-l">Tipo</span>
          <div className="seg pill" role="group" aria-labelledby="mv-type-l" style=${{ display: "grid", gridAutoFlow: "column" }}>
            ${[["all", "Todos"], ["income", "Ingresos"], ["expense", "Gastos"]].map(([k, l]) => html`<button key=${k} aria-pressed=${f.type === k} onClick=${() => setF((p) => ({ ...p, type: k, cat: k !== "all" && p.cat && catOf(app.categories, p.cat).type !== k ? "" : p.cat }))}>${l}</button>`)}
          </div></div>
        <div className="field"><label htmlFor="mv-cat">Categoría</label>
          <select id="mv-cat" className="input" value=${f.cat} onChange=${(e) => set("cat", e.target.value)}>
            <option value="">Todas</option>
            ${app.categories.filter((c) => f.type === "all" || c.type === f.type).map((c) => html`<option key=${c.id} value=${c.id}>${c.name}${f.type === "all" ? (c.type === "income" ? " (ingreso)" : "") : ""}</option>`)}
          </select></div>
        <div className="field"><label htmlFor="mv-pay">Método de pago</label>
          <select id="mv-pay" className="input" value=${f.pay} onChange=${(e) => set("pay", e.target.value)}>
            <option value="">Todos</option>${PAYMENT_METHODS.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}
          </select></div>
        <div className="field"><label htmlFor="mv-from">Desde</label><input id="mv-from" type="date" className="input" value=${f.from} onChange=${(e) => set("from", e.target.value)} aria-invalid=${!!rangeBad} /></div>
        <div className="field"><label htmlFor="mv-to">Hasta</label><input id="mv-to" type="date" className="input" value=${f.to} onChange=${(e) => set("to", e.target.value)} aria-invalid=${!!rangeBad} /></div>
      </div>
      ${rangeBad && html`<p className="err" style=${{ marginTop: 8 }}><${Icon} name="alert" size=${13} />La fecha "Desde" es posterior a "Hasta".</p>`}
      <div className="summary-line">
        <span><b className="num">${list.length}</b> movimientos</span>
        <span>Ingresos <b className="num" style=${{ color: "var(--success)" }}>${money(T.income)}</b></span>
        <span>Gastos <b className="num">${money(T.expense)}</b></span>
        <span>Balance <b className="num">${money(T.balance)}</b></span>
        ${active && html`<button className="link" onClick=${() => setF(emptyFilters())}>Limpiar filtros</button>`}
      </div>
    </section>
    <section className="card" aria-label="Resultados">
      ${app.transactions.length && !list.length
        ? html`<${Empty} icon="search" title="Sin resultados" text="Prueba con otros filtros o limpia la búsqueda."><button className="btn sm" onClick=${() => setF(emptyFilters())}>Limpiar filtros</button><//>`
        : html`<${TransactionList} txs=${[...list].sort(sortTx).slice(0, n)} onEdit=${onEdit} />`}
      ${list.length > n && html`<div style=${{ textAlign: "center", marginTop: 10 }}><button className="btn sm" onClick=${() => setN(n + 60)}>Mostrar más (${list.length - n} restantes)</button></div>`}
    </section>
  </div>`;
}

/* =========================================================
   CATEGORÍAS PERSONALIZADAS
   ========================================================= */
// GESTIÓN DE CATEGORÍAS: crear categorías propias (de gasto o ingreso)
// y eliminar las personalizadas (las predeterminadas no se pueden borrar).
function CategoriesSection() {
  const app = useApp();
  const [name, setName] = useState(""), [type, setType] = useState("expense");
  // Crea la categoría escrita y limpia el campo.
  const add = (e) => { e.preventDefault(); try { const c = actions.addCategory({ name, type }); setName(""); toast(`Categoría "${c.name}" creada`); } catch (err) { toast(err.message, "danger"); } };
  // Elimina una categoría personalizada.
  // Paso 1: cuenta cuántos movimientos la usan y avisa a dónde pasarán.
  // Paso 2: si confirma, la elimina (los movimientos pasan a Otros/Otros ingresos).
  const del = async (c) => {
    const n = app.transactions.filter((t) => t.categoryId === c.id).length;
    const ok = await confirmAsk({ title: "Eliminar categoría", body: n ? `"${c.name}" tiene ${n} movimiento${n > 1 ? "s" : ""}. Pasarán a "${catName(app.categories, FALLBACK_CAT[c.type])}".` : `Se eliminará la categoría "${c.name}".`, confirmLabel: "Eliminar", danger: true });
    if (ok) { actions.deleteCategory(c.id); toast("Categoría eliminada", "info"); }
  };
  return html`<section className="card" aria-labelledby="ct-t">
    <div className="card-h"><h2 id="ct-t" className="ttl">Tus categorías</h2></div>
    <form className="row wrap" onSubmit=${add} style=${{ marginBottom: 14 }}>
      <label htmlFor="ct-n" className="sr-only">Nombre de la categoría</label>
      <input id="ct-n" className="input" style=${{ flex: "1 1 180px" }} maxLength=${30} placeholder="Nueva categoría" value=${name} onChange=${(e) => setName(e.target.value)} />
      <label htmlFor="ct-ty" className="sr-only">Tipo</label>
      <select id="ct-ty" className="input" style=${{ flex: "0 1 130px" }} value=${type} onChange=${(e) => setType(e.target.value)}><option value="expense">Gasto</option><option value="income">Ingreso</option></select>
      <button className="btn primary" type="submit"><${Icon} name="plus" size=${15} />Crear</button>
    </form>
    ${["expense", "income"].map((ty) => html`<div key=${ty} style=${{ marginBottom: 10 }}>
      <p className="xs muted" style=${{ margin: "0 0 6px" }}>${ty === "expense" ? "Gastos" : "Ingresos"}</p>
      <div className="chips">${app.categories.filter((c) => c.type === ty).map((c) => html`<span key=${c.id} className="chip" style=${{ cursor: "default" }}>
        <i className="dot" style=${{ background: c.color }}></i>${c.name}
        ${c.custom && html`<button className="icon-btn sm" style=${{ width: 20, height: 20, marginRight: -6 }} aria-label=${`Eliminar categoría ${c.name}`} onClick=${() => del(c)}><${Icon} name="x" size=${12} /></button>`}
      </span>`)}</div></div>`)}
  </section>`;
}
