/* ============================================================
   js/logica.js
   Lógica financiera (fórmulas puras y análisis automático) y validación.
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   LÓGICA FINANCIERA (funciones puras, sin redondeo interno)
   ========================================================= */
// OBJETO F: todas las fórmulas financieras. Son funciones "puras":
// reciben datos y devuelven un resultado, sin guardar ni dibujar nada.
// Esto facilita probarlas y reutilizarlas.
const F = {
  // Filtra los movimientos de un mes (compara los 7 primeros caracteres de la fecha).
  inMonth: (txs, ym) => txs.filter((t) => t.date.slice(0, 7) === ym),
  // Filtra los movimientos de un año (compara los 4 primeros caracteres).
  inYear: (txs, y) => txs.filter((t) => t.date.slice(0, 4) === String(y)),
  // Suma ingresos y gastos y calcula el saldo.
  // Paso 1: empieza en 0. Paso 2: recorre cada movimiento y lo suma donde corresponde.
  // Paso 3: saldo = ingresos - gastos.
  totals(txs) {
    let income = 0, expense = 0;
    for (const t of txs) { if (t.type === "income") income += t.amount; else expense += t.amount; }
    return { income, expense, balance: income - expense };
  },
  // Variación porcentual: ((actual - anterior) / anterior) * 100.
  // Si el mes anterior es 0 devuelve null (no se puede dividir por 0).
  change: (cur, prev) => (prev > 0 ? ((cur - prev) / prev) * 100 : null),
  // Gasto (o ingreso) agrupado por categoría, con su porcentaje del total.
  // Paso 1: un Map acumula el monto de cada categoría y el total general.
  // Paso 2: convierte el Map en lista y busca los datos de cada categoría (nombre y color).
  // Paso 3: porcentaje = (monto de la categoría / total) * 100.
  // Paso 4: ordena de mayor a menor monto.
  byCategory(txs, cats, type = "expense") {
    const map = new Map(); let total = 0;
    for (const t of txs) if (t.type === type) { map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount); total += t.amount; }
    return [...map].map(([id, amount]) => ({
      cat: cats.find((c) => c.id === id) || { id, name: "Sin categoría", color: "#666" },
      amount, pct: total ? (amount / total) * 100 : 0,
    })).sort((a, b) => b.amount - a.amount);
  },
  // Totales de los últimos n meses (por defecto 6) para el gráfico de barras.
  // Recorre desde el mes más antiguo hasta el mes elegido.
  series(txs, ym, n = 6) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) { const m = shiftYM(ym, -i); out.push({ ym: m, ...F.totals(F.inMonth(txs, m)) }); }
    return out;
  },
  // Presupuesto vigente de una categoría en un mes.
  // Paso 1: busca entre todos los presupuestos guardados de esa categoría.
  // Paso 2: se queda con el más reciente que sea de ese mes o de un mes anterior.
  // Así, un presupuesto fijado en agosto sigue vigente en septiembre si no se cambió.
  // Devuelve el monto, si es "heredado" y desde qué mes.
  budgetFor(budgets, catId, ym) {
    let best = null;
    for (const b of budgets) {
      if (b.category_id !== catId) continue;
      const k = `${b.year}-${pad(b.month)}`;
      if (k <= ym && (!best || k > best.k)) best = { k, b };
    }
    return best ? { amount: best.b.amount, inherited: best.k !== ym, from: best.k } : { amount: null, inherited: false };
  },
  // Estado del presupuesto según el porcentaje usado:
  // 0-70% Normal · 70-90% Advertencia · 90-100% Crítico · más de 100% Excedido.
  budgetStatus(p) {
    if (p > 100) return { key: "over", label: "Excedido", icon: "alert" };
    if (p >= 90) return { key: "crit", label: "Crítico", icon: "alert" };
    if (p >= 70) return { key: "warn", label: "Advertencia", icon: "alert" };
    return { key: "ok", label: "Normal", icon: "check" };
  },
  // Ahorro = suma de los GASTOS registrados en la categoría "Ahorro".
  savings: (txs) => txs.reduce((s, t) => (t.type === "expense" && t.categoryId === "ahorro" ? s + t.amount : s), 0),
  // Estado de una deuda: "Pagada" si no queda saldo,
  // "Vencida" si la fecha límite ya pasó, y si no "Al día".
  debtStatus(d, today = todayISO()) {
    if (d.remaining_amount <= 0) return "Pagada";
    if (d.due_date && d.due_date < today) return "Vencida";
    return "Al día";
  },
};

// ANÁLISIS FINANCIERO AUTOMÁTICO: genera frases a partir de los datos reales.
// Cada observación tiene un tono: good (bien), warn (atención), bad (alerta) o info (dato).
// Paso 1: toma los movimientos del mes elegido y del mes anterior y calcula sus totales.
// Paso 2: si no hay movimientos, devuelve un solo mensaje invitando a registrar.
function buildInsights(s, ym) {
  const out = [];
  const cats = s.categories;
  const cur = F.inMonth(s.transactions, ym), prev = F.inMonth(s.transactions, shiftYM(ym, -1));
  const T = F.totals(cur), P = F.totals(prev);
  const prevName = monthName(shiftYM(ym, -1));
  if (!cur.length) return [{ tone: "info", text: `Aún no hay movimientos en ${ymLabel(ym)}. Registra uno para ver el análisis.` }];

  // Paso 3: qué porcentaje de los ingresos queda como saldo (o si se gastó de más).
  if (T.income > 0) {
    const r = (T.balance / T.income) * 100;
    if (r >= 0) out.push({ tone: r >= 20 ? "good" : "warn", text: `Tu saldo disponible representa el ${pct(r)} de tus ingresos.` });
    else out.push({ tone: "bad", text: `Gastaste ${money(-T.balance)} más de lo que ingresaste este mes.` });
  } else if (T.expense > 0) out.push({ tone: "warn", text: `Este mes registras gastos por ${money(T.expense)} y todavía ningún ingreso.` });

  // Paso 4: cuánto subió o bajó el gasto total frente al mes anterior (solo si es 5% o más).
  const ch = F.change(T.expense, P.expense);
  if (ch !== null && Math.abs(ch) >= 5)
    out.push({ tone: ch > 0 ? "warn" : "good", text: `Tus gastos ${ch > 0 ? "aumentaron" : "disminuyeron"} ${pct(Math.abs(ch))} respecto a ${prevName}.` });

  // Paso 5: las 2 categorías que más cambiaron (10% o más) frente al mes anterior.
  // Se excluye "Ahorro" porque ahorrar más no es un gasto que preocupe.
  const cc = F.byCategory(cur, cats), pc = F.byCategory(prev, cats);
  cc.filter((x) => x.cat.id !== "ahorro")
    .map((x) => { const p = pc.find((y) => y.cat.id === x.cat.id); return p ? { x, ch: F.change(x.amount, p.amount) } : null; })
    .filter((z) => z && Math.abs(z.ch) >= 10)
    .sort((a, b) => Math.abs(b.ch) - Math.abs(a.ch)).slice(0, 2)
    .forEach((z) => out.push({ tone: z.ch > 0 ? "warn" : "good", text: `Este mes tus gastos de ${z.x.cat.name.toLowerCase()} ${z.ch > 0 ? "aumentaron" : "bajaron"} ${pct(Math.abs(z.ch))}.` }));

  // Paso 6: la categoría que concentra más gasto.
  if (cc[0]) out.push({ tone: "info", text: `${cc[0].cat.name} concentra el ${pct(cc[0].pct)} de tus gastos del mes (${money(cc[0].amount)}).` });

  // Paso 7: presupuestos usados al 70% o más, y los excedidos con cuánto se pasó.
  for (const c of cats.filter((c) => c.type === "expense")) {
    const b = F.budgetFor(s.budgets, c.id, ym);
    if (!b.amount) continue;
    const spent = (cc.find((x) => x.cat.id === c.id) || {}).amount || 0;
    const p = (spent / b.amount) * 100;
    if (p > 100) out.push({ tone: "bad", text: `Superaste tu presupuesto de ${c.name.toLowerCase()} por ${money(spent - b.amount)} (${pct(p)} usado).` });
    else if (p >= 70) out.push({ tone: "warn", text: `Has gastado el ${pct(p)} de tu presupuesto de ${c.name.toLowerCase()}.` });
  }

  // Paso 8: comparación del ahorro con el mes anterior y tasa de ahorro sobre ingresos.
  const sv = F.savings(cur), psv = F.savings(prev);
  if (psv > 0 && sv > psv) out.push({ tone: "good", text: `Tu ahorro aumentó ${pct(F.change(sv, psv))} respecto al mes anterior.` });
  else if (psv > 0 && sv < psv) out.push({ tone: "warn", text: `Este mes llevas ${money(psv - sv)} menos de ahorro que en ${prevName}.` });
  if (sv > 0 && T.income > 0) out.push({ tone: "info", text: `Estás ahorrando el ${pct((sv / T.income) * 100)} de tus ingresos.` });
  // Paso 9: avance hacia la meta de ahorro mensual.
  const goal = s.settings.savings_monthly;
  if (goal > 0 && sv > 0) out.push({ tone: sv >= goal ? "good" : "info", text: sv >= goal ? `Cumpliste tu meta de ahorro mensual de ${money(goal)}.` : `Llevas el ${pct((sv / goal) * 100)} de tu meta de ahorro mensual; te faltan ${money(goal - sv)}.` });

  // Paso 10: proyección (solo en el mes en curso):
  // gasto diario promedio hasta hoy multiplicado por los días del mes.
  if (ym === currentYM()) {
    const day = new Date().getDate(), dim = daysInMonth(ym);
    if (day < dim && T.expense > 0) out.push({ tone: "info", text: `A este ritmo, cerrarás el mes con gastos cercanos a ${money((T.expense / day) * dim)}.` });
  }

  // Paso 11: el gasto individual más grande del mes (sin contar el ahorro).
  const big = cur.filter((t) => t.type === "expense" && t.categoryId !== "ahorro").sort((a, b) => b.amount - a.amount)[0];
  if (big) out.push({ tone: "info", text: `Tu mayor gasto fue ${(big.description || catName(cats, big.categoryId)).toLowerCase()} por ${money(big.amount)}, el ${dayLabel(big.date)}.` });

  const today = todayISO();
  // Paso 12: deudas vencidas o que vencen en los próximos 15 días.
  for (const d of s.debts) {
    if (d.remaining_amount <= 0 || !d.due_date) continue;
    const diff = daysBetween(today, d.due_date);
    if (diff < 0) out.push({ tone: "bad", text: `La deuda "${d.name}" tiene la fecha límite vencida desde el ${dayLabel(d.due_date)}.` });
    else if (diff <= 15) out.push({ tone: "warn", text: `La cuota de "${d.name}" (${money(d.installment)}) vence en ${diff === 0 ? "hoy" : diff + (diff === 1 ? " día" : " días")}.` });
  }
  return out;
}
// Devuelve el nombre de una categoría por su id (o "Sin categoría" si ya no existe).
const catName = (cats, id) => (cats.find((c) => c.id === id) || { name: "Sin categoría" }).name;
// Devuelve el objeto completo de la categoría (nombre, color...) por su id.
const catOf = (cats, id) => cats.find((c) => c.id === id) || { id, name: "Sin categoría", color: "#666" };

/* =========================================================
   VALIDACIÓN (se usa en la UI y otra vez dentro del store)
   ========================================================= */
// VALIDACIÓN de un movimiento. Devuelve un objeto con los errores encontrados
// (vacío si todo está bien). Se usa en el formulario Y otra vez antes de guardar.
// Paso 1: el tipo debe ser "income" o "expense".
// Paso 2: el monto debe ser un número mayor que 0.
// Paso 3: la categoría debe existir y coincidir con el tipo (no un "Salario" como gasto).
// Paso 4: la fecha debe tener formato AAAA-MM-DD y ser válida.
// Paso 5: el método de pago debe estar en la lista.
// Paso 6: la nota no puede pasar de 120 caracteres.
function validateTx(d, cats) {
  const e = {};
  if (d.type !== "income" && d.type !== "expense") e.type = "Elige si es gasto o ingreso.";
  if (!Number.isFinite(d.amount) || d.amount <= 0) e.amount = "Escribe un monto mayor que 0.";
  else if (d.amount > 1e12) e.amount = "El monto es demasiado alto.";
  const c = cats.find((x) => x.id === d.categoryId);
  if (!c) e.categoryId = "Elige una categoría.";
  else if (d.type && c.type !== d.type) e.categoryId = "La categoría no corresponde al tipo de movimiento.";
  if (!d.date || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || isNaN(new Date(d.date + "T12:00:00"))) e.date = "Elige una fecha válida.";
  if (!PAYMENT_METHODS.some((p) => p.id === d.paymentMethod)) e.paymentMethod = "Elige un método de pago.";
  if ((d.description || "").length > 120) e.description = "La nota admite hasta 120 caracteres.";
  return e;
}
// Error especial que lleva adentro la lista de errores por campo, para mostrarlos en el formulario.
class ValidationError extends Error { constructor(errors) { super(Object.values(errors)[0]); this.errors = errors; } }
