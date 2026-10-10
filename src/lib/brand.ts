/**
 * Brand colours as hex, for places CSS variables cannot reach: share images, app icons and the web
 * manifest. They match the light theme in globals.css (--primary, --background, …); change both together.
 */
export const brandColors = {
  primary: "#006b6c",
  primaryForeground: "#ffffff",
  background: "#f8fbfb",
  foreground: "#0f1a20",
  muted: "#536067",
  accent: "#e0f3f3",
  accentForeground: "#00363a",
  border: "#dce3e5",
} as const;

/** The logo glyph: lucide's "book-open" (ISC licence) on a 24×24 grid, drawn as a 2-unit stroke. */
export const LOGO_GLYPH_PATHS = [
  "M12 5v16",
  "M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z",
] as const;

/**
 * The logo as standalone SVG: the glyph in white on a primary-coloured square. `inset` is the glyph's
 * margin as a share of the size (maskable icons need a wider one), `radius` the corner rounding.
 */
export function logoSvg({ size, inset = 0.22, radius = 0.22 }: { size: number; inset?: number; radius?: number }) {
  const round = (value: number) => Number(value.toFixed(3));
  const offset = round(size * inset);
  const scale = round((size * (1 - 2 * inset)) / 24);
  const paths = LOGO_GLYPH_PATHS.map((d) => `<path d="${d}"/>`).join("");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" rx="${round(size * radius)}" fill="${brandColors.primary}"/>`,
    `<g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="${brandColors.primaryForeground}"`,
    ` stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`,
    `</svg>`,
  ].join("");
}
