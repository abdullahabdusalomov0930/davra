/**
 * Brand colours as hex, for places CSS variables cannot reach: share images, app icons and the web
 * manifest. They match the light theme in globals.css (--background, --foreground, …); change both together.
 */
export const brandColors = {
  /** The notebook paper (--background). */
  paper: "#fdfcf7",
  /** Ink (--foreground): text, outlines and hard shadows. */
  ink: "#111111",
  /** The blue ballpoint (--primary): links and handwritten notes. */
  pen: "#1f4fb8",
  /** The highlighter (--marker): the main action. Ink on it is 14.8:1. */
  marker: "#ffe45c",
  muted: "#4f4f4f",
  /** The light blue rules of the squared paper (--grid). */
  grid: "#dce6f2",
  /** A yellow post-it note (--accent). */
  postit: "#fff3a0",
} as const;

/**
 * The logo: four rounded squares on a white sticker ("davracha" is a small circle of people; here, four
 * of them side by side). Colours go clockwise from the top left — mustard, orange, purple, green — and are the
 * same tones the magnet dots in the background take around the cursor.
 */
export const LOGO_COLORS = {
  topLeft: "#d9a400",
  topRight: "#f07a3a",
  bottomRight: "#7b5cf0",
  bottomLeft: "#2e9e6b",
} as const;

/** The sticker on a 42×42 grid: 5 units of white around two rows of 14.5-unit squares, 3 apart. */
export const LOGO_GRID = 42;
export const LOGO_STICKER_RADIUS = 14;
export const LOGO_SQUARE_RADIUS = 7;
export const LOGO_SQUARES = [
  { x: 5, y: 5, size: 14.5, fill: LOGO_COLORS.topLeft },
  { x: 22.5, y: 5, size: 14.5, fill: LOGO_COLORS.topRight },
  { x: 5, y: 22.5, size: 14.5, fill: LOGO_COLORS.bottomLeft },
  { x: 22.5, y: 22.5, size: 14.5, fill: LOGO_COLORS.bottomRight },
] as const;

/**
 * The app icon as standalone SVG: the four squares on a white tile. `inset` is the empty margin around the
 * squares as a share of the size (maskable icons need a wider one), `radius` the tile's corner rounding.
 */
export function logoSvg({ size, inset = 5 / 42, radius = 1 / 3 }: { size: number; inset?: number; radius?: number }) {
  const round = (value: number) => Number(value.toFixed(3));
  // The squares keep their proportions from the 42-unit grid, scaled into the space the inset leaves.
  const scale = (size * (1 - 2 * inset)) / (LOGO_GRID - 10);
  const offset = size * inset - 5 * scale;
  const squares = LOGO_SQUARES.map(
    ({ x, y, size: side, fill }) =>
      `<rect x="${round(offset + x * scale)}" y="${round(offset + y * scale)}" width="${round(side * scale)}" height="${round(side * scale)}" rx="${round(LOGO_SQUARE_RADIUS * scale)}" fill="${fill}"/>`,
  );
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" rx="${round(size * radius)}" fill="#ffffff"/>`,
    ...squares,
    `</svg>`,
  ].join("");
}
