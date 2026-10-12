/**
 * Brand colours as hex, for places CSS variables cannot reach: share images, app icons and the web
 * manifest. They match the light theme in globals.css (--primary, --background, …); change both together.
 */
export const brandColors = {
  /** The bright orange of the logo and large shapes (never small text: 2.9:1 on the background). */
  brand: "#ff5a1f",
  primary: "#c9450e",
  primaryForeground: "#ffffff",
  background: "#fbf7ef",
  foreground: "#1c1410",
  muted: "#6b5e55",
  accent: "#fce9de",
  accentForeground: "#8a2e07",
  border: "#e7dfd1",
  night: "#15100c",
} as const;

/**
 * The logo mark on a 24×24 grid: a ring ("davra" is Uzbek for a circle of people) whose opening sits
 * off-centre, filled with the even-odd rule so the opening stays transparent.
 */
export const LOGO_MARK_PATH =
  "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0Z M8.4 10.6a5.2 5.2 0 1 0 10.4 0a5.2 5.2 0 1 0-10.4 0Z";

/**
 * The app icon as standalone SVG: the mark in cream on a bright orange square. `inset` is the mark's
 * margin as a share of the size (maskable icons need a wider one), `radius` the corner rounding.
 */
export function logoSvg({ size, inset = 0.2, radius = 0.24 }: { size: number; inset?: number; radius?: number }) {
  const round = (value: number) => Number(value.toFixed(3));
  const offset = round(size * inset);
  const scale = round((size * (1 - 2 * inset)) / 24);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" rx="${round(size * radius)}" fill="${brandColors.brand}"/>`,
    `<g transform="translate(${offset} ${offset}) scale(${scale})">`,
    `<path d="${LOGO_MARK_PATH}" fill="${brandColors.background}" fill-rule="evenodd"/>`,
    `</g>`,
    `</svg>`,
  ].join("");
}
