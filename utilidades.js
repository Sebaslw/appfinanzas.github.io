/* ============================================================
   js/utilidades.js
   Utilidades (fechas, formato COP, ids) y catálogos (métodos de pago, categorías).
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
// Paso 1: tomamos los "hooks" de React desde el objeto global React
// (React se carga con una etiqueta <script> en el HTML, sin instalar nada).
// - useState: guarda un valor que, al cambiar, vuelve a dibujar el componente.
// - useEffect: ejecuta código después de dibujar (cargar datos, escuchar teclas...).
// - useMemo: recuerda un cálculo y solo lo repite si cambian sus datos.
// - useRef: guarda una referencia (por ejemplo, a un elemento del DOM).
// - useSyncExternalStore: conecta React con nuestro "store" global de datos.
const { useState, useEffect, useMemo, useRef, useSyncExternalStore } = React;
// Paso 2: htm nos deja escribir HTML dentro de plantillas html`...`
// y lo convierte en elementos de React. Así no necesitamos compilar JSX.
const html = htm.bind(React.createElement);

/* =========================================================
   UTILIDADES (fechas, formato COP, ids)
   ========================================================= */
// Agrega un cero a la izquierda a números de un dígito.
// Ejemplo: pad(5) -> "05". Se usa para armar fechas como 2026-09-05.
const pad = (n) => String(n).padStart(2, "0");
// Convierte un objeto Date en texto "AAAA-MM-DD" usando la hora LOCAL.
// Se evita toISOString() porque usa UTC y en Colombia (UTC-5) puede cambiar el día.
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// Devuelve la fecha de hoy como texto, por ejemplo "2026-09-25".
const todayISO = () => toISO(new Date());
// Devuelve el mes actual como "AAAA-MM" (los primeros 7 caracteres de la fecha).
const currentYM = () => todayISO().slice(0, 7);
// Mueve un mes hacia adelante o hacia atrás.
// Paso 1: separa "2026-09" en año (2026) y mes (9).
// Paso 2: convierte todo a "meses totales" (año*12 + mes-1) y le suma n.
// Paso 3: vuelve a convertir a año y mes. Ejemplo: shiftYM("2026-01", -1) -> "2025-12".
const shiftYM = (ym, n) => {
  let [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`;
};
// Cuántos días tiene un mes. Truco: el "día 0" del mes siguiente
// es el último día del mes que nos interesa.
const daysInMonth = (ym) => { const [y, m] = ym.split("-").map(Number); return new Date(y, m, 0).getDate(); };
// Nombres de los meses en español (completos y abreviados).
const MONTHS = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
// Pone en mayúscula la primera letra: "septiembre" -> "Septiembre".
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// Texto del mes para mostrar: "2026-09" -> "Septiembre 2026".
const ymLabel = (ym) => { const [y, m] = ym.split("-").map(Number); return `${cap(MONTHS[m - 1])} ${y}`; };
// Mes abreviado para el gráfico de barras: "2026-09" -> "Sep".
const ymShort = (ym) => cap(MONTHS_SHORT[Number(ym.slice(5, 7)) - 1]);
// Solo el nombre del mes en minúsculas: "2026-09" -> "septiembre".
const monthName = (ym) => MONTHS[Number(ym.slice(5, 7)) - 1];
// Fecha corta para las listas: "2026-09-20" -> "20 sep".
const dayLabel = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS_SHORT[m - 1]}`; };
// Fecha larga: "2026-09-20" -> "20 de septiembre de 2026".
const longDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} de ${MONTHS[m - 1]} de ${y}`; };
// Días entre dos fechas. Se usan las 12:00 del día para que los
// cambios de horario no den medio día de diferencia.
const daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);

// Formato colombiano manual: separador de miles "." (Intl no agrupa 4 dígitos en es)
// FORMATO COLOMBIANO de miles con punto: 1250000 -> "1.250.000".
// Paso 1: redondea y quita el signo (el signo se agrega aparte).
// Paso 2: una expresión regular inserta un punto cada 3 cifras desde la derecha.
// (Se hace a mano porque Intl en español no separa números de 4 cifras: 5400 quedaría "5400").
const groupThousands = (n) => String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
// Formatea dinero con signo negativo si aplica: -21000 -> "-$ 21.000".
const money = (n) => (n < 0 ? "-" : "") + "$ " + groupThousands(n);
// Formato con + para ingresos y - para gastos: "+$ 95.000" / "-$ 21.000".
const signedMoney = (n, type) => (type === "income" ? "+" : "-") + "$ " + groupThousands(n);
// Formato corto para el calendario: 21000 -> "21 mil", 1500000 -> "1,5 M".
const compact = (n) => {
  const a = Math.abs(n);
  if (a >= 1e6) return (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace(".", ",") + " M";
  if (a >= 1e3) return Math.round(a / 1e3) + " mil";
  return String(Math.round(a));
};
// Formatea porcentajes para mostrar.
// - Menores a 10 y con decimales: un decimal con coma (6,2%).
// - Si no: número entero (41%). El redondeo solo ocurre aquí, nunca en los cálculos.
const pct = (p) => {
  const a = Math.abs(p);
  const s = a < 10 && Math.round(a * 10) % 10 !== 0 ? a.toFixed(1).replace(".", ",") : String(Math.round(a));
  return (p < 0 ? "-" : "") + s + "%";
};
// Limpia lo que escribe el usuario en un monto: deja solo dígitos
// y quita ceros a la izquierda. "$ 12.500" -> "12500".
const digitsOnly = (s) => String(s || "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
// Genera un identificador único para cada registro.
// Usa crypto.randomUUID() si el navegador lo tiene; si no, combina hora + número aleatorio.
const uid = () => (crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

/* =========================================================
   CATÁLOGOS
   ========================================================= */
// Lista fija de métodos de pago: id interno (se guarda) y nombre visible.
const PAYMENT_METHODS = [
  { id: "efectivo", name: "Efectivo" },
  { id: "debito", name: "Tarjeta débito" },
  { id: "credito", name: "Tarjeta crédito" },
  { id: "transferencia", name: "Transferencia" },
  { id: "nequi", name: "Nequi" },
  { id: "daviplata", name: "Daviplata" },
  { id: "otro", name: "Otro" },
];
// Busca el nombre visible de un método de pago a partir de su id.
const payName = (id) => (PAYMENT_METHODS.find((p) => p.id === id) || { name: "Otro" }).name;

// Categorías predeterminadas. Cada fila es [id, nombre, tipo, color].
// Paso 1: se escriben como listas cortas para que sea fácil leerlas.
// Paso 2: .map() las convierte en objetos { id, name, type, color, icon, custom:false }.
// custom:false significa que el usuario no puede borrarlas.
const DEFAULT_CATEGORIES = [
  ["alimentacion", "Alimentación", "expense", "#F4A261"],
  ["transporte", "Transporte", "expense", "#8AB17D"],
  ["vivienda", "Vivienda", "expense", "#E86A3A"],
  ["servicios", "Servicios", "expense", "#E9C46A"],
  ["salud", "Salud", "expense", "#5FA8A0"],
  ["educacion", "Educación", "expense", "#6C9BD2"],
  ["suscripciones", "Suscripciones", "expense", "#9D8DF1"],
  ["ropa", "Ropa", "expense", "#D484C4"],
  ["ocio", "Ocio", "expense", "#E07A7A"],
  ["ahorro", "Ahorro", "expense", "#7CC49A"],
  ["deudas", "Deudas", "expense", "#B8876A"],
  ["otros", "Otros", "expense", "#8A8A8A"],
  ["salario", "Salario", "income", "#3FB950"],
  ["independiente", "Trabajo independiente", "income", "#7CC49A"],
  ["ventas", "Ventas", "income", "#5FA8A0"],
  ["regalos", "Regalos", "income", "#E9C46A"],
  ["otros-ingresos", "Otros ingresos", "income", "#8A8A8A"],
].map(([id, name, type, color]) => ({ id, name, type, color, icon: "tag", custom: false }));
// Colores que se asignan a las categorías nuevas que cree el usuario.
const EXTRA_COLORS = ["#F28A62","#C9A0DC","#A3C4F3","#FFD6A5","#90DBF4","#CDB4DB","#B9FBC0","#FFADAD","#9BF6FF","#FDFFB6"];
// Si se borra una categoría personalizada, sus movimientos pasan aquí:
// gastos -> "Otros", ingresos -> "Otros ingresos".
const FALLBACK_CAT = { expense: "otros", income: "otros-ingresos" };
