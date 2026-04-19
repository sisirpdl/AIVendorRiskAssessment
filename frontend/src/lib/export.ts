import type { QueryAnswer } from "./types";

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function answersToCsv(answers: QueryAnswer[]): string {
  const headers = [
    "question_id",
    "domain",
    "question",
    "verdict",
    "answer",
    "confidence",
    "source",
    "status",
  ];
  const lines = [headers.join(",")];
  for (const a of answers) {
    const row = [
      a.question_id,
      a.domain,
      a.question,
      a.verdict,
      a.answer ?? "",
      a.idk ? "" : (a.confidence * 100).toFixed(0) + "%",
      a.idk ? "" : a.source,
      a.status,
    ].map((v) => csvEscape(String(v)));
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- PDF ---
// Structured, selectable-text PDF of a CAIQ report. Uses jsPDF + autoTable so
// the output prints cleanly and the answer text stays copyable.

export interface PdfReportMeta {
  vendorName: string;
  filename: string;
  total: number;
  yes: number;
  no: number;
  unresolved: number;
}

export async function downloadReportPdf(
  outFilename: string,
  meta: PdfReportMeta,
  answers: QueryAnswer[],
): Promise<void> {
  const { default: jsPDF } = await import("jspdf");
  const autoTableMod = await import("jspdf-autotable");
  const autoTable = (autoTableMod as { default: (doc: unknown, opts: unknown) => void }).default;

  const doc = new jsPDF({ unit: "pt", format: "letter" });

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Verifai Trust Report", 40, 48);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Vendor: ${meta.vendorName}`, 40, 66);
  doc.text(`Source: ${meta.filename}`, 40, 80);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 94);

  // Summary pills
  doc.setTextColor(20);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(
    `Total ${meta.total}     Yes ${meta.yes}     No ${meta.no}     Unresolved ${meta.unresolved}`,
    40,
    118,
  );

  // Table of answers
  autoTable(doc, {
    startY: 140,
    theme: "grid",
    head: [["ID", "Domain", "Question", "Verdict", "Source", "Conf", "Answer"]],
    body: answers.map((a) => [
      a.question_id,
      a.domain,
      a.question,
      a.verdict === "N_A" ? "N/A" : a.verdict,
      a.idk ? "" : a.source,
      a.idk ? "" : `${Math.round(a.confidence * 100)}%`,
      a.answer ?? "",
    ]),
    headStyles: { fillColor: [24, 24, 27], textColor: 240, fontStyle: "bold", fontSize: 9 },
    styles: { fontSize: 8.5, cellPadding: 4, overflow: "linebreak", valign: "top" },
    columnStyles: {
      0: { cellWidth: 46, fontStyle: "bold" },
      1: { cellWidth: 80 },
      2: { cellWidth: 160 },
      3: { cellWidth: 42, halign: "center" },
      4: { cellWidth: 40, halign: "center" },
      5: { cellWidth: 34, halign: "right" },
      6: { cellWidth: "auto" },
    },
    didParseCell: (data: { section: string; column: { index: number }; cell: { styles: Record<string, unknown> }; row: { raw: unknown[] } }) => {
      if (data.section === "body" && data.column.index === 3) {
        const v = String((data.row.raw as string[])[3] ?? "");
        if (v === "YES") data.cell.styles.textColor = [32, 133, 73];
        else if (v === "NO") data.cell.styles.textColor = [198, 46, 46];
        else data.cell.styles.textColor = [160, 120, 30];
        data.cell.styles.fontStyle = "bold";
      }
    },
    didDrawPage: () => {
      const pageNum = doc.getNumberOfPages();
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Verifai · Page ${pageNum} / ${pageCount}`,
        doc.internal.pageSize.getWidth() - 40,
        doc.internal.pageSize.getHeight() - 20,
        { align: "right" },
      );
    },
  });

  doc.save(outFilename);
}
