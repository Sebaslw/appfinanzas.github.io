/* ============================================================
   js/exportar.js
   Exportación a Excel, CSV y PDF.
   Se carga en orden desde index.html; todos los archivos comparten
   las mismas variables globales (no usan import/export).
   ============================================================ */
"use strict";
/* =========================================================
   EXPORTACIÓN (Excel, CSV, PDF)
   ========================================================= */
// Carga una librería externa SOLO cuando se necesita (al exportar), para que la app abra rápido.
// Paso 1: si ya está cargada (test() es verdadero) no hace nada.
// Paso 2: si no, agrega una etiqueta <script> y espera a que termine de cargar.
const loadScript = (src, test) => new Promise((res, rej) => {
  if (test()) return res();
  const s = document.createElement("script"); s.src = src; s.onload = () => (test() ? res() : rej(new Error("load"))); s.onerror = () => rej(new Error("load"));
  document.head.appendChild(s);
});
// GUARDAR ARCHIVO EXPORTADO.
// Paso 1: si la app está publicada en Claude, usa su capacidad de descargas.
// Paso 2: si no (por ejemplo, en localhost), crea un enlace temporal de descarga y lo "pulsa".
// Paso 3: libera la memoria del enlace unos segundos después.
async function saveFile(filename, data, mime) {
  const dl = await getCap("downloads");
  if (dl) {
    try { await dl.save({ filename, data }); toast(`Exportado: ${filename}`); }
    catch (e) { if (e && e.code === "declined") toast("Descarga cancelada", "info"); else toast("No se pudo exportar el archivo. Intenta de nuevo.", "danger"); }
    return;
  }
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast(`Exportado: ${filename}`);
}
// Convierte los movimientos en filas para exportar, ordenadas por fecha:
// [Fecha, Tipo, Categoría, Descripción, Método, Monto]. Los gastos van en negativo.
function exportRows(txs, cats) {
  return [...txs].sort((a, b) => a.date.localeCompare(b.date)).map((t) => [t.date, t.type === "income" ? "Ingreso" : "Gasto", catName(cats, t.categoryId), t.description || "", payName(t.paymentMethod), t.type === "income" ? t.amount : -t.amount]);
}
// Encabezados de las columnas exportadas.
const HEAD = ["Fecha", "Tipo", "Categoría", "Descripción", "Método de pago", "Monto (COP)"];
// MODAL DE EXPORTACIÓN.
// Paso 1: el usuario elige el periodo: mes actual, rango de fechas o todos.
// Paso 2: se filtran los movimientos de ese periodo.
// Paso 3: según el botón, se genera Excel, CSV o PDF y se descarga.
function ExportModal({ open, onClose, ym, preset }) {
  const app = useApp();
  const [scope, setScope] = useState("month"), [from, setFrom] = useState(""), [to, setTo] = useState(""), [busy, setBusy] = useState(null);
  useEffect(() => { if (open) { if (preset && (preset.from || preset.to)) { setScope("range"); setFrom(preset.from || ""); setTo(preset.to || ""); } else setScope("month"); } }, [open]);
  // Movimientos incluidos según el periodo elegido.
  const txs = useMemo(() => {
    if (scope === "month") return F.inMonth(app.transactions, ym);
    if (scope === "range") return app.transactions.filter((t) => (!from || t.date >= from) && (!to || t.date <= to));
    return app.transactions;
  }, [scope, from, to, app.transactions, ym]);
  // Texto del periodo para mostrar y para el PDF.
  const scopeText = scope === "month" ? ymLabel(ym) : scope === "range" ? `${from ? longDate(from) : "inicio"} a ${to ? longDate(to) : "hoy"}` : "Todos los movimientos";
  // Nombre base del archivo, por ejemplo "finanzas-2026-09".
  const base = `finanzas-${scope === "month" ? ym : scope === "range" ? `${from || "inicio"}_${to || "hoy"}` : "todo"}`;
  // Genera el archivo:
  // Paso 1: valida que haya movimientos y que el rango sea correcto.
  // Paso 2: muestra "Preparando…" en el botón.
  // Paso 3 (CSV): une las filas con comas, escapa comillas y agrega BOM para que Excel lea las tildes.
  // Paso 4 (Excel): carga SheetJS, crea la hoja "Movimientos" y la hoja "Resumen".
  // Paso 5 (PDF): carga jsPDF, escribe título, periodo y totales, y dibuja la tabla.
  // Paso 6: guarda el archivo y quita el estado de carga.
  const run = async (fmt) => {
    if (!txs.length) { toast("No hay movimientos en ese periodo.", "danger"); return; }
    if (scope === "range" && from && to && from > to) { toast('La fecha "Desde" es posterior a "Hasta".', "danger"); return; }
    setBusy(fmt);
    try {
      const rows = exportRows(txs, app.categories), T = F.totals(txs);
      if (fmt === "csv") {
        const esc = (v) => { const s = String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
        const csv = "\uFEFF" + [HEAD, ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
        await saveFile(base + ".csv", csv, "text/csv");
      } else if (fmt === "xlsx") {
        await loadScript("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js", () => window.XLSX);
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([HEAD, ...rows]); ws["!cols"] = [{ wch: 12 }, { wch: 9 }, { wch: 20 }, { wch: 32 }, { wch: 16 }, { wch: 14 }];
        XLSX.utils.book_append_sheet(wb, ws, "Movimientos");
        const byCat = F.byCategory(txs, app.categories).map((r) => [r.cat.name, r.amount, Number(r.pct.toFixed(2))]);
        const ws2 = XLSX.utils.aoa_to_sheet([["Periodo", scopeText], [], ["Ingresos", T.income], ["Gastos", T.expense], ["Saldo", T.balance], [], ["Categoría", "Gasto (COP)", "% del gasto"], ...byCat]);
        ws2["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, "Resumen");
        const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        await saveFile(base + ".xlsx", new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      } else {
        await loadScript("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js", () => window.jspdf);
        await loadScript("https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js", () => window.jspdf && window.jspdf.jsPDF.API.autoTable);
        const doc = new window.jspdf.jsPDF({ unit: "pt", format: "a4" });
        doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("Finanzas: movimientos", 40, 50);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
        doc.text(`${app.profile.name || ""}  ·  ${scopeText}  ·  generado el ${longDate(todayISO())}`, 40, 68);
        doc.setTextColor(20); doc.setFontSize(11);
        doc.text(`Ingresos: ${money(T.income)}     Gastos: ${money(T.expense)}     Saldo: ${money(T.balance)}`, 40, 90);
        doc.autoTable({ startY: 104, head: [HEAD], body: rows.map((r) => [...r.slice(0, 5), (r[5] < 0 ? "-" : "+") + "$ " + groupThousands(r[5])]),
          styles: { fontSize: 9, cellPadding: 5 }, headStyles: { fillColor: [232, 106, 58] }, columnStyles: { 5: { halign: "right" } }, alternateRowStyles: { fillColor: [247, 244, 242] } });
        await saveFile(base + ".pdf", doc.output("blob"));
      }
    } catch (e) { toast("No se pudo cargar la herramienta de exportación. Revisa tu conexión.", "danger"); }
    setBusy(null);
  };
  return html`<${Modal} open=${open} onClose=${onClose} title="Exportar movimientos" width=${480}>
    <fieldset><legend>Periodo</legend>
      <div className="radio-row">
        ${[["month", `Mes actual (${ymShort(ym)})`], ["range", "Rango de fechas"], ["all", "Todos"]].map(([k, l]) => html`<label key=${k} className="radio"><input type="radio" name="exp-scope" checked=${scope === k} onChange=${() => setScope(k)} />${l}</label>`)}
      </div></fieldset>
    ${scope === "range" && html`<div className="two">
      <div className="field"><label htmlFor="ex-f">Desde</label><input id="ex-f" type="date" className="input" value=${from} onChange=${(e) => setFrom(e.target.value)} /></div>
      <div className="field"><label htmlFor="ex-t">Hasta</label><input id="ex-t" type="date" className="input" value=${to} onChange=${(e) => setTo(e.target.value)} /></div></div>`}
    <p className="small muted" style=${{ marginTop: 0 }}><b className="num" style=${{ color: "var(--text)" }}>${txs.length}</b> movimientos en ${scopeText}.</p>
    <div className="grid-kpi" style=${{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
      ${[["xlsx", "Exportar Excel"], ["csv", "Exportar CSV"], ["pdf", "Exportar PDF"]].map(([k, l]) => html`<button key=${k} className=${"btn " + (k === "xlsx" ? "primary" : "")} disabled=${!!busy} onClick=${() => run(k)}>
        ${busy === k ? html`<span className="spin" aria-hidden="true"></span>Preparando…` : html`<${Icon} name="download" size=${15} />${l}`}</button>`)}
    </div>
  <//>`;
}
