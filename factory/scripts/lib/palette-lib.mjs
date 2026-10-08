// Shared palette measurement: hex -> OKLCH, harmony, bans, frequency buckets, structural pattern tags.
// Used by measure.mjs (SNS posts) and measure-dataset.mjs (ui-ux-pro-max colors.csv) so both are measured identically.
// Contrast math reuses web-factory's contrast-lib (oklchToLinearSrgb / ratio); hex -> OKLCH is local.
import * as lib from "./contrast-lib.mjs";
export const { ratio, oklchToLinearSrgb } = lib;

export const ACCENT_C = 0.05; // a color with C >= 0.05 counts as an accent

// sRGB hex (no '#') -> OKLCH (Ottosson OKLab)
export function hexToOklch(hex) {
  const lin = [0, 2, 4].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const [r, g, b] = lin;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const C = Math.hypot(A, B);
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return [L, C, C < 1e-4 ? 0 : H];
}
export const css = ([L, C, H]) => `oklch(${L.toFixed(6)} ${C.toFixed(6)} ${H.toFixed(4)})`;

// round-trip self-check: hex -> oklch -> lib linear sRGB -> hex must be within 1/255
export function selfCheck(hex, lch) {
  const back = oklchToLinearSrgb(css(lch)).map((c) => Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)));
  const orig = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return Math.max(...back.map((v, i) => Math.abs(v - orig[i])));
}

// hex (with or without '#') -> { hex:'#RRGGBB', oklch:[L,C,H] rounded, _css, _rt (round-trip error /255) }
export function makeColor(hex) {
  const h = hex.replace(/^#/, "");
  const lch = hexToOklch(h);
  return { hex: "#" + h.toUpperCase(), oklch: [+lch[0].toFixed(4), +lch[1].toFixed(4), +lch[2].toFixed(1)], _css: css(lch), _rt: selfCheck(h, lch) };
}
export const contrast = (a, b) => +ratio(a._css, b._css).toFixed(2);
export function pairsOf(colors) {
  const pairs = [];
  for (let i = 0; i < colors.length; i++) for (let j = i + 1; j < colors.length; j++) pairs.push([colors[i].hex, colors[j].hex, contrast(colors[i], colors[j])]);
  return pairs;
}

export const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
export function hueSpread(hs) { // smallest arc containing all hues
  if (hs.length < 2) return 0;
  const s = [...hs].sort((a, b) => a - b);
  let maxGap = 0;
  for (let i = 0; i < s.length; i++) maxGap = Math.max(maxGap, (s[(i + 1) % s.length] - s[i] + 360) % 360 || (s.length === 1 ? 360 : 0));
  return 360 - maxGap;
}
export function clusters(hs, tol = 45) { // single-link clustering on the circle
  const s = [...hs].sort((a, b) => a - b);
  const groups = [];
  for (const h of s) {
    const g = groups.find((g) => g.some((x) => hueDist(x, h) <= tol));
    g ? g.push(h) : groups.push([h]);
  }
  // merge wrap-around
  for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++)
    if (groups[i].some((a) => groups[j].some((b) => hueDist(a, b) <= tol))) { groups[i].push(...groups[j]); groups.splice(j, 1); j = i; }
  return groups.map((g) => { // circular mean
    const x = g.reduce((t, h) => t + Math.cos((h * Math.PI) / 180), 0), y = g.reduce((t, h) => t + Math.sin((h * Math.PI) / 180), 0);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  });
}
export function harmony(cols) {
  const acc = cols.filter((c) => c.oklch[1] >= ACCENT_C);
  if (acc.length === 0) return ["monochrome", "achromatic (no color with C>=0.05)"];
  if (acc.length === 1) return ["neutral+accent", "one chromatic color"];
  const hs = acc.map((c) => c.oklch[2]);
  const spread = hueSpread(hs);
  if (spread <= 30) return ["monochrome", `accent hues within ${spread.toFixed(0)}deg`];
  if (spread <= 90) return ["analogous", `accent hues within ${spread.toFixed(0)}deg`];
  const cs = clusters(hs);
  if (cs.length === 2) {
    const d = hueDist(cs[0], cs[1]);
    return d >= 120 ? ["complementary", `2 hue groups ${d.toFixed(0)}deg apart`] : ["analogous", `2 hue groups ${d.toFixed(0)}deg apart (wide)`];
  }
  if (cs.length === 3) {
    const s = [...cs].sort((a, b) => a - b), gaps = [s[1] - s[0], s[2] - s[1], 360 - s[2] + s[0]];
    return Math.min(...gaps) >= 80 ? ["triad", `3 hue groups, gaps ${gaps.map((g) => g.toFixed(0)).join("/")}`] : ["split", `3 hue groups, gaps ${gaps.map((g) => g.toFixed(0)).join("/")}`];
  }
  return ["polychrome", `${cs.length} hue groups (4+; outside the 6 named types)`];
}
export const accentCountOf = (cols) => cols.filter((c) => c.oklch[1] >= ACCENT_C).length;

// ---- bans (thresholds on rounded oklch)
export const isCream = (c) => c.oklch[0] >= 0.9 && c.oklch[1] >= 0.01 && c.oklch[1] <= 0.05 && c.oklch[2] >= 60 && c.oklch[2] <= 95;
export const isPurpleDominant = (c) => c.oklch[2] >= 270 && c.oklch[2] <= 310 && c.oklch[1] >= 0.1;
export const tooManyAccents = (accentCount) => accentCount >= 3;

// ---- frequency buckets (as in collect-report.md appendix)
export const spanBucket = (r) => (r.lightnessSpan < 0.3 ? "a) < 0.30" : r.lightnessSpan < 0.5 ? "b) 0.30-0.49" : r.lightnessSpan < 0.7 ? "c) 0.50-0.69" : r.lightnessSpan < 0.85 ? "d) 0.70-0.84" : "e) >= 0.85");
export const SPAN_KEYS = ["a) < 0.30", "b) 0.30-0.49", "c) 0.50-0.69", "d) 0.70-0.84", "e) >= 0.85"];
export const minLBucket = (r) => (r.lightnessRange[0] <= 0.25 ? "min L <= 0.25 (near-black present)" : r.lightnessRange[0] <= 0.4 ? "min L 0.26-0.40" : "min L > 0.40 (no dark)");
export const MINL_KEYS = ["min L <= 0.25 (near-black present)", "min L 0.26-0.40", "min L > 0.40 (no dark)"];
export const maxLBucket = (r) => (r.lightnessRange[1] >= 0.95 ? "max L >= 0.95 (near-white present)" : r.lightnessRange[1] >= 0.85 ? "max L 0.85-0.94" : "max L < 0.85 (no light)");
export const MAXL_KEYS = ["max L >= 0.95 (near-white present)", "max L 0.85-0.94", "max L < 0.85 (no light)"];
export const HUE_BINS = [["red/pink 340-30", (h) => h >= 340 || h < 30], ["orange/brown 30-75", (h) => h >= 30 && h < 75], ["yellow/olive 75-115", (h) => h >= 75 && h < 115], ["green 115-165", (h) => h >= 115 && h < 165], ["teal/cyan 165-220", (h) => h >= 165 && h < 220], ["blue 220-265", (h) => h >= 220 && h < 265], ["indigo/violet 265-310", (h) => h >= 265 && h < 310], ["magenta/plum 310-340", (h) => h >= 310 && h < 340]];

// ---- structural pattern tags; each takes a row with { colors, accentCount, harmony, lightnessRange, lightnessSpan }
const L = (c) => c.oklch[0], C = (c) => c.oklch[1], H = (c) => c.oklch[2];
const warmHue = (h) => h <= 75 || h >= 340;
const darkest = (r) => r.colors.reduce((a, b) => (L(b) < L(a) ? b : a));
const lightest = (r) => r.colors.reduce((a, b) => (L(b) > L(a) ? b : a));
export const PATTERNS = [
  ["offwhite", "Tinted off-white instead of pure white: lightest color L>=0.93, C 0.005-0.04, not #FFFFFF", (r) => { const w = lightest(r); return L(w) >= 0.93 && w.hex !== "#FFFFFF" && C(w) >= 0.005 && C(w) <= 0.04; }],
  ["muted", "No high-chroma color: every color C < 0.10 (muted/dusty)", (r) => r.colors.every((c) => C(c) < 0.1)],
  ["no_extremes", "No near-black and no near-white (min L > 0.30 and max L < 0.93)", (r) => r.lightnessRange[0] > 0.3 && r.lightnessRange[1] < 0.93],
  ["warm_dark_anchor", "Warm dark anchor: darkest color is brown/burgundy/plum-red (L<=0.35, C>=0.02, hue <=75 or >=340), not neutral black", (r) => { const d = darkest(r); return L(d) <= 0.35 && C(d) >= 0.02 && warmHue(H(d)); }],
  ["navy_anchor", "Blue-family dark anchor: darkest color is navy/ink (L<=0.35, C>=0.03, hue 220-275)", (r) => { const d = darkest(r); return L(d) <= 0.35 && C(d) >= 0.03 && H(d) >= 220 && H(d) <= 275; }],
  ["dark_light_mid", "Dark anchor (L<=0.30) + light surface (L>=0.90) + at least one mid-lightness color (0.40-0.85) in 4+ colors", (r) => r.colors.length >= 4 && r.colors.some((c) => L(c) <= 0.3) && r.colors.some((c) => L(c) >= 0.9) && r.colors.some((c) => L(c) >= 0.4 && L(c) <= 0.85)],
  ["neutral_black_anchor", "Neutral near-black anchor (L<=0.25, C<0.02)", (r) => r.colors.some((c) => L(c) <= 0.25 && C(c) < 0.02)],
  ["cool_plus_warm_accent", "Warm accent (hue <=75 or >=340, C>=0.10) + cool color (hue 180-275, C>=0.05) together", (r) => r.colors.some((c) => C(c) >= 0.1 && warmHue(H(c))) && r.colors.some((c) => C(c) >= 0.05 && H(c) >= 180 && H(c) <= 275)],
  ["two_color", "2-color pair format (the whole palette is two colors)", (r) => r.colors.length === 2],
  ["deep_pale_pair", "Deep tone (L<=0.35) + pale tint (L>=0.80) as a 2-color pair", (r) => r.colors.length === 2 && r.colors.some((c) => L(c) <= 0.35) && r.colors.some((c) => L(c) >= 0.8)],
  ["single_hue_ramp", "Single-hue lightness ramp (4+ colors, accent hues within 30deg, L span >= 0.5)", (r) => r.colors.length >= 4 && r.harmony === "monochrome" && r.accentCount >= 2 && r.lightnessSpan >= 0.5],
  ["neon_on_black", "Neon/high-L vivid (L>=0.85, C>=0.15) set against a near-black (L<=0.25)", (r) => r.colors.some((c) => L(c) >= 0.85 && C(c) >= 0.15) && r.colors.some((c) => L(c) <= 0.25)],
  ["pastels_dark_anchor", "Two or more pastels (L>=0.80, C 0.03-0.12) plus one dark anchor (L<=0.35)", (r) => r.colors.filter((c) => L(c) >= 0.8 && C(c) >= 0.03 && C(c) <= 0.12).length >= 2 && r.colors.some((c) => L(c) <= 0.35)],
  ["pure_white", "Contains pure #FFFFFF", (r) => r.colors.some((c) => c.hex === "#FFFFFF")],
  ["black_white_2vivid", "Near-black + low-chroma near-white + 2 or more vivid accents (C>=0.12)", (r) => r.colors.some((c) => L(c) <= 0.25) && r.colors.some((c) => L(c) >= 0.93 && C(c) <= 0.04) && r.colors.filter((c) => C(c) >= 0.12).length >= 2],
  ["black_white_1accent", "Near-black (L<=0.25) + low-chroma near-white (L>=0.93, C<=0.04) + exactly one saturated accent (C>=0.05)", (r) => r.accentCount === 1 && r.colors.some((c) => L(c) <= 0.25) && r.colors.some((c) => L(c) >= 0.93 && C(c) <= 0.04)],
];
// the SNS top 10 (collect-report.md section 7), in report order
export const SNS_TOP10 = ["offwhite", "muted", "no_extremes", "warm_dark_anchor", "navy_anchor", "dark_light_mid", "neutral_black_anchor", "cool_plus_warm_accent", "two_color", "deep_pale_pair"];
export const patternTags = (r) => PATTERNS.filter(([, , f]) => f(r)).map(([k]) => k);
