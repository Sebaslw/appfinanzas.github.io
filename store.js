/* ============================================================
   js/store.js
   Store global y acciones (crear, editar, borrar...).
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   STORE (patrón tipo Zustand con useSyncExternalStore)
   ========================================================= */
// STORE GLOBAL (patrón tipo Zustand): un único lugar con todos los datos de la app.
// - get(): devuelve el estado actual.
// - init(s): carga el estado inicial SIN guardarlo (viene de almacenamiento).
// - set(next, meta): reemplaza el estado, avisa a los componentes y lo guarda.
// - subscribe(f): los componentes se suscriben para redibujarse cuando algo cambia.
const store = (() => {
  let state = null; const subs = new Set();
  return {
    get: () => state,
    init(s) { state = s; subs.forEach((f) => f()); },
    set(next, meta = {}) { state = next; subs.forEach((f) => f()); Storage.schedule(next, meta); },
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
})();
// Hook para que cualquier componente lea el estado global y se actualice solo.
const useApp = () => useSyncExternalStore(store.subscribe, store.get);

// Limpia los datos de un movimiento antes de guardarlo:
// convierte el monto a número, quita espacios de la nota y la corta en 120 caracteres.
const clean = (d) => ({
  type: d.type, amount: Number(d.amount), categoryId: d.categoryId, date: d.date,
  description: String(d.description || "").trim().slice(0, 120), paymentMethod: d.paymentMethod,
});
// ACCIONES: la única forma de modificar los datos (como un pequeño "backend").
// Cada acción valida, crea el nuevo estado sin modificar el anterior (inmutable)
// y llama a store.set() indicando qué meses o si la configuración cambiaron.
const actions = {
  // Agregar movimiento.
  // Paso 1: limpia y valida (aunque el formulario ya validó: nunca confiar solo en la interfaz).
  // Paso 2: si hay errores, lanza ValidationError.
  // Paso 3: crea el registro con id, fechas de creación/actualización y lo agrega a la lista.
  addTransaction(data) {
    const s = store.get(); const d = clean(data); const e = validateTx(d, s.categories);
    if (Object.keys(e).length) throw new ValidationError(e);
    const now = new Date().toISOString();
    const t = { id: uid(), user_id: s.profile.id, ...d, created_at: now, updated_at: now };
    store.set({ ...s, transactions: [...s.transactions, t] }, { months: [d.date.slice(0, 7)] });
    return t;
  },
  // Editar movimiento.
  // Paso 1: valida igual que al crear. Paso 2: busca el original.
  // Paso 3: reemplaza sus datos y actualiza updated_at.
  // Se marcan el mes viejo y el nuevo por si cambió la fecha de mes.
  updateTransaction(id, data) {
    const s = store.get(); const d = clean(data); const e = validateTx(d, s.categories);
    if (Object.keys(e).length) throw new ValidationError(e);
    const old = s.transactions.find((t) => t.id === id); if (!old) throw new Error("El movimiento ya no existe.");
    store.set({ ...s, transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...d, updated_at: new Date().toISOString() } : t)) },
      { months: [old.date.slice(0, 7), d.date.slice(0, 7)] });
  },
  // Eliminar movimiento. Devuelve el registro borrado para poder "Deshacer".
  deleteTransaction(id) {
    const s = store.get(); const old = s.transactions.find((t) => t.id === id); if (!old) return;
    store.set({ ...s, transactions: s.transactions.filter((t) => t.id !== id) }, { months: [old.date.slice(0, 7)] });
    return old;
  },
  // Deshacer una eliminación: vuelve a agregar el registro si no existe.
  restoreTransaction(t) {
    const s = store.get(); if (s.transactions.some((x) => x.id === t.id)) return;
    store.set({ ...s, transactions: [...s.transactions, t] }, { months: [t.date.slice(0, 7)] });
  },
  // Duplicar: copia el movimiento con la fecha de hoy y lo guarda como nuevo.
  duplicateTransaction(id) {
    const s = store.get(); const t = s.transactions.find((x) => x.id === id); if (!t) return;
    return actions.addTransaction({ ...t, date: todayISO() });
  },
  // Crear categoría personalizada.
  // Paso 1: valida que tenga nombre, máximo 30 caracteres y que no esté repetida.
  // Paso 2: elige un color que todavía no se use.
  // Paso 3: la guarda con custom:true (se podrá borrar).
  addCategory({ name, type }) {
    const s = store.get(); const n = String(name || "").trim();
    if (!n) throw new Error("Escribe un nombre para la categoría.");
    if (n.length > 30) throw new Error("El nombre admite hasta 30 caracteres.");
    if (s.categories.some((c) => c.type === type && c.name.toLowerCase() === n.toLowerCase())) throw new Error("Ya existe una categoría con ese nombre.");
    const used = new Set(s.categories.map((c) => c.color));
    const color = EXTRA_COLORS.find((c) => !used.has(c)) || EXTRA_COLORS[s.categories.length % EXTRA_COLORS.length];
    const c = { id: "c-" + uid().slice(0, 8), user_id: s.profile.id, name: n, type, color, icon: "tag", custom: true };
    store.set({ ...s, categories: [...s.categories, c] }, { config: true });
    return c;
  },
  // Borrar categoría personalizada.
  // Paso 1: solo se pueden borrar las creadas por el usuario.
  // Paso 2: sus movimientos pasan a "Otros"/"Otros ingresos" (no se pierde dinero registrado).
  // Paso 3: se eliminan también sus presupuestos.
  deleteCategory(id) {
    const s = store.get(); const c = s.categories.find((x) => x.id === id); if (!c || !c.custom) return 0;
    const fb = FALLBACK_CAT[c.type]; const months = new Set(); let moved = 0;
    const transactions = s.transactions.map((t) => { if (t.categoryId !== id) return t; moved++; months.add(t.date.slice(0, 7)); return { ...t, categoryId: fb, updated_at: new Date().toISOString() }; });
    store.set({ ...s, transactions, categories: s.categories.filter((x) => x.id !== id), budgets: s.budgets.filter((b) => b.category_id !== id) }, { months: [...months], config: true });
    return moved;
  },
  // Fijar presupuesto de una categoría para un mes.
  // Paso 1: valida que sea un número positivo (o null = sin límite).
  // Paso 2: quita el presupuesto anterior de ESE mes y guarda el nuevo.
  setBudget(catId, ym, amount) {
    const s = store.get(); const [year, month] = ym.split("-").map(Number);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) throw new Error("El presupuesto debe ser un número positivo.");
    const rest = s.budgets.filter((b) => !(b.category_id === catId && b.year === year && b.month === month));
    store.set({ ...s, budgets: [...rest, { id: uid(), user_id: s.profile.id, category_id: catId, month, year, amount: amount || null }] }, { config: true });
  },
  // Actualiza ajustes (metas de ahorro, bienvenida vista...) mezclando con los actuales.
  setSettings(patch) { const s = store.get(); store.set({ ...s, settings: { ...s.settings, ...patch } }, { config: true }); },
  // Actualiza el perfil (nombre, correo).
  setProfile(patch) { const s = store.get(); store.set({ ...s, profile: { ...s.profile, ...patch } }, { config: true }); },
  // Crear o editar una meta de ahorro.
  // Valida nombre y montos; si trae id la edita, si no, la crea con un id nuevo.
  saveGoal(g) {
    const s = store.get();
    if (!String(g.name || "").trim()) throw new Error("Escribe un nombre para la meta.");
    if (!(g.target_amount > 0)) throw new Error("La meta debe ser mayor que 0.");
    if (g.current_amount < 0) throw new Error("El monto ahorrado no puede ser negativo.");
    const goal = { user_id: s.profile.id, ...g, name: g.name.trim() };
    const goals = g.id ? s.goals.map((x) => (x.id === g.id ? { ...x, ...goal } : x)) : [...s.goals, { ...goal, id: uid() }];
    store.set({ ...s, goals }, { config: true });
  },
  // Eliminar una meta de ahorro.
  deleteGoal(id) { const s = store.get(); store.set({ ...s, goals: s.goals.filter((g) => g.id !== id) }, { config: true }); },
  // Abonar a una meta.
  // Paso 1: suma el abono al monto ahorrado de la meta.
  // Paso 2: si el usuario lo pidió, también registra un gasto en la categoría Ahorro.
  contributeGoal(id, amount, registerTx) {
    if (!(amount > 0)) throw new Error("Escribe un monto mayor que 0.");
    const s = store.get(); const g = s.goals.find((x) => x.id === id); if (!g) return;
    store.set({ ...s, goals: s.goals.map((x) => (x.id === id ? { ...x, current_amount: x.current_amount + amount } : x)) }, { config: true });
    if (registerTx) actions.addTransaction({ type: "expense", amount, categoryId: "ahorro", date: todayISO(), description: `Abono: ${g.name}`, paymentMethod: "transferencia" });
  },
  // Crear o editar una deuda.
  // Paso 1: valida nombre, valor inicial y que el pendiente esté entre 0 y el inicial.
  // Paso 2: calcula el estado (Al día / Vencida / Pagada) y guarda.
  saveDebt(d) {
    const s = store.get();
    if (!String(d.name || "").trim()) throw new Error("Escribe un nombre para la deuda.");
    if (!(d.initial_amount > 0)) throw new Error("El valor inicial debe ser mayor que 0.");
    if (d.remaining_amount < 0 || d.remaining_amount > d.initial_amount) throw new Error("El valor pendiente debe estar entre 0 y el valor inicial.");
    if (d.installment < 0) throw new Error("La cuota no puede ser negativa.");
    const debt = { user_id: s.profile.id, ...d, name: d.name.trim() };
    debt.status = F.debtStatus(debt);
    const debts = d.id ? s.debts.map((x) => (x.id === d.id ? { ...x, ...debt } : x)) : [...s.debts, { ...debt, id: uid() }];
    store.set({ ...s, debts }, { config: true });
  },
  // Eliminar una deuda.
  deleteDebt(id) { const s = store.get(); store.set({ ...s, debts: s.debts.filter((d) => d.id !== id) }, { config: true }); },
  // Registrar pago de una deuda.
  // Paso 1: valida que el pago no supere lo pendiente.
  // Paso 2: descuenta el pago y recalcula el estado.
  // Paso 3: si el usuario lo pidió, registra el pago como gasto en la categoría Deudas.
  payDebt(id, amount, registerTx) {
    const s = store.get(); const d = s.debts.find((x) => x.id === id); if (!d) return;
    if (!(amount > 0)) throw new Error("Escribe un monto mayor que 0.");
    if (amount > d.remaining_amount) throw new Error(`El pago supera el saldo pendiente (${money(d.remaining_amount)}).`);
    const upd = { ...d, remaining_amount: d.remaining_amount - amount }; upd.status = F.debtStatus(upd);
    store.set({ ...s, debts: s.debts.map((x) => (x.id === id ? upd : x)) }, { config: true });
    if (registerTx) actions.addTransaction({ type: "expense", amount, categoryId: "deudas", date: todayISO(), description: `Pago: ${d.name}`, paymentMethod: "transferencia" });
  },
  // Reemplaza TODOS los datos (cargar demo, borrar todo, empezar de cero).
  // Marca como pendientes todos los meses del estado anterior y del nuevo para sincronizar.
  replaceAll(next) {
    const prev = store.get();
    const months = new Set([...(prev ? prev.transactions : []), ...next.transactions].map((t) => t.date.slice(0, 7)));
    store.set(next, { months: [...months], config: true });
  },
};
