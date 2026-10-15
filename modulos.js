/* ============================================================
   js/modulos.js
   Presupuestos, ahorro, deudas, análisis y calendario.
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   PRESUPUESTOS
   ========================================================= */
// TARJETA DE PRESUPUESTO de una categoría.
// Paso 1: busca el presupuesto vigente (puede venir de un mes anterior).
// Paso 2: porcentaje usado = gastado / presupuesto × 100.
// Paso 3: estado: Normal, Advertencia, Crítico o Excedido (con texto e ícono, no solo color).
// Paso 4: el campo permite cambiar el presupuesto; se guarda al salir del campo.
function BudgetCard({ cat, ym, spent }) {
  const app = useApp();
  const b = F.budgetFor(app.budgets, cat.id, ym);
  const p = b.amount ? (spent / b.amount) * 100 : 0;
  const st = b.amount ? F.budgetStatus(p) : null;
  // Guarda el nuevo presupuesto para este mes y muestra un aviso.
  const commit = (n) => {
    try { actions.setBudget(cat.id, ym, n); toast(n ? `Presupuesto de ${cat.name} actualizado: ${money(n)}` : `${cat.name} quedó sin límite`); }
    catch (e) { toast(e.message, "danger"); }
  };
  return html`<div className=${"bud" + (st && st.key === "over" ? " over" : "")}>
    <div className="top">
      <div className="nm"><i className="dot" style=${{ background: cat.color }}></i><span>${cat.name}</span></div>
      <${BudgetInput} value=${b.amount} onCommit=${commit} label=${`Presupuesto mensual de ${cat.name}`} />
    </div>
    <div className=${"prog " + (st ? st.key : "")} role="progressbar" aria-label=${`Uso del presupuesto de ${cat.name}`}
      aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.min(100, Math.round(p))}>
      <i style=${{ width: b.amount ? `${Math.min(100, p)}%` : spent ? "100%" : "0%", background: b.amount ? undefined : "#3a3a3a" }}></i>
    </div>
    <div className="meta">
      ${b.amount
        ? html`<span className="num">${money(spent)} de ${money(b.amount)}${spent > b.amount ? html` · <b style=${{ color: "#ff8a8a" }}>superaste ${money(spent - b.amount)}</b>` : ` · quedan ${money(b.amount - spent)}`}</span>
               <span className=${"badge " + st.key}><${Icon} name=${st.icon} size=${11} />${st.label} ${pct(p)}</span>`
        : html`<span className="num">${money(spent)} · sin límite</span>`}
    </div>
    ${b.amount && b.inherited ? html`<span className="xs" style=${{ color: "var(--text-3)" }}>Se mantiene desde ${ymLabel(b.from)}</span>` : null}
  </div>`;
}
// SECCIÓN DE PRESUPUESTOS.
// Paso 1: suma lo gastado por categoría en el mes (spentMap).
// Paso 2: en el dashboard (compact) solo muestra categorías con gasto o presupuesto;
//         en la vista completa muestra todas las de gasto.
// Paso 3: calcula el total presupuestado, lo gastado en esas categorías y cuántas se excedieron.
function BudgetSection({ ym, compact, onMore }) {
  const app = useApp();
  const spentMap = useMemo(() => {
    const m = {}; F.inMonth(app.transactions, ym).forEach((t) => { if (t.type === "expense") m[t.categoryId] = (m[t.categoryId] || 0) + t.amount; }); return m;
  }, [app.transactions, ym]);
  let cats = app.categories.filter((c) => c.type === "expense");
  if (compact) cats = cats.filter((c) => spentMap[c.id] || F.budgetFor(app.budgets, c.id, ym).amount);
  const withB = app.categories.filter((c) => c.type === "expense").map((c) => ({ c, b: F.budgetFor(app.budgets, c.id, ym).amount })).filter((x) => x.b);
  const totB = withB.reduce((s, x) => s + x.b, 0), totS = withB.reduce((s, x) => s + (spentMap[x.c.id] || 0), 0);
  const overN = withB.filter((x) => (spentMap[x.c.id] || 0) > x.b).length;
  return html`<section className="card" aria-labelledby="bs-t">
    <div className="card-h"><h2 id="bs-t" className="ttl">Presupuestos por categoría</h2>
      <span className="xs muted">${totB ? `${money(totS)} de ${money(totB)} presupuestado${overN ? ` · ${overN} excedido${overN > 1 ? "s" : ""}` : ""}` : "Escribe un monto para fijar el límite mensual"}</span>
    </div>
    ${cats.length ? html`<div className="budgets">${cats.map((c) => html`<${BudgetCard} key=${c.id} cat=${c} ym=${ym} spent=${spentMap[c.id] || 0} />`)}</div>`
      : html`<${Empty} icon="target" title="Sin presupuestos este mes" text="Define un límite por categoría para controlar tus gastos." />`}
    ${compact && onMore && html`<div style=${{ marginTop: 12 }}><button className="link" onClick=${onMore}>Ver todas las categorías</button></div>`}
  </section>`;
}

/* =========================================================
   AHORRO
   ========================================================= */
// TARJETA DE AHORRO.
// Paso 1: ahorro del mes, del año y acumulado (gastos en la categoría Ahorro).
// Paso 2: progreso = ahorrado / meta × 100 (mensual en el anillo, anual en la barra).
// Paso 3: tasa de ahorro = ahorro del mes / ingresos del mes.
// Paso 4: el botón "Metas" abre un modal para cambiar la meta mensual y anual.
function SavingsCard({ ym, full }) {
  const app = useApp();
  const y = ym.slice(0, 4);
  const month = F.savings(F.inMonth(app.transactions, ym));
  const year = F.savings(F.inYear(app.transactions, y));
  const all = F.savings(app.transactions);
  const inc = F.totals(F.inMonth(app.transactions, ym)).income;
  const gm = app.settings.savings_monthly || 0, ga = app.settings.savings_annual || 0;
  const pm = gm ? (month / gm) * 100 : 0, pa = ga ? (year / ga) * 100 : 0;
  const [edit, setEdit] = useState(false);
  const [dm, setDm] = useState(""), [da, setDa] = useState("");
  // Abre el modal de metas con los valores actuales.
  const open = () => { setDm(gm ? String(gm) : ""); setDa(ga ? String(ga) : ""); setEdit(true); };
  // Guarda las metas de ahorro y cierra el modal.
  const save = () => { actions.setSettings({ savings_monthly: Number(dm || 0), savings_annual: Number(da || 0) }); setEdit(false); toast("Metas de ahorro actualizadas"); };
  return html`<section className="card" aria-labelledby="sv-t">
    <div className="card-h"><h2 id="sv-t" className="ttl">Ahorro</h2>
      <button className="btn ghost sm" onClick=${open}><${Icon} name="pencil" size=${14} />Metas</button></div>
    <div className="row" style=${{ gap: 18, alignItems: "center", flexWrap: "wrap" }}>
      <div className=${"ring" + (pm >= 100 ? " done" : "")} style=${{ "--p": Math.min(100, pm) }} role="img" aria-label=${`Progreso de la meta mensual: ${pct(pm)}`}>
        <div className="num">${gm ? pct(pm) : "—"}</div></div>
      <div style=${{ display: "grid", gap: 4, minWidth: 0 }}>
        <span className="small muted">Ahorrado en ${monthName(ym)}</span>
        <b className="num" style=${{ fontSize: 22 }}>${money(month)}</b>
        <span className="small muted num">${gm ? `Meta mensual ${money(gm)}${month < gm ? ` · faltan ${money(gm - month)}` : " · cumplida"}` : "Define una meta mensual"}</span>
      </div>
    </div>
    <div className="divider"></div>
    <div className="stats">
      <div className="stat"><span className="xs muted">Tasa de ahorro</span><b className="num">${inc ? pct((month / inc) * 100) : "—"}</b></div>
      <div className="stat"><span className="xs muted">Ahorro ${y}</span><b className="num">${money(year)}</b></div>
      ${full && html`<div className="stat"><span className="xs muted">Acumulado total</span><b className="num">${money(all)}</b></div>`}
    </div>
    ${ga ? html`<div style=${{ marginTop: 14, display: "grid", gap: 6 }}>
      <div className="row small" style=${{ justifyContent: "space-between" }}><span className="muted">Meta anual ${money(ga)}</span><span className="num">${pct(pa)}</span></div>
      <div className=${"prog lg" + (pa >= 100 ? " ok" : "")} role="progressbar" aria-label="Progreso de la meta anual" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.min(100, Math.round(pa))}><i style=${{ width: `${Math.min(100, pa)}%` }}></i></div>
    </div>` : null}
    <p className="xs" style=${{ color: "var(--text-3)", margin: "12px 0 0" }}>Se calcula con los gastos registrados en la categoría Ahorro.</p>
    <${Modal} open=${edit} onClose=${() => setEdit(false)} title="Metas de ahorro" width=${420}>
      <${MoneyField} id="g-m" label="Meta mensual" value=${dm} onChange=${setDm} />
      <${MoneyField} id="g-a" label="Meta anual" value=${da} onChange=${setDa} />
      <div className="modal-f"><button className="btn ghost" onClick=${() => setEdit(false)}>Cancelar</button><button className="btn primary" onClick=${save}>Guardar metas</button></div>
    <//>
  </section>`;
}

/* Metas de ahorro con nombre (SAVINGS_GOALS) */
// METAS DE AHORRO CON NOMBRE (ej. "Fondo de emergencia").
// - form: datos de la meta que se crea/edita (null = modal cerrado).
// - contrib: datos del abono en curso (null = modal cerrado).
// Cada tarjeta muestra progreso, días restantes, botón Abonar, Editar y Eliminar.
function GoalsSection() {
  const app = useApp();
  const [form, setForm] = useState(null);
  const [contrib, setContrib] = useState(null);
  // Convierte los montos a número y guarda la meta (crear o editar).
  const saveGoal = () => {
    try {
      actions.saveGoal({ ...form, target_amount: Number(form.target_amount || 0), current_amount: Number(form.current_amount || 0) });
      toast(form.id ? "Meta actualizada" : "Meta creada"); setForm(null);
    } catch (e) { toast(e.message, "danger"); }
  };
  // Registra el abono (y si se marcó, también el gasto de Ahorro).
  const doContrib = () => {
    try { actions.contributeGoal(contrib.id, Number(contrib.amount || 0), contrib.tx); toast(`Abono registrado en "${contrib.name}"`); setContrib(null); }
    catch (e) { toast(e.message, "danger"); }
  };
  // Pide confirmación y elimina la meta (los movimientos ya registrados se conservan).
  const del = async (g) => { if (await confirmAsk({ title: "Eliminar meta", body: `Se eliminará la meta "${g.name}". Los movimientos de ahorro ya registrados se conservan.`, confirmLabel: "Eliminar", danger: true })) { actions.deleteGoal(g.id); toast("Meta eliminada", "info"); } };
  return html`<section className="card" aria-labelledby="gl-t">
    <div className="card-h"><h2 id="gl-t" className="ttl">Metas de ahorro</h2>
      <button className="btn sm outline" onClick=${() => setForm({ name: "", target_amount: "", current_amount: "", deadline: "" })}><${Icon} name="plus" size=${14} />Nueva meta</button></div>
    ${!app.goals.length ? html`<${Empty} icon="target" title="Sin metas todavía" text="Crea una meta, como un fondo de emergencia, y abona a medida que ahorras." />`
      : html`<div className="items">${app.goals.map((g) => {
        const p = g.target_amount ? (g.current_amount / g.target_amount) * 100 : 0;
        const days = g.deadline ? daysBetween(todayISO(), g.deadline) : null;
        return html`<article key=${g.id} className="item">
          <div className="row" style=${{ justifyContent: "space-between" }}><h3>${g.name}</h3><span className=${"badge " + (p >= 100 ? "ok" : "")}>${p >= 100 ? html`<${Icon} name="check" size=${11} />Cumplida` : pct(p)}</span></div>
          <div className=${"prog lg" + (p >= 100 ? " ok" : "")} role="progressbar" aria-label=${`Progreso de ${g.name}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.min(100, Math.round(p))}><i style=${{ width: `${Math.min(100, p)}%` }}></i></div>
          <div className="kv">
            <div>Ahorrado<b className="num">${money(g.current_amount)}</b></div>
            <div>Meta<b className="num">${money(g.target_amount)}</b></div>
            <div>Fecha límite<b>${g.deadline ? dayLabel(g.deadline) + " " + g.deadline.slice(0, 4) : "—"}</b></div>
          </div>
          ${days !== null && p < 100 && html`<span className="xs muted">${days >= 0 ? `Quedan ${days} días · faltan ${money(Math.max(0, g.target_amount - g.current_amount))}` : "La fecha límite ya pasó"}</span>`}
          <div className="row">
            <button className="btn sm primary" onClick=${() => setContrib({ id: g.id, name: g.name, amount: "", tx: true })}>Abonar</button>
            <button className="icon-btn" aria-label=${`Editar meta ${g.name}`} onClick=${() => setForm({ ...g, target_amount: String(g.target_amount), current_amount: String(g.current_amount) })}><${Icon} name="pencil" size=${15} /></button>
            <button className="icon-btn" aria-label=${`Eliminar meta ${g.name}`} onClick=${() => del(g)}><${Icon} name="trash" size=${15} /></button>
          </div>
        </article>`;
      })}</div>`}
    <${Modal} open=${!!form} onClose=${() => setForm(null)} title=${form && form.id ? "Editar meta" : "Nueva meta de ahorro"} width=${440}>
      ${form && html`<div>
        <div className="field"><label htmlFor="gf-n">Nombre</label><input id="gf-n" className="input" maxLength=${40} value=${form.name} onChange=${(e) => setForm({ ...form, name: e.target.value })} placeholder="ej. Fondo de emergencia" /></div>
        <div className="two">
          <${MoneyField} id="gf-t" label="Meta" value=${form.target_amount} onChange=${(v) => setForm({ ...form, target_amount: v })} />
          <${MoneyField} id="gf-c" label="Ya ahorrado" value=${form.current_amount} onChange=${(v) => setForm({ ...form, current_amount: v })} />
        </div>
        <div className="field"><label htmlFor="gf-d">Fecha límite (opcional)</label><input id="gf-d" type="date" className="input" value=${form.deadline || ""} onChange=${(e) => setForm({ ...form, deadline: e.target.value })} /></div>
        <div className="modal-f"><button className="btn ghost" onClick=${() => setForm(null)}>Cancelar</button><button className="btn primary" onClick=${saveGoal}>${form.id ? "Guardar cambios" : "Crear meta"}</button></div>
      </div>`}
    <//>
    <${Modal} open=${!!contrib} onClose=${() => setContrib(null)} title=${contrib ? `Abonar a "${contrib.name}"` : ""} width=${420}>
      ${contrib && html`<div>
        <${MoneyField} id="gc-a" label="Monto del abono" value=${contrib.amount} onChange=${(v) => setContrib({ ...contrib, amount: v })} />
        <label className="check"><input type="checkbox" checked=${contrib.tx} onChange=${(e) => setContrib({ ...contrib, tx: e.target.checked })} />Registrar también como gasto en la categoría Ahorro</label>
        <div className="modal-f" style=${{ marginTop: 16 }}><button className="btn ghost" onClick=${() => setContrib(null)}>Cancelar</button><button className="btn primary" onClick=${doContrib}>Registrar abono</button></div>
      </div>`}
    <//>
  </section>`;
}

/* =========================================================
   DEUDAS
   ========================================================= */
// MÓDULO DE DEUDAS.
// Paso 1: totales: deuda total (suma de valores iniciales), pendiente y pagado = total - pendiente.
// Paso 2: barra de progreso global del pago.
// Paso 3: cada deuda muestra su estado, progreso, cuota y fecha límite,
//         con los botones Registrar pago, Editar y Eliminar.
function DebtSection() {
  const app = useApp();
  const [form, setForm] = useState(null);
  const [pay, setPay] = useState(null);
  const tot = app.debts.reduce((s, d) => s + d.initial_amount, 0), pend = app.debts.reduce((s, d) => s + d.remaining_amount, 0);
  const paid = tot - pend, p = tot ? (paid / tot) * 100 : 0;
  // Convierte los montos a número y guarda la deuda. Si no se escribe el pendiente, se asume igual al valor inicial.
  const save = () => {
    try {
      actions.saveDebt({ ...form, initial_amount: Number(form.initial_amount || 0), remaining_amount: form.remaining_amount === "" ? Number(form.initial_amount || 0) : Number(form.remaining_amount), installment: Number(form.installment || 0) });
      toast(form.id ? "Deuda actualizada" : "Deuda registrada"); setForm(null);
    } catch (e) { toast(e.message, "danger"); }
  };
  // Registra el pago (no permite pagar más de lo pendiente).
  const doPay = () => {
    try { actions.payDebt(pay.id, Number(pay.amount || 0), pay.tx); toast(`Pago registrado en "${pay.name}"`); setPay(null); }
    catch (e) { toast(e.message, "danger"); }
  };
  // Pide confirmación y elimina la deuda.
  const del = async (d) => { if (await confirmAsk({ title: "Eliminar deuda", body: `Se eliminará "${d.name}". Los pagos ya registrados como movimientos se conservan.`, confirmLabel: "Eliminar", danger: true })) { actions.deleteDebt(d.id); toast("Deuda eliminada", "info"); } };
  // Color del indicador según el estado de la deuda.
  const stBadge = { "Pagada": "ok", "Vencida": "over", "Al día": "" };
  return html`<section className="card" aria-labelledby="db-t">
    <div className="card-h"><h2 id="db-t" className="ttl">Deudas</h2>
      <button className="btn sm outline" onClick=${() => setForm({ name: "", creditor: "", initial_amount: "", remaining_amount: "", installment: "", due_date: "" })}><${Icon} name="plus" size=${14} />Registrar deuda</button></div>
    ${app.debts.length ? html`<div>
      <div className="stats" style=${{ marginBottom: 12 }}>
        <div className="stat"><span className="xs muted">Total de deuda</span><b className="num">${money(tot)}</b></div>
        <div className="stat"><span className="xs muted">Pagado</span><b className="num" style=${{ color: "var(--success)" }}>${money(paid)}</b></div>
        <div className="stat"><span className="xs muted">Pendiente</span><b className="num">${money(pend)}</b></div>
      </div>
      <div className="prog lg ok" role="progressbar" aria-label="Progreso total de pago" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(p)} style=${{ marginBottom: 16 }}><i style=${{ width: `${p}%` }}></i></div>
      <div className="items">${app.debts.map((d) => {
        const dp = d.initial_amount ? ((d.initial_amount - d.remaining_amount) / d.initial_amount) * 100 : 0;
        const st = F.debtStatus(d);
        return html`<article key=${d.id} className="item">
          <div className="row" style=${{ justifyContent: "space-between" }}><div style=${{ minWidth: 0 }}><h3>${d.name}</h3>${d.creditor && html`<span className="xs muted">${d.creditor}</span>`}</div>
            <span className=${"badge " + stBadge[st]}>${st === "Pagada" ? html`<${Icon} name="check" size=${11} />` : st === "Vencida" ? html`<${Icon} name="alert" size=${11} />` : null}${st}</span></div>
          <div className="prog lg ok" role="progressbar" aria-label=${`Pagado de ${d.name}`} aria-valuemin="0" aria-valuemax="100" aria-valuenow=${Math.round(dp)}><i style=${{ width: `${dp}%` }}></i></div>
          <div className="kv">
            <div>Pendiente<b className="num">${money(d.remaining_amount)}</b></div>
            <div>Cuota<b className="num">${d.installment ? money(d.installment) : "—"}</b></div>
            <div>Fecha límite<b>${d.due_date ? dayLabel(d.due_date) : "—"}</b></div>
          </div>
          <span className="xs muted num">Pagado ${pct(dp)} de ${money(d.initial_amount)}</span>
          <div className="row">
            <button className="btn sm primary" disabled=${d.remaining_amount <= 0} onClick=${() => setPay({ id: d.id, name: d.name, amount: String(Math.min(d.installment || d.remaining_amount, d.remaining_amount)), tx: true })}>Registrar pago</button>
            <button className="icon-btn" aria-label=${`Editar deuda ${d.name}`} onClick=${() => setForm({ ...d, initial_amount: String(d.initial_amount), remaining_amount: String(d.remaining_amount), installment: String(d.installment || "") })}><${Icon} name="pencil" size=${15} /></button>
            <button className="icon-btn" aria-label=${`Eliminar deuda ${d.name}`} onClick=${() => del(d)}><${Icon} name="trash" size=${15} /></button>
          </div>
        </article>`;
      })}</div></div>`
      : html`<${Empty} icon="card" title="No tienes deudas registradas" text="Registra una deuda para seguir cuánto has pagado y cuánto falta." />`}
    <${Modal} open=${!!form} onClose=${() => setForm(null)} title=${form && form.id ? "Editar deuda" : "Registrar deuda"} width=${480}>
      ${form && html`<div>
        <div className="two">
          <div className="field"><label htmlFor="df-n">Nombre</label><input id="df-n" className="input" maxLength=${40} value=${form.name} onChange=${(e) => setForm({ ...form, name: e.target.value })} placeholder="ej. Tarjeta de crédito" /></div>
          <div className="field"><label htmlFor="df-c">Acreedor</label><input id="df-c" className="input" maxLength=${40} value=${form.creditor || ""} onChange=${(e) => setForm({ ...form, creditor: e.target.value })} placeholder="ej. Banco" /></div>
        </div>
        <div className="two">
          <${MoneyField} id="df-i" label="Valor inicial" value=${form.initial_amount} onChange=${(v) => setForm({ ...form, initial_amount: v })} />
          <${MoneyField} id="df-r" label="Valor pendiente" value=${form.remaining_amount} onChange=${(v) => setForm({ ...form, remaining_amount: v })} placeholder="Igual al inicial" />
        </div>
        <div className="two">
          <${MoneyField} id="df-q" label="Cuota" value=${form.installment} onChange=${(v) => setForm({ ...form, installment: v })} />
          <div className="field"><label htmlFor="df-d">Fecha límite</label><input id="df-d" type="date" className="input" value=${form.due_date || ""} onChange=${(e) => setForm({ ...form, due_date: e.target.value })} /></div>
        </div>
        <div className="modal-f"><button className="btn ghost" onClick=${() => setForm(null)}>Cancelar</button><button className="btn primary" onClick=${save}>${form.id ? "Guardar cambios" : "Registrar deuda"}</button></div>
      </div>`}
    <//>
    <${Modal} open=${!!pay} onClose=${() => setPay(null)} title=${pay ? `Pago a "${pay.name}"` : ""} width=${420}>
      ${pay && html`<div>
        <${MoneyField} id="dp-a" label="Monto pagado" value=${pay.amount} onChange=${(v) => setPay({ ...pay, amount: v })} />
        <label className="check"><input type="checkbox" checked=${pay.tx} onChange=${(e) => setPay({ ...pay, tx: e.target.checked })} />Registrar también como gasto en la categoría Deudas</label>
        <div className="modal-f" style=${{ marginTop: 16 }}><button className="btn ghost" onClick=${() => setPay(null)}>Cancelar</button><button className="btn primary" onClick=${doPay}>Registrar pago</button></div>
      </div>`}
    <//>
  </section>`;
}

/* =========================================================
   ANÁLISIS FINANCIERO
   ========================================================= */
// Ícono y etiqueta de texto para cada tono de observación del análisis.
const TONE = { good: ["check", "Bien"], warn: ["alert", "Atención"], bad: ["alert", "Alerta"], info: ["bulb", "Dato"] };
// ANÁLISIS FINANCIERO: muestra las observaciones generadas por buildInsights.
// En el dashboard (limit) ordena por importancia (alertas primero) y muestra solo las primeras.
function FinancialAnalysis({ ym, limit, onMore }) {
  const app = useApp();
  const list = useMemo(() => buildInsights(app, ym), [app, ym]);
  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  const shown = limit ? [...list].sort((a, b) => order[a.tone] - order[b.tone]).slice(0, limit) : list;
  return html`<section className="card" aria-labelledby="fa-t">
    <div className="card-h"><h2 id="fa-t" className="ttl">Análisis financiero</h2>${limit && list.length > limit && html`<button className="link" onClick=${onMore}>Ver ${list.length} observaciones</button>`}</div>
    <ul className="ins">${shown.map((x, i) => html`<li key=${i} className=${x.tone}><span className="ic"><${Icon} name=${TONE[x.tone][0]} size=${15} /></span><span><span className="tag">${TONE[x.tone][1]}</span>${x.text}</span></li>`)}</ul>
  </section>`;
}
// ESTADÍSTICAS DEL MES.
// - Gasto diario promedio: gastos / días transcurridos (o días del mes si ya terminó).
// - Gasto promedio: gastos / cantidad de gastos.
// - Categoría principal y método de pago más usado (por monto).
// - Tasa de ahorro: ahorro / ingresos.
function StatsCard({ ym }) {
  const app = useApp();
  const cur = F.inMonth(app.transactions, ym);
  const T = F.totals(cur);
  const isCur = ym === currentYM();
  const days = isCur ? new Date().getDate() : daysInMonth(ym);
  const exp = cur.filter((t) => t.type === "expense");
  const top = F.byCategory(cur, app.categories)[0];
  const byPay = {}; exp.forEach((t) => (byPay[t.paymentMethod] = (byPay[t.paymentMethod] || 0) + t.amount));
  const topPay = Object.entries(byPay).sort((a, b) => b[1] - a[1])[0];
  return html`<section className="card" aria-labelledby="st-t">
    <div className="card-h"><h2 id="st-t" className="ttl">Estadísticas de ${monthName(ym)}</h2></div>
    <div className="stats">
      <div className="stat"><span className="xs muted">Movimientos</span><b className="num">${cur.length}</b></div>
      <div className="stat"><span className="xs muted">Gasto diario promedio</span><b className="num">${money(T.expense / days)}</b></div>
      <div className="stat"><span className="xs muted">Gasto promedio</span><b className="num">${exp.length ? money(T.expense / exp.length) : "—"}</b></div>
      <div className="stat"><span className="xs muted">Categoría principal</span><b>${top ? top.cat.name : "—"}</b></div>
      <div className="stat"><span className="xs muted">Método más usado</span><b>${topPay ? payName(topPay[0]) : "—"}</b></div>
      <div className="stat"><span className="xs muted">Tasa de ahorro</span><b className="num">${T.income ? pct((F.savings(cur) / T.income) * 100) : "—"}</b></div>
    </div>
  </section>`;
}

/* =========================================================
   CALENDARIO FINANCIERO
   ========================================================= */
// CALENDARIO FINANCIERO.
// Paso 1: calcula en qué día de la semana empieza el mes (lunes = 0) y cuántos días tiene.
// Paso 2: agrupa los movimientos del mes por fecha (byDay).
// Paso 3: dibuja casillas vacías hasta el primer día y luego una casilla por día
//         con sus ingresos (+) y gastos (-) en formato corto.
// Paso 4: al tocar un día, el panel derecho muestra ingresos, gastos, total y la lista.
function CalendarView({ ym, setYm, onEdit }) {
  const app = useApp();
  const [y, m] = ym.split("-").map(Number);
  const startDow = (new Date(y, m - 1, 1).getDay() + 6) % 7, dim = daysInMonth(ym);
  // Agrupa: { "2026-09-20": [movimientos de ese día], ... }.
  const byDay = useMemo(() => {
    const map = {}; F.inMonth(app.transactions, ym).forEach((t) => { (map[t.date] = map[t.date] || []).push(t); }); return map;
  }, [app.transactions, ym]);
  const today = todayISO();
  // sel: día seleccionado.
  const [sel, setSel] = useState(null);
  // Al cambiar de mes selecciona hoy (si está en ese mes) o el primer día con movimientos.
  useEffect(() => { setSel(today.startsWith(ym) ? today : Object.keys(byDay).sort()[0] || `${ym}-01`); }, [ym]);
  const selTx = sel ? byDay[sel] || [] : [];
  const T = F.totals(selTx);
  // Construye las casillas del calendario.
  const cells = [];
  // Casillas vacías antes del día 1 (para que el 1 caiga en el día de la semana correcto).
  for (let i = 0; i < startDow; i++) cells.push(html`<div key=${"b" + i} className="day blank" aria-hidden="true"></div>`);
  // Una casilla por día con sus totales; aria-label describe el día para lectores de pantalla.
  for (let d = 1; d <= dim; d++) {
    const iso = `${ym}-${pad(d)}`, txs = byDay[iso] || [], t = F.totals(txs);
    cells.push(html`<button key=${iso} className=${"day" + (sel === iso ? " sel" : "") + (iso === today ? " today" : "")} aria-pressed=${sel === iso}
        aria-label=${`${d} de ${MONTHS[m - 1]}${txs.length ? `: ingresos ${money(t.income)}, gastos ${money(t.expense)}` : ": sin movimientos"}`} onClick=${() => setSel(iso)}>
      <span className="d">${d}</span>
      ${t.income > 0 && html`<span className="in num">+${compact(t.income)}</span>`}
      ${t.expense > 0 && html`<span className="out num">-${compact(t.expense)}</span>`}
      ${txs.length > 0 && html`<span className="dots">${t.income > 0 && html`<i className="g"></i>`}${t.expense > 0 && html`<i></i>`}</span>`}
    </button>`);
  }
  return html`<div className="cal-layout">
    <section className="card" aria-labelledby="cal-t">
      <div className="card-h"><h2 id="cal-t" className="ttl">Calendario financiero</h2>
        <div className="row" style=${{ gap: 2 }}>
          <button className="icon-btn" aria-label="Mes anterior" onClick=${() => setYm(shiftYM(ym, -1))}><${Icon} name="left" /></button>
          <b style=${{ minWidth: 130, textAlign: "center" }}>${ymLabel(ym)}</b>
          <button className="icon-btn" aria-label="Mes siguiente" onClick=${() => setYm(shiftYM(ym, 1))}><${Icon} name="right" /></button>
        </div></div>
      <div className="cal">
        ${["lun", "mar", "mié", "jue", "vie", "sáb", "dom"].map((d) => html`<div key=${d} className="dow" aria-hidden="true">${d}</div>`)}
        ${cells}
      </div>
    </section>
    <section className="card" aria-labelledby="cald-t" aria-live="polite">
      <div className="card-h"><h2 id="cald-t" className="ttl">${sel ? longDate(sel) : "Elige un día"}</h2></div>
      <div className="stats" style=${{ marginBottom: 12 }}>
        <div className="stat"><span className="xs muted">Ingresos</span><b className="num" style=${{ color: "var(--success)" }}>${money(T.income)}</b></div>
        <div className="stat"><span className="xs muted">Gastos</span><b className="num">${money(T.expense)}</b></div>
        <div className="stat"><span className="xs muted">Total del día</span><b className="num" style=${{ color: T.balance < 0 ? "var(--danger)" : undefined }}>${money(T.balance)}</b></div>
      </div>
      <${TransactionList} txs=${selTx} onEdit=${onEdit} empty=${html`<${Empty} icon="calendar" title="Sin movimientos este día" text="Elige otro día o registra un movimiento con esta fecha." />`} />
    </section>
  </div>`;
}
