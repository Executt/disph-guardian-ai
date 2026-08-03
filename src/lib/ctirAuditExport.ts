import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export type ExportScope = "page" | "all";

export type ExportMeta = {
  year: string;
  month: string;
  severity: string;
  kind: string;
  scope: ExportScope;
  tab: "runs" | "alerts";
};

const filtersLine = (m: ExportMeta) =>
  `Ano: ${m.year === "all" ? "todos" : m.year} · Mês: ${m.month === "all" ? "todos" : Number(m.month) + 1} · ` +
  `Severidade: ${m.severity} · Tipo: ${m.kind} · Escopo: ${m.scope === "page" ? "página atual" : "todos os filtrados"}`;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportCsv(headers: string[], rows: (string | number)[][], meta: ExportMeta) {
  const lines = [
    `# Auditoria CTIR — ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
    `# ${filtersLine(meta)}`,
    headers.map(esc).join(";"),
    ...rows.map(r => r.map(esc).join(";")),
  ];
  download(
    new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" }),
    `auditoria-ctir-${meta.tab}-${format(new Date(), "yyyyMMdd-HHmm")}.csv`,
  );
}

export function exportPdf(headers: string[], rows: (string | number)[][], meta: ExportMeta) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text("Auditoria de Sincronização CTIR", 40, 40);
  doc.setFontSize(9);
  doc.text(filtersLine(meta), 40, 58);
  doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} · ${rows.length} registro(s)`, 40, 72);
  autoTable(doc, {
    head: [headers],
    body: rows.map(r => r.map(c => String(c ?? ""))),
    startY: 88,
    styles: { fontSize: 7, cellPadding: 3, overflow: "linebreak" },
    headStyles: { fillColor: [11, 17, 32], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [244, 247, 250] },
  });
  doc.save(`auditoria-ctir-${meta.tab}-${format(new Date(), "yyyyMMdd-HHmm")}.pdf`);
}
