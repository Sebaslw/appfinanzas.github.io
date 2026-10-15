/* ============================================================
   js/graficos.js
   Resumen KPI, gráfico donut y gráfico de barras.
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   RESUMEN FINANCIERO (KPI)
   ========================================================= */
// Etiqueta de variación frente al mes anterior (ej. "▲ +10% vs ago").
// Paso 1: calcula el cambio porcentual; si no hay mes anterior, lo indica.
// Paso 2: decide si el cambio es bueno o malo (goodWhenUp):
//   ingresos que suben = bien (verde); gastos que suben = mal (rojo).
function Delta({ cur, prev, goodWhenUp, prevYm }) {
  const ch = F.change(cur, prev);
  if (ch === null) return html`<span className="delta">Sin datos de ${monthName(prevYm)}</span>`;
  const up = ch >= 0, good = up === goodWhenUp;
  return html`<span className=${"delta " + (Math.abs(ch) < 0.5 ? "" : good ? "good" : "bad")}>
    <${Icon} name=${up ? "up" : "down"} size=${13} />${up ? "+" : ""}${pct(ch)} vs ${MONTHS_SHORT[Number(prevYm.slice(5)) - 1]}
  </span>`;
}
// TARJETAS KPI: ingresos, gastos y saldo del mes elegido.
// Paso 1: calcula los totales del mes y del mes anterior (useMemo evita recalcular sin cambios).
// Paso 2: saldo = ingresos - gastos.
// Paso 3: cada tarjeta muestra su variación; el saldo muestra la diferencia en pesos,
//         o el % de los ingresos si no hay mes anterior. Si es negativo se pinta en rojo.
function FinancialSummary({ ym }) {
  const app = useApp();
  const prevYm = shiftYM(ym, -1);
  const T = useMemo(() => F.totals(F.inMonth(app.transactions, ym)), [app.transactions, ym]);
  const P = useMemo(() => F.totals(F.inMonth(app.transactions, prevYm)), [app.transactions, prevYm]);
  const balDelta = T.balance - P.balance;
  return html`<section className="grid-kpi" aria-label="Resumen financiero">
    <div className="card kpi"><h2 className="ttl">Ingresos del mes</h2><div className="v num">${money(T.income)}</div>
      <${Delta} cur=${T.income} prev=${P.income} goodWhenUp=${true} prevYm=${prevYm} /></div>
    <div className="card kpi"><h2 className="ttl">Gastos del mes</h2><div className="v num">${money(T.expense)}</div>
      <${Delta} cur=${T.expense} prev=${P.expense} goodWhenUp=${false} prevYm=${prevYm} /></div>
    <div className=${"card kpi accent" + (T.balance < 0 ? " neg" : "")}><h2 className="ttl">Saldo disponible</h2><div className="v num">${money(T.balance)}</div>
      ${P.income || P.expense
        ? html`<span className=${"delta " + (balDelta >= 0 ? "good" : "bad")}><${Icon} name=${balDelta >= 0 ? "up" : "down"} size=${13} />${balDelta >= 0 ? "+" : "-"}$ ${groupThousands(balDelta)} vs ${MONTHS_SHORT[Number(prevYm.slice(5)) - 1]}</span>`
        : html`<span className="delta">${T.income ? `${pct((T.balance / T.income) * 100)} de tus ingresos` : "Ingresos − gastos"}</span>`}
    </div>
  </section>`;
}

/* =========================================================
   GRÁFICO DONUT: GASTOS POR CATEGORÍA
   ========================================================= */
// GRÁFICO DONUT de gastos por categoría.
// Paso 1: agrupa los gastos del mes por categoría con sus porcentajes.
// Paso 2: dibuja un círculo por categoría. Truco: con strokeDasharray cada círculo
//         solo pinta su "trozo" del contorno, y strokeDashoffset lo coloca después del anterior.
// Paso 3: al pasar el mouse (o enfocar la leyenda con teclado) se resalta esa categoría
//         y el centro muestra nombre, monto y porcentaje.
function CategoryChart({ ym }) {
  const app = useApp();
  const rows = useMemo(() => F.byCategory(F.inMonth(app.transactions, ym), app.categories), [app.transactions, app.categories, ym]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const [hover, setHover] = useState(null);
  // R: radio del círculo. C: longitud del contorno (2πR). gap: pequeña separación entre trozos.
  const R = 70, C = 2 * Math.PI * R, gap = rows.length > 1 ? 1.2 : 0;
  // off: cuánto contorno ya se usó; cada trozo empieza donde terminó el anterior.
  let off = 0;
  // h: la categoría resaltada (o null si ninguna).
  const h = hover !== null ? rows[hover] : null;
  return html`<section className="card" aria-labelledby="cc-t">
    <div className="card-h"><h2 id="cc-t" className="ttl">Gastos por categoría</h2></div>
    ${!rows.length ? html`<${Empty} icon="chart" title=${`Sin gastos en ${ymLabel(ym)}`} text="Cuando registres gastos verás aquí cómo se reparten." />`
    : html`<div className="donut-wrap">
      <div className="donut">
        <svg viewBox="0 0 180 180" role="img" aria-label=${`Distribución de gastos: ${rows.map((r) => `${r.cat.name} ${pct(r.pct)}`).join(", ")}`}>
          <circle cx="90" cy="90" r=${R} fill="none" stroke="var(--surface-2)" strokeWidth="24" />
          ${rows.map((r, i) => {
            // Largo del trozo = proporción del gasto × contorno total (menos la separación).
            const len = Math.max((r.amount / total) * C - gap, 0.6);
            const el = html`<circle key=${r.cat.id} className="seg" cx="90" cy="90" r=${R} fill="none" stroke=${r.cat.color}
              strokeWidth=${hover === i ? 30 : 24} strokeDasharray=${`${len} ${C - len}`} strokeDashoffset=${-off}
              opacity=${hover === null || hover === i ? 1 : 0.35}
              onMouseEnter=${() => setHover(i)} onMouseLeave=${() => setHover(null)} />`;
            // Avanza el punto de inicio para el siguiente trozo.
            off += (r.amount / total) * C;
            return el;
          })}
        </svg>
        <div className="center" aria-live="polite">
          ${h ? html`<span style=${{ color: "var(--text)", fontWeight: 600 }}>${h.cat.name}</span><b className="num">${money(h.amount)}</b><span>${pct(h.pct)} del total</span>`
              : html`<b className="num">${money(total)}</b><span>gastado</span>`}
        </div>
      </div>
      <ul className="legend">
        ${rows.map((r, i) => html`<li key=${r.cat.id}><button className=${hover === i ? "on" : ""}
            onMouseEnter=${() => setHover(i)} onMouseLeave=${() => setHover(null)} onFocus=${() => setHover(i)} onBlur=${() => setHover(null)}
            aria-label=${`${r.cat.name}: ${money(r.amount)}, ${pct(r.pct)}`}>
          <i className="dot" style=${{ background: r.cat.color }}></i><span className="nm">${r.cat.name}</span><span className="num">${pct(r.pct)}</span>
        </button></li>`)}
      </ul>
    </div>`}
  </section>`;
}

/* =========================================================
   BARRAS: ÚLTIMOS 6 MESES
   ========================================================= */
// GRÁFICO DE BARRAS de los últimos 6 meses.
// Paso 1: obtiene ingresos, gastos y saldo de cada mes.
// Paso 2: según el botón elegido (Gastos / Ingresos / Saldo) toma ese valor.
// Paso 3: la altura de cada barra = valor / valor máximo × 100%.
// Paso 4: el mes elegido se resalta; los saldos negativos van en rojo.
// Paso 5: al hacer clic en una barra se cambia el periodo de toda la app a ese mes.
function MonthlyChart({ ym, onPick }) {
  const app = useApp();
  const [mode, setMode] = useState("expense");
  const data = useMemo(() => F.series(app.transactions, ym, 6), [app.transactions, ym]);
  // Elige qué dato mostrar según el modo.
  const val = (d) => (mode === "expense" ? d.expense : mode === "income" ? d.income : d.balance);
  // El mayor valor (mínimo 1 para no dividir por 0) define la escala de las barras.
  const max = Math.max(1, ...data.map((d) => Math.abs(val(d))));
  const label = { expense: "gastos", income: "ingresos", balance: "saldo" }[mode];
  return html`<section className="card" aria-labelledby="mc-t">
    <div className="card-h"><h2 id="mc-t" className="ttl">Últimos 6 meses</h2>
      <div className="seg pill" role="group" aria-label="Dato a mostrar">
        ${[["expense", "Gastos"], ["income", "Ingresos"], ["balance", "Saldo"]].map(([k, l]) =>
          html`<button key=${k} aria-pressed=${mode === k} onClick=${() => setMode(k)}>${l}</button>`)}
      </div>
    </div>
    <div className="bars">
      ${data.map((d) => {
        const v = val(d), neg = v < 0;
        return html`<button key=${d.ym} className=${"bar" + (d.ym === ym ? " cur" : "") + (neg ? " neg" : "")}
            aria-label=${`${ymLabel(d.ym)}: ${label} ${money(v)}. Ver este mes`} onClick=${() => onPick && onPick(d.ym)}>
          <div className="col"><span className="tip num">${money(v)}</span><div className="fill" style=${{ height: `${(Math.abs(v) / max) * 100}%` }}></div></div>
          <span className="m">${ymShort(d.ym)}</span>
        </button>`;
      })}
    </div>
    ${mode === "balance" && data.some((d) => d.balance < 0) && html`<p className="xs muted" style=${{ margin: "10px 0 0" }}>Las barras rojas indican meses con saldo negativo.</p>`}
  </section>`;
}
