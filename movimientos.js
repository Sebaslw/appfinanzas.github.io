/* ============================================================
   js/movimientos.js
   Formulario de movimiento y lista de movimientos.
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   FORMULARIO DE MOVIMIENTO (crear / editar)
   ========================================================= */
// FORMULARIO DE MOVIMIENTO (sirve para crear y para editar).
// - initial: si viene un movimiento, el formulario está en modo edición.
// - onDone: qué hacer al guardar (por ejemplo, cerrar el modal).
// - idPrefix: prefijo para que los id de los campos no se repitan si hay dos formularios.
function TransactionForm({ initial, onDone, idPrefix = "qf", submitLabel }) {
  const app = useApp();
  // Modo edición si recibimos un movimiento con id.
  const editing = !!(initial && initial.id);
  // Valores iniciales de un formulario vacío (gasto, hoy, efectivo).
  // "keep" permite conservar algunos valores después de guardar.
  const blank = (keep = {}) => ({ type: "expense", amount: "", categoryId: "", date: todayISO(), description: "", paymentMethod: "efectivo", ...keep });
  // v: valores actuales del formulario.
  const [v, setV] = useState(() => (initial ? { ...initial, amount: String(initial.amount) } : blank()));
  // errors: mensajes de error por campo.
  const [errors, setErrors] = useState({});
  // adding: texto de la categoría nueva que se está creando (null = no se está creando).
  const [adding, setAdding] = useState(null);
  // saved: muestra "✓ Guardado" en el botón por un momento.
  const [saved, setSaved] = useState(false);
  const formRef = useRef(null);
  // Solo se muestran las categorías del tipo elegido (gasto o ingreso).
  const cats = app.categories.filter((c) => c.type === v.type);
  // Cambia un campo y borra su error en cuanto el usuario lo corrige.
  const set = (k, val) => { setV((p) => ({ ...p, [k]: val })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };
  // Cambia entre Gasto e Ingreso.
  // Si la categoría elegida no corresponde al nuevo tipo, la deja vacía.
  const switchType = (t) => {
    setV((p) => ({ ...p, type: t, categoryId: (app.categories.find((c) => c.id === p.categoryId) || {}).type === t ? p.categoryId : "" }));
    setErrors((e) => ({ ...e, type: undefined, categoryId: undefined }));
  };
  // Crea una categoría nueva desde el chip "+ Nueva" y la deja seleccionada.
  const createCat = () => {
    try { const c = actions.addCategory({ name: adding, type: v.type }); set("categoryId", c.id); setAdding(null); toast(`Categoría "${c.name}" creada`); }
    catch (e) { toast(e.message, "danger"); }
  };
  // Al presionar "Agregar movimiento":
  // Paso 1: evita que el navegador recargue la página.
  // Paso 2: convierte el monto a número.
  // Paso 3: valida; si hay errores los muestra y pone el foco en el primer campo con error.
  // Paso 4: guarda (crear o editar) con las acciones del store.
  // Paso 5: muestra el aviso, limpia el formulario (conservando tipo, fecha y método)
  //         y marca el botón como "Guardado".
  // Paso 6: si el store rechaza algo, muestra el error.
  const submit = (e) => {
    e.preventDefault();
    const data = { ...v, amount: v.amount === "" ? NaN : Number(v.amount) };
    const errs = validateTx(data, app.categories);
    if (Object.keys(errs).length) {
      setErrors(errs);
      const key = ["amount", "categoryId", "date", "paymentMethod", "description"].find((k) => errs[k]);
      const el = formRef.current && formRef.current.querySelector(`[data-k="${key}"]`);
      el && el.focus();
      return;
    }
    try {
      if (editing) { actions.updateTransaction(initial.id, data); toast("Movimiento actualizado"); }
      else { actions.addTransaction(data); toast(data.type === "income" ? "Ingreso agregado" : "Gasto agregado"); setV(blank({ type: v.type, paymentMethod: v.paymentMethod, date: v.date })); }
      setErrors({}); setSaved(true); setTimeout(() => setSaved(false), 1200);
      onDone && onDone();
    } catch (err) { if (err.errors) setErrors(err.errors); else toast(err.message, "danger"); }
  };
  // Dibujo del formulario: tipo, monto grande, chips de categoría, fecha,
  // método de pago, nota y botón. Los atributos data-k marcan cada campo para enfocarlo si hay error.
  const P = idPrefix;
  return html`<form ref=${formRef} onSubmit=${submit} noValidate>
    <fieldset>
      <legend className="sr-only">Tipo de movimiento</legend>
      <div className="seg" style=${{ marginBottom: 16 }}>
        <button type="button" aria-pressed=${v.type === "expense"} onClick=${() => switchType("expense")}>Gasto</button>
        <button type="button" aria-pressed=${v.type === "income"} onClick=${() => switchType("income")}>Ingreso</button>
      </div>
    </fieldset>

    <label htmlFor=${P + "-amount"} className="sr-only">Monto en pesos</label>
    <div className=${"amount" + (errors.amount ? " invalid" : "")}>
      <span aria-hidden="true">$</span>
      <input id=${P + "-amount"} data-k="amount" inputMode="numeric" autoComplete="off" placeholder="0" className="num"
        value=${v.amount === "" ? "" : groupThousands(Number(v.amount))}
        aria-invalid=${!!errors.amount} aria-describedby=${errors.amount ? P + "-amount-e" : undefined}
        onChange=${(e) => set("amount", digitsOnly(e.target.value))} />
    </div>
    ${errors.amount && html`<p id=${P + "-amount-e"} className="err" style=${{ margin: "-8px 0 12px" }}><${Icon} name="alert" size=${13} />${errors.amount}</p>`}

    <fieldset aria-describedby=${errors.categoryId ? P + "-cat-e" : undefined}>
      <legend>Categoría</legend>
      <div className="chips">
        ${cats.map((c, i) => html`<button type="button" key=${c.id} className="chip" data-k=${i === 0 ? "categoryId" : undefined}
          aria-pressed=${v.categoryId === c.id} onClick=${() => set("categoryId", c.id)}>
          <i className="dot" style=${{ background: v.categoryId === c.id ? "#fff" : c.color }}></i>${c.name}</button>`)}
        ${adding === null
          ? html`<button type="button" className="chip add" onClick=${() => setAdding("")}><${Icon} name="plus" size=${13} />Nueva</button>`
          : html`<div className="row" style=${{ width: "100%", marginTop: 4 }}>
              <input className="input" style=${{ height: 32 }} aria-label="Nombre de la nueva categoría" placeholder="Nombre" maxLength=${30} autoFocus
                value=${adding} onChange=${(e) => setAdding(e.target.value)}
                onKeyDown=${(e) => { if (e.key === "Enter") { e.preventDefault(); createCat(); } if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setAdding(null); } }} />
              <button type="button" className="btn sm primary" onClick=${createCat}>Crear</button>
              <button type="button" className="icon-btn sm" aria-label="Cancelar nueva categoría" onClick=${() => setAdding(null)}><${Icon} name="x" size=${15} /></button>
            </div>`}
      </div>
      ${errors.categoryId && html`<p id=${P + "-cat-e"} className="err" style=${{ margin: "8px 0 0" }}><${Icon} name="alert" size=${13} />${errors.categoryId}</p>`}
    </fieldset>

    <div className="two">
      <div className="field">
        <label htmlFor=${P + "-date"}>Fecha</label>
        <input id=${P + "-date"} data-k="date" type="date" className="input" value=${v.date} onChange=${(e) => set("date", e.target.value)}
          aria-invalid=${!!errors.date} aria-describedby=${errors.date ? P + "-date-e" : undefined} />
        ${errors.date && html`<span id=${P + "-date-e"} className="err"><${Icon} name="alert" size=${13} />${errors.date}</span>`}
      </div>
      <div className="field">
        <label htmlFor=${P + "-pay"}>Método de pago</label>
        <select id=${P + "-pay"} data-k="paymentMethod" className="input" value=${v.paymentMethod} onChange=${(e) => set("paymentMethod", e.target.value)}>
          ${PAYMENT_METHODS.map((p) => html`<option key=${p.id} value=${p.id}>${p.name}</option>`)}
        </select>
      </div>
    </div>
    <div className="field">
      <label htmlFor=${P + "-desc"}>Nota (opcional)</label>
      <input id=${P + "-desc"} data-k="description" className="input" maxLength=${120} placeholder="ej. supermercado del sábado" value=${v.description} onChange=${(e) => set("description", e.target.value)} />
    </div>
    <button type="submit" className=${"btn block " + (saved ? "ok" : "outline")} style=${{ height: 44 }}>
      ${saved ? html`<${Icon} name="check" />Guardado` : submitLabel || (editing ? "Guardar cambios" : "Agregar movimiento")}
    </button>
  </form>`;
}

/* =========================================================
   LISTA DE MOVIMIENTOS
   ========================================================= */
// Ordena movimientos: fecha más reciente primero; si es el mismo día, el último creado primero.
const sortTx = (a, b) => (a.date === b.date ? (b.created_at || "").localeCompare(a.created_at || "") : b.date.localeCompare(a.date));
// FILA DE MOVIMIENTO: categoría, "fecha · nota · método", monto con signo
// y los botones Editar, Duplicar y Eliminar.
function TransactionCard({ tx, onEdit }) {
  const app = useApp();
  const c = catOf(app.categories, tx.categoryId);
  // Eliminar:
  // Paso 1: pide confirmación mostrando qué se va a borrar.
  // Paso 2: si confirma, borra y muestra un aviso con botón "Deshacer".
  const del = async () => {
    const ok = await confirmAsk({ title: "Eliminar movimiento", body: `Se eliminará "${tx.description || c.name}" por ${money(tx.amount)} del ${longDate(tx.date)}.`, confirmLabel: "Eliminar", danger: true });
    if (!ok) return;
    const old = actions.deleteTransaction(tx.id);
    toast("Movimiento eliminado", "info", { label: "Deshacer", run: () => actions.restoreTransaction(old) });
  };
  // Duplicar: crea una copia con la fecha de hoy.
  const dup = () => { actions.duplicateTransaction(tx.id); toast("Movimiento duplicado con la fecha de hoy"); };
  // Texto secundario: une fecha, nota y método con " · " (omite lo que esté vacío).
  const sub = [dayLabel(tx.date), tx.description, payName(tx.paymentMethod)].filter(Boolean).join(" · ");
  return html`<li className="tx">
    <i className="dot" style=${{ background: c.color }} aria-hidden="true"></i>
    <div style=${{ minWidth: 0 }}>
      <div className="t1">${c.name}</div>
      <div className="t2" title=${sub}>${sub}</div>
    </div>
    <div>
      <div className=${"amt num" + (tx.type === "income" ? " in" : "")}>
        <span className="sr-only">${tx.type === "income" ? "Ingreso" : "Gasto"}: </span>${signedMoney(tx.amount, tx.type)}</div>
      <div className="acts">
        <button className="icon-btn" aria-label=${`Editar ${c.name} del ${dayLabel(tx.date)}`} title="Editar" onClick=${() => onEdit(tx)}><${Icon} name="pencil" size=${14} /></button>
        <button className="icon-btn" aria-label=${`Duplicar ${c.name} del ${dayLabel(tx.date)}`} title="Duplicar" onClick=${dup}><${Icon} name="copy" size=${14} /></button>
        <button className="icon-btn del" aria-label=${`Eliminar ${c.name} del ${dayLabel(tx.date)}`} title="Eliminar" onClick=${del}><${Icon} name="trash" size=${14} /></button>
      </div>
    </div>
  </li>`;
}
// LISTA DE MOVIMIENTOS: ordena y dibuja cada fila.
// Si no hay movimientos, muestra un estado vacío que invita a registrar el primero.
function TransactionList({ txs, onEdit, empty }) {
  if (!txs.length) return empty || html`<${Empty} icon="list" title="Aún no tienes movimientos" text="Registra tu primer ingreso o gasto para comenzar a analizar tus finanzas." />`;
  return html`<ul className="tx-list">${[...txs].sort(sortTx).map((t) => html`<${TransactionCard} key=${t.id} tx=${t} onEdit=${onEdit} />`)}</ul>`;
}
// ESTADO VACÍO reutilizable: ícono, título, texto de ayuda y botones opcionales.
function Empty({ icon = "list", title, text, children }) {
  return html`<div className="empty"><div className="ic"><${Icon} name=${icon} size=${20} /></div><strong>${title}</strong>${text && html`<p>${text}</p>`}${children}</div>`;
}
