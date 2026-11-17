/**
 * Keeps report cards readable whatever colour a school picks. The colour itself is always used
 * for bars, fills and tints; text drawn in or on it is darkened (or switched to near-black) until
 * it reaches the WCAG AA contrast of 4.5:1. Shared by the PDF and the School profile preview.
 */

export const DEFAULT_SCHOOL_COLOUR = "#641bc4";
const INK = "#0f172a";
const WHITE = "#ffffff";
const MIN_CONTRAST = 4.5;

/** Colours that already pass with white text, offered as one-click choices in the profile */
export const SCHOOL_COLOUR_PRESETS: Array<{ name: string; hex: string }> = [
  { name: "ParaLearn violet", hex: "#641bc4" },
  { name: "Navy", hex: "#1e3a8a" },
  { name: "Royal blue", hex: "#1d4ed8" },
  { name: "Bottle green", hex: "#166534" },
  { name: "Green", hex: "#15803d" },
  { name: "Maroon", hex: "#800000" },
  { name: "Wine", hex: "#7f1d1d" },
  { name: "Red", hex: "#b91c1c" },
  { name: "Brown", hex: "#78350f" },
  { name: "Charcoal", hex: "#1f2937" },
];

type Rgb = [number, number, number];

function parse(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (c: Rgb) => `#${c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

function luminance([r, g, b]: Rgb): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: string, b: string): number {
  const ca = parse(a);
  const cb = parse(b);
  if (!ca || !cb) return 1;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Mixes a colour towards white; amount 0.9 is the light tint used behind card text */
export function tintHex(hex: string, amount: number): string {
  const c = parse(hex) || (parse(DEFAULT_SCHOOL_COLOUR) as Rgb);
  return toHex(c.map((v) => v + (255 - v) * amount) as Rgb);
}

export interface CardColours {
  /** The school's own colour: bars, table header fill, section marks */
  fill: string;
  /** Light tint of it: title box and summary tiles */
  soft: string;
  /** For text on white or on `soft`: the school colour, darkened if it was too light */
  text: string;
  /** For text drawn on `fill`: white, or near-black when white would be unreadable */
  onFill: string;
  /** True when `text` had to be darkened, so the profile can say so */
  adjusted: boolean;
}

export function cardColours(hex: string | null | undefined): CardColours {
  const fill = parse(hex || "") ? toHex(parse(hex as string) as Rgb) : DEFAULT_SCHOOL_COLOUR;
  const soft = tintHex(fill, 0.9);

  // Darken in small steps, keeping the hue, until the text is readable on the tint (and so on white)
  const base = parse(fill) as Rgb;
  let text = fill;
  for (let f = 1; f > 0 && contrast(text, soft) < MIN_CONTRAST; f -= 0.02) {
    text = toHex(base.map((v) => v * f) as Rgb);
  }

  const onFill = contrast(WHITE, fill) >= MIN_CONTRAST || contrast(WHITE, fill) >= contrast(INK, fill) ? WHITE : INK;
  return { fill, soft, text, onFill, adjusted: text !== fill };
}
