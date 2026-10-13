import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ImageResponse } from "next/og";

type Font = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>[number];

// Share images are drawn without a browser, so they bring their own fonts (all SIL Open Font License:
// Inter in src/assets/fonts/OFL.txt, Unbounded in OFL-Unbounded.txt). Inter for the text: Latin with oʻ/gʻ
// (U+02BB) and the tutuq belgisi (U+02BC) in both weights, plus Latin Extended and Cyrillic for titles in
// other languages (bold only; titles are bold). Unbounded, the site's heading face, for the wordmark and
// titles (Latin, which has U+02BB/U+02BC, and Cyrillic). Each subset is its own family: the renderer
// matches a family by weight, then takes the next family in the list for characters the first one lacks.
const FILES = [
  ["Inter", "inter", "latin", 400],
  ["Inter", "inter", "latin", 700],
  ["Inter Latin Ext", "inter", "latin-ext", 700],
  ["Inter Cyrillic", "inter", "cyrillic", 700],
  ["Inter Cyrillic Ext", "inter", "cyrillic-ext", 700],
  ["Unbounded", "unbounded", "latin", 800],
  ["Unbounded Cyrillic", "unbounded", "cyrillic", 800],
] as const;

const family = (name: string) => `"${name}"`;
const interFamilies = [...new Set(FILES.filter(([, file]) => file === "inter").map(([name]) => family(name)))];

export const SHARE_IMAGE_FONT_FAMILY = interFamilies.join(", ");
/** Headings: Unbounded first, then Inter for the characters it lacks. */
export const SHARE_IMAGE_HEADING_FAMILY = [family("Unbounded"), family("Unbounded Cyrillic"), ...interFamilies].join(
  ", ",
);

let fonts: Promise<Font[]> | undefined;

export function loadShareImageFonts(): Promise<Font[]> {
  fonts ??= Promise.all(
    FILES.map(async ([name, file, subset, weight]) => ({
      name,
      data: await readFile(join(process.cwd(), "src/assets/fonts", `${file}-${subset}-${weight}-normal.woff`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}
