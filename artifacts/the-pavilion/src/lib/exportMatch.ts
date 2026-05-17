// Export match scorecard + ball-by-ball log as JSON or PDF
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { MatchEngineState, InningsState } from "./matchEngine";

export interface ExportMeta {
  matchNumber: number;
  stage: string;
  seasonNumber: number;
  teamA: string;
  teamB: string;
  tossWinner?: string;
  tossDecision?: string;
  resultText?: string;
  winner?: string | null;
  potmName?: string;
}

function safeName(meta: ExportMeta) {
  return `IPL-T2_S${meta.seasonNumber}_M${meta.matchNumber}_${meta.teamA}-vs-${meta.teamB}`.replace(/\s+/g, "_");
}

export function downloadJSON(meta: ExportMeta, engine: MatchEngineState, commentary: string[]) {
  const payload = {
    meta,
    settings: {
      oversPerInnings: engine.oversPerInnings,
      allOutWickets: engine.allOutWickets,
      playingXI: engine.playingXI,
    },
    innings1: engine.innings1,
    innings2: engine.innings2,
    target: engine.target,
    commentary,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(meta)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function inningsTitle(inn: InningsState, oversTotal: number) {
  const o = Math.floor(inn.legalBalls / 6);
  const b = inn.legalBalls % 6;
  return `${inn.battingTeam} — ${inn.runs}/${inn.wickets} (${o}.${b}/${oversTotal} ov)`;
}

function addInningsToPDF(doc: jsPDF, inn: InningsState, oversTotal: number, startY: number): number {
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(inningsTitle(inn, oversTotal), 14, startY);
  let y = startY + 4;

  // Batting table
  const batRows = inn.battingOrder.map(id => {
    const b: any = inn.bat[id];
    const sr = b.balls > 0 ? ((b.runs / b.balls) * 100).toFixed(1) : "-";
    return [b.name, b.out ? (b.outDesc ?? "out") : "not out", b.runs, b.balls, b.fours, b.sixes, sr];
  });
  autoTable(doc, {
    startY: y + 2,
    head: [["Batter", "Status", "R", "B", "4s", "6s", "SR"]],
    body: batRows,
    theme: "striped",
    headStyles: { fillColor: [20, 20, 30] },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Extras: ${inn.extras.total} (wd ${inn.extras.wides}, nb ${inn.extras.nb})`, 14, y);
  y += 4;

  // Bowling
  const bowlRows = Object.values(inn.bowl).map((b: any) => {
    const overs = `${Math.floor(b.balls / 6)}.${b.balls % 6}`;
    const econ = b.balls > 0 ? ((b.runs / b.balls) * 6).toFixed(2) : "-";
    return [b.name, overs, b.runs, b.wickets, b.wides, b.noBalls, econ];
  });
  autoTable(doc, {
    startY: y,
    head: [["Bowler", "O", "R", "W", "WD", "NB", "Econ"]],
    body: bowlRows,
    theme: "striped",
    headStyles: { fillColor: [20, 20, 30] },
    styles: { fontSize: 8 },
    margin: { left: 14, right: 14 },
  });
  return (doc as any).lastAutoTable.finalY + 6;
}

export function downloadPDF(meta: ExportMeta, engine: MatchEngineState, commentary: string[]) {
  const doc = new jsPDF();
  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`IPL T20 — Season ${meta.seasonNumber} · Match ${meta.matchNumber}${meta.stage === "final" ? " (Final)" : ""}`, 14, 16);
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.text(`${meta.teamA} vs ${meta.teamB}`, 14, 23);
  if (meta.tossWinner) {
    doc.setFontSize(9);
    doc.text(`Toss: ${meta.tossWinner} — chose to ${meta.tossDecision} first`, 14, 29);
  }
  if (meta.resultText) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Result: ${meta.resultText}`, 14, 35);
  }
  if (meta.potmName) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Player of the Match: ${meta.potmName}`, 14, 41);
  }

  let y = 48;
  y = addInningsToPDF(doc, engine.innings1, engine.oversPerInnings, y);
  if (engine.innings2) {
    if (y > 230) { doc.addPage(); y = 16; }
    y = addInningsToPDF(doc, engine.innings2, engine.oversPerInnings, y);
  }

  // Ball-by-ball
  doc.addPage();
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Ball-by-Ball Log", 14, 16);

  const innings = [engine.innings1, engine.innings2].filter(Boolean) as InningsState[];
  let bbY = 22;
  innings.forEach((inn, idx) => {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(`Innings ${idx + 1} — ${inn.battingTeam}`, 14, bbY);
    const rows = inn.ballEvents.map(e => [`${e.over}.${e.ball}`, e.text, String(e.runs), e.isWicket ? "W" : ""]);
    autoTable(doc, {
      startY: bbY + 2,
      head: [["Over", "Ball", "Runs", "Wkt"]],
      body: rows,
      theme: "grid",
      headStyles: { fillColor: [20, 20, 30] },
      styles: { fontSize: 7 },
      margin: { left: 14, right: 14 },
    });
    bbY = (doc as any).lastAutoTable.finalY + 6;
    if (bbY > 260 && idx < innings.length - 1) { doc.addPage(); bbY = 16; }
  });

  // Commentary
  if (commentary.length > 0) {
    doc.addPage();
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Commentary", 14, 16);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    let cy = 24;
    // chronological (commentary stored newest-first)
    [...commentary].reverse().forEach(line => {
      const wrapped = doc.splitTextToSize(line, 180);
      if (cy + wrapped.length * 4 > 285) { doc.addPage(); cy = 16; }
      doc.text(wrapped, 14, cy);
      cy += wrapped.length * 4 + 1;
    });
  }

  doc.save(`${safeName(meta)}.pdf`);
}
