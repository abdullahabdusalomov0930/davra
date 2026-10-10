import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ImageResponse } from "next/og";

type Font = NonNullable<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]>[number];

// Inter (SIL Open Font License, src/assets/fonts/OFL.txt). Share images are drawn without a browser, so
// they bring their own fonts: Latin with oʻ/gʻ (U+02BB) and the tutuq belgisi (U+02BC) in both weights,
// plus Latin Extended and Cyrillic for titles in other languages (bold only; titles are bold). Each subset
// is its own family, listed in SHARE_IMAGE_FONT_FAMILY: the renderer matches a family by weight, then
// takes the next family for characters the first one lacks.
const FILES = [
  ["Inter", "latin", 400],
  ["Inter", "latin", 700],
  ["Inter Latin Ext", "latin-ext", 700],
  ["Inter Cyrillic", "cyrillic", 700],
  ["Inter Cyrillic Ext", "cyrillic-ext", 700],
] as const;

export const SHARE_IMAGE_FONT_FAMILY = [...new Set(FILES.map(([family]) => `"${family}"`))].join(", ");

let fonts: Promise<Font[]> | undefined;

export function loadShareImageFonts(): Promise<Font[]> {
  fonts ??= Promise.all(
    FILES.map(async ([name, subset, weight]) => ({
      name,
      data: await readFile(join(process.cwd(), "src/assets/fonts", `inter-${subset}-${weight}-normal.woff`)),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}
