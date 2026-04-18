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
