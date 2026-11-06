import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { ClassResult, StudentResult } from "../engine/types";
import { GRADE_BANDS, bandLabel } from "../engine/grading";

/**
 * Draws ParaLearn report cards with pdf-lib: one A4 page per student, one document per
 * batch. Uses the PDF standard fonts (no font files to download, so it works offline);
 * fonts and the logo are embedded once per document and reused for every page.
 */

export interface CardBranding {
  schoolName: string;
  motto?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  /** #rrggbb */
  color?: string | null;
  logo?: { bytes: Uint8Array; type: "png" | "jpg" } | null;
}

export interface CardContext {
  term: string;
  session: string;
  branding: CardBranding;
  generatedOn?: Date;
}

const A4 = { w: 595.28, h: 841.89 };
const M = 32; // page margin
const INK = rgb(0.09, 0.11, 0.16);
const MUTED = rgb(0.39, 0.45, 0.55);
const LINE = rgb(0.82, 0.85, 0.89);
const ZEBRA = rgb(0.965, 0.973, 0.98);
const WHITE = rgb(1, 1, 1);

function hexToRgb(hex?: string | null): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return rgb(0.39, 0.106, 0.769); // ParaLearn violet
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const tint = (c: RGB, amount: number) =>
  rgb(c.red + (1 - c.red) * amount, c.green + (1 - c.green) * amount, c.blue + (1 - c.blue) * amount);

/**
 * Standard PDF fonts only cover Windows-1252. Fold accents (Ọlá -> Ola) and replace anything
 * else unprintable, so a Yoruba or Igbo name can never crash generation.
 */
export function pdfSafe(text: string | null | undefined): string {
  if (!text) return "";
  return String(text)
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

const ordinal = (n: number) => {
  const r = n % 100;
  const s = r >= 11 && r <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] || "th";
  return `${n}${s}`;
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
}

function fit(font: PDFFont, text: string, size: number, maxWidth: number): string {
  let t = pdfSafe(text);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

/** Wraps text into at most maxLines lines of maxWidth */
function wrap(font: PDFFont, text: string, size: number, maxWidth: number, maxLines: number): string[] {
  const words = pdfSafe(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = fit(font, `${lines[maxLines - 1]} ...`, size, maxWidth);
  }
  return lines;
}

type Align = "left" | "center" | "right";

function text(page: PDFPage, value: string, x: number, y: number, size: number, font: PDFFont, color: RGB = INK, align: Align = "left", width = 0) {
  const t = pdfSafe(value);
  let dx = x;
  if (align !== "left" && width > 0) {
    const w = font.widthOfTextAtSize(t, size);
    dx = align === "center" ? x + (width - w) / 2 : x + width - w;
  }
  page.drawText(t, { x: dx, y, size, font, color });
}

function box(page: PDFPage, x: number, yTop: number, w: number, h: number, opts: { fill?: RGB; border?: RGB } = {}) {
  page.drawRectangle({
    x,
    y: yTop - h,
    width: w,
    height: h,
    color: opts.fill,
    borderColor: opts.border,
    borderWidth: opts.border ? 0.6 : 0,
  });
}

function sectionTitle(page: PDFPage, fonts: Fonts, title: string, x: number, y: number, accent: RGB) {
  page.drawRectangle({ x, y: y - 2, width: 3, height: 10, color: accent });
  text(page, title.toUpperCase(), x + 7, y, 8.5, fonts.bold, INK);
}

function drawCard(page: PDFPage, fonts: Fonts, logo: PDFImage | null, student: StudentResult, cls: ClassResult, ctx: CardContext) {
  const accent = hexToRgb(ctx.branding.color);
  const accentSoft = tint(accent, 0.9);
  const W = A4.w - 2 * M;
  let y = A4.h - M;

  // ── Header ───────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: A4.h - 7, width: A4.w, height: 7, color: accent });
  const logoSize = 58;
  if (logo) {
    const scale = Math.min(logoSize / logo.width, logoSize / logo.height);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, { x: M + (logoSize - w) / 2, y: y - logoSize + (logoSize - h) / 2, width: w, height: h });
  } else {
    page.drawCircle({ x: M + logoSize / 2, y: y - logoSize / 2, size: logoSize / 2, color: accent });
    const initials = pdfSafe(ctx.branding.schoolName)
      .split(/\s+/)
      .filter((w) => /^[A-Za-z]/.test(w))
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
    text(page, initials || "S", M, y - logoSize / 2 - 7, 20, fonts.bold, WHITE, "center", logoSize);
  }

  const titleW = 150;
  const headX = M + logoSize + 12;
  const headW = W - logoSize - 12 - titleW - 10;
  const nameLines = wrap(fonts.bold, ctx.branding.schoolName.toUpperCase(), 15, headW, 2);
  let hy = y - 14;
  for (const line of nameLines) {
    text(page, line, headX, hy, 15, fonts.bold, accent);
    hy -= 17;
  }
  if (ctx.branding.motto) {
    text(page, fit(fonts.italic, `"${ctx.branding.motto}"`, 8.5, headW), headX, hy, 8.5, fonts.italic, MUTED);
    hy -= 11;
  }
  const contact = [ctx.branding.address, ctx.branding.phone, ctx.branding.email].filter(Boolean).join("  |  ");
  if (contact) text(page, fit(fonts.regular, contact, 7.5, headW), headX, hy, 7.5, fonts.regular, MUTED);

  const tx = A4.w - M - titleW;
  box(page, tx, y, titleW, 58, { fill: accentSoft, border: tint(accent, 0.6) });
  text(page, "STUDENT REPORT CARD", tx, y - 15, 8, fonts.bold, accent, "center", titleW);
  text(page, ctx.term, tx, y - 32, 13, fonts.bold, INK, "center", titleW);
  text(page, `${ctx.session} Session`, tx, y - 47, 8.5, fonts.regular, MUTED, "center", titleW);

  y -= logoSize + 14;

  // ── Student details ──────────────────────────────────────────────────────
  const details: Array<[string, string, number]> = [
    ["STUDENT NAME", student.name, 0.34],
    ["ADMISSION NO.", student.admissionNo || "-", 0.18],
    ["CLASS", student.className, 0.16],
    ["POSITION", `${ordinal(student.position)} of ${student.classSize}`, 0.16],
    ["AVERAGE", `${student.average.toFixed(1)}%`, 0.16],
  ];
  let dx = M;
  const detailH = 32;
  box(page, M, y, W, detailH, { border: LINE });
  details.forEach(([label, value, frac], i) => {
    const w = W * frac;
    if (i > 0) page.drawLine({ start: { x: dx, y }, end: { x: dx, y: y - detailH }, thickness: 0.6, color: LINE });
    text(page, label, dx + 7, y - 11, 6.5, fonts.bold, MUTED);
    text(page, fit(fonts.bold, value, 10, w - 14), dx + 7, y - 25, 10, fonts.bold, INK);
    dx += w;
  });
  y -= detailH + 16;

  // ── Subjects table ───────────────────────────────────────────────────────
  sectionTitle(page, fonts, "Academic performance", M, y, accent);
  y -= 8;

  const componentKeys: Array<{ key: string; label: string }> = [];
  for (const s of cls.subjects) for (const c of s.components) if (!componentKeys.some((k) => k.key === c.key)) componentKeys.push(c);
  const cols: Array<{ label: string; w: number; align: Align }> = [
    { label: "SUBJECT", w: 0, align: "left" },
    ...componentKeys.map((c) => ({ label: c.key === "EXAM" ? "EXAM" : pdfSafe(c.label).toUpperCase(), w: 38, align: "center" as Align })),
    { label: "TOTAL", w: 38, align: "center" },
    { label: "GRADE", w: 34, align: "center" },
    { label: "POS.", w: 32, align: "center" },
    { label: "CLASS AVG", w: 44, align: "center" },
    { label: "HIGH", w: 30, align: "center" },
    { label: "LOW", w: 30, align: "center" },
    { label: "REMARK", w: 56, align: "left" },
  ];
  cols[0].w = W - cols.slice(1).reduce((a, c) => a + c.w, 0);

  // Shrink rows when a class takes many subjects so the card stays on one page
  const rowCount = Math.max(1, student.subjects.length);
  const rowH = Math.max(11, Math.min(16, 300 / rowCount));
  const fontSize = rowH < 13 ? 7.5 : 8.5;

  const headH = 18;
  box(page, M, y, W, headH, { fill: accent });
  let cx = M;
  for (const col of cols) {
    text(page, fit(fonts.bold, col.label, 6.5, col.w - 6), cx + 4, y - 12, 6.5, fonts.bold, WHITE, col.align, col.w - 8);
    cx += col.w;
  }
  y -= headH;

  if (!student.subjects.length) {
    box(page, M, y, W, 22, { border: LINE });
    text(page, "No scores were entered for this student.", M, y - 14, 8.5, fonts.italic, MUTED, "center", W);
    y -= 22;
  }
  student.subjects.forEach((s, i) => {
    if (i % 2 === 1) box(page, M, y, W, rowH, { fill: ZEBRA });
    const cells: string[] = [
      s.subject,
      ...componentKeys.map((k) => (typeof s.scores[k.key] === "number" ? fmt(s.scores[k.key]) : "-")),
      fmt(s.total),
      s.grade,
      ordinal(s.position),
      s.classAverage.toFixed(1),
      fmt(s.highest),
      fmt(s.lowest),
      s.remark,
    ];
    let x = M;
    const baseline = y - rowH / 2 - fontSize / 2 + 2;
    cells.forEach((value, c) => {
      const col = cols[c];
      const isTotal = col.label === "TOTAL" || col.label === "GRADE";
      const font = c === 0 || isTotal ? fonts.bold : fonts.regular;
      text(page, fit(font, value, fontSize, col.w - 8), x + 4, baseline, fontSize, font, s.grade === "F" && col.label === "GRADE" ? rgb(0.8, 0.1, 0.1) : INK, col.align, col.w - 8);
      x += col.w;
    });
    y -= rowH;
  });
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: accent });
  y -= 14;

  // ── Summary tiles ────────────────────────────────────────────────────────
  const tiles: Array<[string, string]> = [
    ["TOTAL SCORE", `${fmt(student.totalScore)} / ${student.totalObtainable}`],
    ["AVERAGE", `${student.average.toFixed(1)}%`],
    ["OVERALL GRADE", student.grade],
    ["CLASS POSITION", `${ordinal(student.position)} of ${student.classSize}`],
    ["CLASS AVERAGE", `${cls.classAverage.toFixed(1)}%`],
    ["SUBJECTS TAKEN", String(student.subjects.length)],
  ];
  const gap = 6;
  const tileW = (W - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tileW + gap);
    box(page, x, y, tileW, 36, { fill: i < 4 ? accentSoft : ZEBRA });
    text(page, label, x, y - 12, 6.3, fonts.bold, MUTED, "center", tileW);
    text(page, fit(fonts.bold, value, 11.5, tileW - 6), x, y - 28, 11.5, fonts.bold, i < 4 ? accent : INK, "center", tileW);
  });
  y -= 36 + 16;

  // ── Behaviour, attendance, grade key ─────────────────────────────────────
  const colW = (W - 2 * 10) / 3;
  const blockTop = y;
  sectionTitle(page, fonts, "Behaviour & skills", M, y, accent);
  const traits = Object.entries(student.traits);
  let ty = y - 14;
  if (!traits.length) {
    text(page, "Not recorded", M + 7, ty, 8, fonts.italic, MUTED);
  } else {
    for (const [trait, rating] of traits.slice(0, 8)) {
      text(page, fit(fonts.regular, trait, 7.5, colW - 60), M + 7, ty, 7.5, fonts.regular, INK);
      for (let d = 0; d < 5; d++) {
        page.drawCircle({ x: M + colW - 46 + d * 9, y: ty + 2.5, size: 3, color: d < rating ? accent : undefined, borderColor: accent, borderWidth: 0.6 });
      }
      ty -= 11;
    }
    text(page, "Rated 1 (poor) to 5 (excellent)", M + 7, ty - 2, 6.5, fonts.italic, MUTED);
  }

  const ax = M + colW + 10;
  sectionTitle(page, fonts, "Attendance", ax, y, accent);
  if (student.daysPresent === null && student.daysOpened === null) {
    text(page, "Not recorded", ax + 7, y - 14, 8, fonts.italic, MUTED);
  } else {
    const rows: Array<[string, string]> = [
      ["Days school opened", student.daysOpened !== null ? String(student.daysOpened) : "-"],
      ["Days present", student.daysPresent !== null ? String(student.daysPresent) : "-"],
      [
        "Days absent",
        student.daysOpened !== null && student.daysPresent !== null ? String(Math.max(0, student.daysOpened - student.daysPresent)) : "-",
      ],
    ];
    if (student.daysOpened && student.daysPresent !== null) {
      rows.push(["Attendance", `${Math.round((student.daysPresent / student.daysOpened) * 100)}%`]);
    }
    rows.forEach(([label, value], i) => {
      text(page, label, ax + 7, y - 14 - i * 11, 7.5, fonts.regular, INK);
      text(page, value, ax, y - 14 - i * 11, 7.5, fonts.bold, INK, "right", colW - 4);
    });
  }

  const gx = M + 2 * (colW + 10);
  sectionTitle(page, fonts, "Grading key", gx, y, accent);
  GRADE_BANDS.forEach((band, i) => {
    const gy = y - 14 - i * 11;
    text(page, band.grade, gx + 7, gy, 7.5, fonts.bold, accent);
    text(page, bandLabel(band), gx + 20, gy, 7.5, fonts.regular, INK);
    text(page, band.remark, gx, gy, 7.5, fonts.regular, MUTED, "right", colW - 4);
  });

  y = Math.min(ty - 10, blockTop - 14 - GRADE_BANDS.length * 11 - 6);

  // ── Comments ─────────────────────────────────────────────────────────────
  const commentW = (W - 10) / 2;
  const comments: Array<[string, string]> = [
    ["Class teacher's comment", student.teacherComment],
    ["Principal's comment", student.principalComment],
  ];
  comments.forEach(([label, body], i) => {
    const x = M + i * (commentW + 10);
    box(page, x, y, commentW, 64, { border: LINE });
    text(page, label.toUpperCase(), x + 8, y - 12, 7, fonts.bold, accent);
    wrap(fonts.italic, body, 8.5, commentW - 16, 2).forEach((line, li) => text(page, line, x + 8, y - 26 - li * 11, 8.5, fonts.italic, INK));
    page.drawLine({ start: { x: x + 8, y: y - 54 }, end: { x: x + commentW * 0.55, y: y - 54 }, thickness: 0.5, color: MUTED });
    text(page, "Signature & date", x + 8, y - 61, 6, fonts.regular, MUTED);
  });

  // ── Footer ───────────────────────────────────────────────────────────────
  const on = (ctx.generatedOn || new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  page.drawLine({ start: { x: M, y: M + 12 }, end: { x: A4.w - M, y: M + 12 }, thickness: 0.5, color: LINE });
  text(page, `Generated with ParaLearn Results on ${on}`, M, M, 6.5, fonts.regular, MUTED);
  text(page, `${pdfSafe(student.className)}  |  Row ${student.row}`, M, M, 6.5, fonts.regular, MUTED, "right", W);
}

async function embedLogo(doc: PDFDocument, logo: CardBranding["logo"]): Promise<PDFImage | null> {
  if (!logo?.bytes?.length) return null;
  try {
    return logo.type === "png" ? await doc.embedPng(logo.bytes) : await doc.embedJpg(logo.bytes);
  } catch {
    // A damaged or unsupported logo shouldn't block the cards; initials are drawn instead
    return null;
  }
}

/**
 * One PDF with a page per student. Pass every student of a class for a class booklet, or a
 * single student for a preview or individual download. `onPage` reports progress.
 */
export async function buildReportCardsPdf(
  students: StudentResult[],
  cls: ClassResult,
  ctx: CardContext,
  onPage?: (done: number, total: number) => void
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(pdfSafe(`${ctx.branding.schoolName} - ${cls.name} report cards - ${ctx.term} ${ctx.session}`));
  doc.setProducer("ParaLearn Results (offline)");
  doc.setCreator("ParaLearn Results");
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const logo = await embedLogo(doc, ctx.branding.logo);

  students.forEach((student, i) => {
    const page = doc.addPage([A4.w, A4.h]);
    drawCard(page, fonts, logo, student, cls, ctx);
    onPage?.(i + 1, students.length);
  });
  return doc.save({ useObjectStreams: true });
}
