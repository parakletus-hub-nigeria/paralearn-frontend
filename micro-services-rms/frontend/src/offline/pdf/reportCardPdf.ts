import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import type { ClassResult, StudentResult } from "../engine/types";
import { GRADE_BANDS, bandLabel } from "../engine/grading";
import { cardColours } from "./schoolColour";

/**
 * Draws ParaLearn report cards with pdf-lib: one A4 page per student, one document per
 * batch. Text is drawn in the PDF standard fonts (Helvetica: nothing to download, and fast).
 * Text with letters those fonts can't draw, such as the Yoruba and Igbo ọ, ẹ, ṣ and ń, is drawn
 * in Noto Sans instead, embedded only in documents that need it. Fonts and the logo are
 * embedded once per document and reused for every page.
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
  /** "Next term begins: ..." line; omitted when empty */
  nextTermBegins?: string | null;
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
/** Fail red: dark enough to read as near-black when printed in greyscale */
const FAIL = rgb(0.72, 0.09, 0.09);

function hexToRgb(hex?: string | null): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return rgb(0.39, 0.106, 0.769); // ParaLearn violet
  const n = parseInt(m[1], 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const tint = (c: RGB, amount: number) =>
  rgb(c.red + (1 - c.red) * amount, c.green + (1 - c.green) * amount, c.blue + (1 - c.blue) * amount);

/**
 * Straight quotes and dashes, then the composed form of each letter (é as one character).
 * A tone mark on a dotted letter (ẹ́, Ọ̀) has no single character, and pdf-lib can't position
 * a second mark, so it would print in the wrong place; it is dropped instead (Ẹ̀mí -> Ẹmí).
 */
function tidy(text: string): string {
  return String(text)
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .normalize("NFC")
    .replace(/[̀-ͯ]/g, "");
}

/** Characters the standard fonts draw (Windows-1252: English plus é, á, ò, ü and the like) */
const STANDARD_CHAR = /[\x20-\x7E\xA0-\xFF]/;
/** Letters only the embedded Noto Sans covers: Latin Extended (ọ, ẹ, ṣ, ń, ụ, …) and ₦ */
const UNICODE_ONLY = /[Ā-ɏḀ-ỿ₦]/;

/**
 * Text for the standard fonts. Letters they can't draw lose their marks (Ọlá -> Ola) and anything
 * else becomes "?", so no name can ever crash generation.
 */
export function pdfSafe(text: string | null | undefined): string {
  if (!text) return "";
  return [...tidy(text)]
    .map((ch) => (STANDARD_CHAR.test(ch) ? ch : ch.normalize("NFD").replace(/[̀-ͯ]/g, "")))
    .join("")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");
}

/** Text for the embedded Noto Sans, which covers every Latin letter used in Nigerian names */
function unicodeSafe(text: string | null | undefined): string {
  if (!text) return "";
  return tidy(text).replace(/[^\x20-\x7E\xA0-ɏḀ-ỿ₦]/g, "?");
}

/** True when the text has letters only the embedded Noto Sans can draw */
export function needsUnicodeFont(text: string | null | undefined): boolean {
  return !!text && UNICODE_ONLY.test(tidy(text));
}

// ── Noto Sans, loaded only when a document needs it ─────────────────────────
/** Noto Sans cut down to Latin letters and marks (public/fonts/rms, SIL Open Font License) */
export const UNICODE_FONT_URLS = [
  "/fonts/rms/NotoSans-Regular-latin.ttf",
  "/fonts/rms/NotoSans-Bold-latin.ttf",
  "/fonts/rms/NotoSans-Italic-latin.ttf",
] as const;

type Fontkit = Parameters<PDFDocument["registerFontkit"]>[0];
interface UnicodeFontFiles {
  fontkit: Fontkit;
  regular: Uint8Array;
  bold: Uint8Array;
  italic: Uint8Array;
}

let unicodeFontFiles: Promise<UnicodeFontFiles | null> | null = null;

/**
 * Fetches fontkit and the Noto Sans files once (the service worker keeps them for offline use).
 * Resolves to null when they can't be loaded, e.g. offline before they were ever saved; cards then
 * fall back to the standard fonts, and the next call tries again.
 */
export function loadUnicodeFont(): Promise<UnicodeFontFiles | null> {
  if (!unicodeFontFiles) {
    const origin = (globalThis as { location?: { origin?: string } }).location?.origin ?? "";
    unicodeFontFiles = Promise.all([
      import("@pdf-lib/fontkit"),
      ...UNICODE_FONT_URLS.map(async (url) => {
        const res = await fetch(origin + url);
        if (!res.ok) throw new Error(`${url}: ${res.status}`);
        return new Uint8Array(await res.arrayBuffer());
      }),
    ])
      .then(([fontkitModule, regular, bold, italic]) => {
        const mod = fontkitModule as unknown as { default?: Fontkit };
        return { fontkit: mod.default ?? (fontkitModule as unknown as Fontkit), regular, bold, italic };
      })
      .catch(() => {
        unicodeFontFiles = null;
        return null;
      });
  }
  return unicodeFontFiles;
}

/** Each standard font's Noto Sans counterpart, set when a document embeds Noto Sans */
const unicodeFor = new WeakMap<PDFFont, PDFFont>();
const unicodeFonts = new WeakSet<PDFFont>();

/** The font and text to draw: Noto Sans for text that needs it (when embedded), else the standard font */
function resolve(font: PDFFont, value: string): { font: PDFFont; text: string } {
  if (unicodeFonts.has(font)) return { font, text: unicodeSafe(value) };
  const unicode = unicodeFor.get(font);
  if (unicode && needsUnicodeFont(value)) return { font: unicode, text: unicodeSafe(value) };
  return { font, text: pdfSafe(value) };
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

function fit(font: PDFFont, value: string, size: number, maxWidth: number): string {
  const r = resolve(font, value);
  let t = r.text;
  if (r.font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && r.font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

/** Wraps text into at most maxLines lines of maxWidth; draw every line with the returned font */
function wrap(font: PDFFont, value: string, size: number, maxWidth: number, maxLines: number): { font: PDFFont; lines: string[] } {
  const r = resolve(font, value);
  const words = r.text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (r.font.widthOfTextAtSize(next, size) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = fit(r.font, `${lines[maxLines - 1]} ...`, size, maxWidth);
  }
  return { font: r.font, lines };
}

type Align = "left" | "center" | "right";

function text(page: PDFPage, value: string, x: number, y: number, size: number, baseFont: PDFFont, color: RGB = INK, align: Align = "left", width = 0) {
  const { font, text: t } = resolve(baseFont, value);
  let dx = x;
  if (align !== "left" && width > 0) {
    const w = font.widthOfTextAtSize(t, size);
    dx = align === "center" ? x + (width - w) / 2 : x + width - w;
  }
  page.drawText(t, { x: dx, y, size, font, color });
}

function box(page: PDFPage, x: number, yTop: number, w: number, h: number, opts: { fill?: RGB; border?: RGB; dash?: number[] } = {}) {
  page.drawRectangle({
    x,
    y: yTop - h,
    width: w,
    height: h,
    color: opts.fill,
    borderColor: opts.border,
    borderWidth: opts.border ? 0.6 : 0,
    borderDashArray: opts.dash,
  });
}

/** Section heading: the title in the school's text colour over a hairline the width of the section */
function sectionTitle(page: PDFPage, fonts: Fonts, title: string, x: number, y: number, width: number, accentText: RGB) {
  text(page, title.toUpperCase(), x, y, 8, fonts.bold, accentText);
  // No rule when a filled table header follows straight away (width 0): two rules would stack
  if (width > 0) page.drawLine({ start: { x, y: y - 5 }, end: { x: x + width, y: y - 5 }, thickness: 0.6, color: LINE });
}

/** Small grey label above a value. 7pt is the smallest size the guide allows on paper */
const LABEL = 7;

/**
 * The largest size from `max` down to `min` at which the text fits on one line, or null when it
 * doesn't fit even at `min` (the caller then wraps it)
 */
function fitSize(font: PDFFont, value: string, max: number, min: number, maxWidth: number): number | null {
  const r = resolve(font, value);
  // Width grows in proportion to size, so one measurement gives the answer
  const perPoint = r.font.widthOfTextAtSize(r.text, 1);
  if (perPoint * max <= maxWidth) return max;
  const size = Math.floor((maxWidth / perPoint) * 2) / 2;
  return size >= min ? size : null;
}

function drawCard(page: PDFPage, fonts: Fonts, logo: PDFImage | null, student: StudentResult, cls: ClassResult, ctx: CardContext) {
  // The school colour fills bars and tints; text in or on it uses readable versions (see schoolColour.ts)
  const colours = cardColours(ctx.branding.color);
  const accent = hexToRgb(colours.fill);
  const accentSoft = hexToRgb(colours.soft);
  const accentText = hexToRgb(colours.text);
  const onAccent = hexToRgb(colours.onFill);
  const W = A4.w - 2 * M;
  let y = A4.h - M;

  // ── Header ───────────────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: A4.h - 6, width: A4.w, height: 6, color: accent });
  const logoSize = 56;
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
    text(page, initials || "S", M, y - logoSize / 2 - 7, 20, fonts.bold, onAccent, "center", logoSize);
  }

  const titleW = 142;
  const headX = M + logoSize + 12;
  const headW = W - logoSize - 12 - titleW - 12;
  const name = wrap(fonts.bold, ctx.branding.schoolName.toUpperCase(), 16, headW, 2);
  let hy = y - 15;
  for (const line of name.lines) {
    text(page, line, headX, hy, 16, name.font, accentText);
    hy -= 18;
  }
  if (ctx.branding.motto) {
    text(page, fit(fonts.italic, `"${ctx.branding.motto}"`, 8.5, headW), headX, hy + 1, 8.5, fonts.italic, MUTED);
    hy -= 11;
  }
  const contact = [ctx.branding.address, ctx.branding.phone, ctx.branding.email].filter(Boolean).join("  |  ");
  if (contact) text(page, fit(fonts.regular, contact, 7.5, headW), headX, hy, 7.5, fonts.regular, MUTED);

  const tx = A4.w - M - titleW;
  box(page, tx, y, titleW, logoSize, { fill: accentSoft });
  text(page, "STUDENT REPORT CARD", tx, y - 15, 7.5, fonts.bold, accentText, "center", titleW);
  text(page, fit(fonts.bold, ctx.term, 13, titleW - 12), tx, y - 32, 13, fonts.bold, INK, "center", titleW);
  text(page, fit(fonts.regular, `${ctx.session} Session`, 8.5, titleW - 12), tx, y - 46, 8.5, fonts.regular, INK, "center", titleW);

  y -= logoSize + 12;

  // ── Who the card is for ──────────────────────────────────────────────────
  const idH = 36;
  const idCells: Array<[string, string, number]> = [
    ["STUDENT NAME", student.name, 0.52],
    ["ADMISSION NO.", student.admissionNo || "Not given", 0.26],
    ["CLASS", student.className, 0.22],
  ];
  box(page, M, y, W, idH, { border: LINE });
  let dx = M;
  idCells.forEach(([label, value, frac], i) => {
    const w = W * frac;
    const inner = w - 16;
    if (i > 0) page.drawLine({ start: { x: dx, y }, end: { x: dx, y: y - idH }, thickness: 0.6, color: LINE });
    text(page, label, dx + 8, y - 11, LABEL, fonts.bold, MUTED);
    // Names are never cut short: shrink a little, then use two lines
    const size = fitSize(fonts.bold, value, 11, 8.5, inner);
    if (size) {
      text(page, value, dx + 8, y - 26, size, fonts.bold, INK);
    } else {
      const two = wrap(fonts.bold, value, 8.5, inner, 2);
      two.lines.forEach((line, li) => text(page, line, dx + 8, y - 21 - li * 9.5, 8.5, two.font, INK));
    }
    dx += w;
  });
  y -= idH + 6;

  // ── The result at a glance ───────────────────────────────────────────────
  const band = GRADE_BANDS.find((b) => b.grade === student.grade);
  const facts: Array<[string, string, string | null, boolean]> = [
    ["AVERAGE", `${student.average.toFixed(1)}%`, null, true],
    ["OVERALL GRADE", student.grade, band ? band.remark : null, true],
    ["POSITION IN CLASS", `${ordinal(student.position)} of ${student.classSize}`, null, true],
    ["TOTAL SCORE", `${fmt(student.totalScore)} / ${student.totalObtainable}`, `${student.subjects.length} ${student.subjects.length === 1 ? "subject" : "subjects"}`, false],
    ["CLASS AVERAGE", `${cls.classAverage.toFixed(1)}%`, null, false],
  ];
  const gap = 6;
  const factH = 42;
  const factW = (W - gap * (facts.length - 1)) / facts.length;
  facts.forEach(([label, value, note, key], i) => {
    const x = M + i * (factW + gap);
    box(page, x, y, factW, factH, key ? { fill: accentSoft } : { border: LINE });
    text(page, label, x, y - 11, LABEL, fonts.bold, MUTED, "center", factW);
    const valueY = note ? y - 26 : y - 29;
    text(page, fit(fonts.bold, value, 13, factW - 8), x, valueY, 13, fonts.bold, key ? accentText : INK, "center", factW);
    if (note) text(page, fit(fonts.regular, note, 7.5, factW - 8), x, y - 37, 7.5, fonts.regular, MUTED, "center", factW);
  });
  y -= factH + 16;

  // ── Space the blocks under the table need, so the table can be sized to leave room for them ──
  const nextTerm = (ctx.branding.nextTermBegins || "").trim();
  const nextH = 20;
  const commentH = 80;
  const traits = Object.entries(student.traits).slice(0, 8);
  const lowerRows = Math.max(traits.length ? traits.length + 1 : 1, GRADE_BANDS.length, 4);
  const lowerH = 18 + lowerRows * 11;
  const floor = M + 22 + (nextTerm ? nextH + 12 : 0) + commentH + 16 + lowerH + 18;

  // ── Subjects table, filling the space between the summary and the bottom block ──
  sectionTitle(page, fonts, "Academic performance", M, y, 0, accentText);
  y -= 8;

  const componentKeys: Array<{ key: string; label: string }> = [];
  for (const s of cls.subjects) for (const c of s.components) if (!componentKeys.some((k) => k.key === c.key)) componentKeys.push(c);
  const cols: Array<{ label: string; w: number; align: Align }> = [
    { label: "SUBJECT", w: 0, align: "left" },
    ...componentKeys.map((c) => ({ label: c.key === "EXAM" ? "EXAM" : pdfSafe(c.label).toUpperCase(), w: 36, align: "center" as Align })),
    { label: "TOTAL", w: 38, align: "center" },
    { label: "GRADE", w: 38, align: "center" },
    { label: "POS.", w: 34, align: "center" },
    { label: "CLASS AVG", w: 46, align: "center" },
    { label: "HIGH", w: 30, align: "center" },
    { label: "LOW", w: 30, align: "center" },
    { label: "REMARK", w: 56, align: "left" },
  ];
  cols[0].w = W - cols.slice(1).reduce((a, c) => a + c.w, 0);

  const headH = 18;
  const rowCount = Math.max(1, student.subjects.length);
  // Rows share the space left; long subject lists get shorter rows so the card stays on one page
  // 9.5pt is the comfortable minimum; very long lists (30+ subjects) go down to 7.5pt rather than
  // push the comments and next-term line into the footer
  const fitH = (y - headH - floor) / rowCount;
  const rowH = Math.min(19, Math.max(fitH >= 9.5 ? 9.5 : 7.5, fitH));
  const fontSize = rowH < 11 ? 7 : rowH < 13 ? 7.5 : 8.5;

  box(page, M, y, W, headH, { fill: accent });
  let cx = M;
  for (const col of cols) {
    text(page, fit(fonts.bold, col.label, LABEL, col.w - 6), cx + 4, y - 12, LABEL, fonts.bold, onAccent, col.align, col.w - 8);
    cx += col.w;
  }
  y -= headH;

  if (!student.subjects.length) {
    box(page, M, y, W, 22, { border: LINE });
    text(page, "No scores were entered for this student.", M, y - 14, 8.5, fonts.italic, MUTED, "center", W);
    y -= 22;
  }
  // The grade column is tinted so the eye can run straight down it
  const gradeX = M + cols.slice(0, cols.findIndex((c) => c.label === "GRADE")).reduce((a, c) => a + c.w, 0);
  const gradeW = cols.find((c) => c.label === "GRADE")!.w;
  student.subjects.forEach((s, i) => {
    if (i % 2 === 1) box(page, M, y, W, rowH, { fill: ZEBRA });
    box(page, gradeX, y, gradeW, rowH, { fill: i % 2 === 1 ? tint(accent, 0.84) : accentSoft });
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
      const strong = c === 0 || col.label === "TOTAL" || col.label === "GRADE";
      const font = strong ? fonts.bold : fonts.regular;
      // A fail is red on colour printers and still reads as "F" on black-and-white ones
      const color = s.grade === "F" && (col.label === "GRADE" || col.label === "REMARK") ? FAIL : INK;
      // Subject names shrink a little before they are shortened
      const size = c === 0 ? fitSize(font, value, fontSize, 7, col.w - 8) || 7 : fontSize;
      text(page, fit(font, value, size, col.w - 8), x + 4, baseline, size, font, color, col.align, col.w - 8);
      x += col.w;
    });
    y -= rowH;
  });
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: accent });

  // ── Behaviour, attendance, grading key ───────────────────────────────────
  const colGap = 16;
  const traitW = (W - 2 * colGap) * 0.4;
  const attW = (W - 2 * colGap) * 0.24;
  const keyW = W - 2 * colGap - traitW - attW;
  y -= 18;
  const lowerTop = y;

  sectionTitle(page, fonts, "Behaviour & skills", M, y, traitW, accentText);
  let ty = y - 17;
  if (!traits.length) {
    text(page, "Not recorded", M, ty, 8, fonts.italic, MUTED);
  } else {
    for (const [trait, rating] of traits) {
      text(page, fit(fonts.regular, trait, 7.5, traitW - 72), M, ty, 7.5, fonts.regular, INK);
      for (let d = 0; d < 5; d++) {
        page.drawCircle({ x: M + traitW - 62 + d * 9, y: ty + 2.5, size: 3, color: d < rating ? accentText : undefined, borderColor: accentText, borderWidth: 0.6 });
      }
      text(page, `${rating}/5`, M, ty, 7.5, fonts.bold, INK, "right", traitW);
      ty -= 11;
    }
    text(page, "Rated 1 (poor) to 5 (excellent)", M, ty, LABEL, fonts.italic, MUTED);
  }

  const ax = M + traitW + colGap;
  sectionTitle(page, fonts, "Attendance", ax, y, attW, accentText);
  if (student.daysPresent === null && student.daysOpened === null) {
    text(page, "Not recorded", ax, y - 17, 8, fonts.italic, MUTED);
  } else {
    const opened = student.daysOpened;
    const present = student.daysPresent;
    let ay = y - 17;
    if (opened && present !== null) {
      text(page, `${Math.round((present / opened) * 100)}%`, ax, ay - 8, 16, fonts.bold, accentText);
      ay -= 23;
    }
    const lines = [
      present !== null && opened !== null ? `Present ${present} of ${opened} days` : present !== null ? `Present ${present} days` : `School opened ${opened} days`,
      present !== null && opened !== null ? `Absent ${Math.max(0, opened - present)} days` : null,
    ].filter(Boolean) as string[];
    lines.forEach((line, i) => text(page, fit(fonts.regular, line, 7.5, attW), ax, ay - i * 11, 7.5, fonts.regular, INK));
  }

  const gx = ax + attW + colGap;
  sectionTitle(page, fonts, "Grading key", gx, y, keyW, accentText);
  GRADE_BANDS.forEach((band, i) => {
    const gy = y - 17 - i * 11;
    text(page, band.grade, gx, gy, 7.5, fonts.bold, band.grade === "F" ? FAIL : accentText);
    text(page, bandLabel(band), gx + 14, gy, 7.5, fonts.regular, INK);
    text(page, band.remark, gx, gy, 7.5, fonts.regular, MUTED, "right", keyW);
  });

  // ── Comments, signatures and the school stamp ────────────────────────────
  y = lowerTop - lowerH - 16;
  const commentW = (W - 10) / 2;
  const stampW = 66;
  const comments: Array<[string, string, boolean]> = [
    ["Class teacher's comment", student.teacherComment, false],
    ["Principal's comment", student.principalComment, true],
  ];
  comments.forEach(([label, body, stamp], i) => {
    const x = M + i * (commentW + 10);
    const bodyW = commentW - 16 - (stamp ? stampW + 10 : 0);
    box(page, x, y, commentW, commentH, { border: LINE });
    text(page, label.toUpperCase(), x + 8, y - 13, LABEL, fonts.bold, accentText);
    const comment = wrap(fonts.italic, body, 8.5, bodyW, 3);
    comment.lines.forEach((line, li) => text(page, line, x + 8, y - 27 - li * 11, 8.5, comment.font, INK));
    page.drawLine({ start: { x: x + 8, y: y - 64 }, end: { x: x + 8 + bodyW, y: y - 64 }, thickness: 0.5, color: MUTED });
    text(page, "Signature and date", x + 8, y - 73, LABEL, fonts.regular, MUTED);
    if (stamp) {
      const sx = x + commentW - 8 - stampW;
      box(page, sx, y - 8, stampW, commentH - 16, { border: MUTED, dash: [2, 2] });
      text(page, "School stamp", sx, y - commentH / 2 - 2, LABEL, fonts.regular, MUTED, "center", stampW);
    }
  });

  // ── Next term ────────────────────────────────────────────────────────────
  const nextTop = y - commentH - 12;
  if (nextTerm) {
    box(page, M, nextTop, W, nextH, { fill: accentSoft });
    text(page, "NEXT TERM BEGINS", M + 8, nextTop - 13, LABEL, fonts.bold, accentText);
    text(page, fit(fonts.bold, nextTerm, 9, W - 120), M + 100, nextTop - 13.5, 9, fonts.bold, INK);
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  const on = (ctx.generatedOn || new Date()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  page.drawLine({ start: { x: M, y: M + 12 }, end: { x: A4.w - M, y: M + 12 }, thickness: 0.5, color: LINE });
  text(page, `Generated with ParaLearn Results on ${on}`, M, M, LABEL, fonts.regular, MUTED);
  text(page, `${student.className}  |  Row ${student.row}`, M, M, LABEL, fonts.regular, MUTED, "right", W);
}

/** Whether any text on these cards has letters only Noto Sans can draw */
function documentNeedsUnicode(students: StudentResult[], cls: ClassResult, ctx: CardContext): boolean {
  const b = ctx.branding;
  const shared = [b.schoolName, b.motto, b.address, b.phone, b.email, b.nextTermBegins, ctx.term, ctx.session, cls.name];
  return (
    shared.some(needsUnicodeFont) ||
    students.some(
      (s) =>
        [s.name, s.admissionNo, s.className, s.teacherComment, s.principalComment].some(needsUnicodeFont) ||
        Object.keys(s.traits).some(needsUnicodeFont) ||
        s.subjects.some((sub) => needsUnicodeFont(sub.subject) || needsUnicodeFont(sub.remark))
    )
  );
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
  if (documentNeedsUnicode(students, cls, ctx)) {
    const files = await loadUnicodeFont();
    if (files) {
      doc.registerFontkit(files.fontkit);
      const [regular, bold, italic] = await Promise.all([
        doc.embedFont(files.regular, { subset: true }),
        doc.embedFont(files.bold, { subset: true }),
        doc.embedFont(files.italic, { subset: true }),
      ]);
      unicodeFor.set(fonts.regular, regular);
      unicodeFor.set(fonts.bold, bold);
      unicodeFor.set(fonts.italic, italic);
      [regular, bold, italic].forEach((f) => unicodeFonts.add(f));
    }
  }
  const logo = await embedLogo(doc, ctx.branding.logo);

  students.forEach((student, i) => {
    const page = doc.addPage([A4.w, A4.h]);
    drawCard(page, fonts, logo, student, cls, ctx);
    onPage?.(i + 1, students.length);
  });
  return doc.save({ useObjectStreams: true });
}
