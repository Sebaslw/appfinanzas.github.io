/* ============================================================
   js/datos-demo.js
   Datos de demostración y estado vacío.
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   DATOS DE DEMOSTRACIÓN (registros reales, relativos al mes actual)
   ========================================================= */
// DATOS DE DEMOSTRACIÓN: crea registros REALES (no texto fijo) relativos al mes actual,
// para que la app tenga algo que mostrar si el usuario elige "Ver con datos de ejemplo".
function buildDemo() {
  const ym = currentYM();
  // Función auxiliar que fabrica un movimiento completo.
  // Recibe el mes, el día, tipo, monto, categoría, descripción y método de pago.
  // Si el día no existe en ese mes (ej. 31 de febrero) usa el último día.
  const mk = (m, day, type, amount, categoryId, description, paymentMethod) => {
    const d = Math.min(day, daysInMonth(m));
    const now = new Date().toISOString();
    return { id: uid(), user_id: "local", type, amount, categoryId, description, paymentMethod, date: `${m}-${pad(d)}`, created_at: now, updated_at: now };
  };
  const tx = [];
  // Mes actual: ingresos $975.000 · gastos $606.200 · saldo $368.800
  // Movimientos del mes actual. Suman: ingresos $975.000, gastos $606.200, saldo $368.800.
  // Formato de cada fila: [día, tipo, monto, categoría, descripción, método].
  const cur = [
    [1, "income", 880000, "salario", "Salario", "transferencia"],
    [15, "income", 95000, "independiente", "Freelance", "nequi"],
    [1, "expense", 250000, "vivienda", "Alquiler", "transferencia"],
    [5, "expense", 45100, "servicios", "Energía y agua", "debito"],
    [6, "expense", 28900, "servicios", "Internet hogar", "debito"],
    [7, "expense", 58000, "alimentacion", "Supermercado", "debito"],
    [19, "expense", 36000, "alimentacion", "Supermercado", "debito"],
    [20, "expense", 21000, "alimentacion", "Supermercado · Éxito", "efectivo"],
    [16, "expense", 5400, "alimentacion", "Café", "nequi"],
    [22, "expense", 6800, "alimentacion", "Comidas afuera · Delivery", "daviplata"],
    [14, "expense", 60000, "ahorro", "Ahorro mensual", "transferencia"],
    [11, "expense", 32000, "ropa", "Camiseta y medias", "credito"],
    [13, "expense", 15000, "ocio", "Show", "efectivo"],
    [21, "expense", 11000, "ocio", "Cine", "debito"],
    [23, "expense", 3500, "salud", "Farmacia", "efectivo"],
    [18, "expense", 9000, "transporte", "Recarga bus", "efectivo"],
    [10, "expense", 12000, "transporte", "Taxi", "efectivo"],
    [3, "expense", 4500, "suscripciones", "Streaming", "credito"],
    [24, "expense", 8000, "otros", "Regalo cumpleaños", "efectivo"],
  ];
  // Convierte cada fila en un movimiento real y lo agrega a la lista.
  cur.forEach((r) => tx.push(mk(ym, ...r)));
  // 5 meses anteriores con variación determinística
  // 5 meses anteriores: los montos se multiplican por un factor distinto cada mes
  // para que los gráficos muestren variación (siempre igual, no aleatoria).
  const f = [0.92, 1.05, 0.88, 1.12, 0.97];
  for (let i = 1; i <= 5; i++) {
    const m = shiftYM(ym, -i), k = f[i - 1];
    const r = (v) => Math.round((v * k) / 100) * 100;
    tx.push(mk(m, 1, "income", 880000, "salario", "Salario", "transferencia"));
    if (i % 2 === 1) tx.push(mk(m, 16, "income", r(120000), "independiente", "Freelance", "nequi"));
    tx.push(mk(m, 1, "expense", 250000, "vivienda", "Alquiler", "transferencia"));
    tx.push(mk(m, 5, "expense", r(70000), "servicios", "Energía, agua e internet", "debito"));
    tx.push(mk(m, 8, "expense", r(96000), "alimentacion", "Supermercado", "debito"));
    tx.push(mk(m, 22, "expense", r(41000), "alimentacion", "Supermercado", "debito"));
    tx.push(mk(m, 12, "expense", r(18000), "alimentacion", "Comidas afuera", "nequi"));
    tx.push(mk(m, 14, "expense", i === 2 ? 30000 : 50000, "ahorro", "Ahorro mensual", "transferencia"));
    tx.push(mk(m, 9, "expense", r(19000), "transporte", "Recargas bus", "efectivo"));
    tx.push(mk(m, 3, "expense", 4500, "suscripciones", "Streaming", "credito"));
    tx.push(mk(m, 18, "expense", r(22000), "ocio", "Salida con amigos", "efectivo"));
    if (i === 3) tx.push(mk(m, 20, "expense", 48000, "salud", "Consulta médica", "debito"));
    if (i === 4) tx.push(mk(m, 11, "expense", 65000, "ropa", "Zapatos", "credito"));
    if (i === 2) tx.push(mk(m, 25, "expense", 90000, "deudas", "Cuota tarjeta", "transferencia"));
  }
  // Año y mes actuales, para fechar los presupuestos de ejemplo.
  const [y, mo] = ym.split("-").map(Number);
  // Crea un presupuesto de ejemplo para una categoría en el mes actual.
  const bud = (category_id, amount) => ({ id: uid(), user_id: "local", category_id, month: mo, year: y, amount });
  // Crea una fecha límite desplazada "off" meses desde el actual (para metas y deudas).
  const due = (off, day) => { const m = shiftYM(ym, off); return `${m}-${pad(Math.min(day, daysInMonth(m)))}`; };
  return {
    version: 1,
    profile: { id: "local", name: "Tu nombre", email: "", created_at: new Date().toISOString() },
    categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })),
    transactions: tx,
    budgets: [bud("alimentacion", 90000), bud("vivienda", 280000), bud("transporte", 150000), bud("ropa", 20000), bud("ocio", 60000), bud("servicios", 80000)],
    goals: [
      { id: uid(), user_id: "local", name: "Fondo de emergencia", target_amount: 2000000, current_amount: 780000, deadline: due(6, 30) },
      { id: uid(), user_id: "local", name: "Viaje a Providencia", target_amount: 600000, current_amount: 180000, deadline: due(3, 15) },
    ],
    debts: [
      { id: uid(), user_id: "local", name: "Tarjeta de crédito", creditor: "Banco", initial_amount: 1200000, remaining_amount: 720000, installment: 120000, due_date: due(1, 5), status: "Al día" },
      { id: uid(), user_id: "local", name: "Préstamo moto", creditor: "Cooperativa", initial_amount: 3500000, remaining_amount: 2450000, installment: 175000, due_date: due(0, 28), status: "Al día" },
    ],
    settings: { savings_monthly: 300000, savings_annual: 3600000, onboarded: true },
    isDemo: true,
  };
}
// ESTADO VACÍO: lo que tiene la app cuando el usuario empieza con sus propios datos.
// Solo trae las categorías predeterminadas; todo lo demás está en cero.
const emptyState = () => ({
  version: 1, profile: { id: "local", name: "Tu nombre", email: "", created_at: new Date().toISOString() },
  categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), transactions: [], budgets: [], goals: [], debts: [],
  settings: { savings_monthly: 0, savings_annual: 0, onboarded: true },
  isDemo: false,
});
