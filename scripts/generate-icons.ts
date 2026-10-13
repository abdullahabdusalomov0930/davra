/**
 * Writes the app icons from the logo in src/lib/brand.ts. Run after changing the logo or its colours:
 *
 *   pnpm icons
 *
 * Outputs (committed): src/app/icon.svg, src/app/favicon.ico (16/32/48), src/app/apple-icon.png (180),
 * public/icons/icon-192.png, icon-512.png and maskable-512.png for the web manifest.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { ImageResponse } from "next/og";
import { createElement } from "react";

import { logoSvg } from "../src/lib/brand";

const root = join(import.meta.dirname, "..");

async function png(size: number, options: { inset?: number; radius?: number } = {}) {
  const svg = logoSvg({ size, ...options });
  const image = createElement("img", {
    src: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    width: size,
    height: size,
  });
  return Buffer.from(await new ImageResponse(image, { width: size, height: size }).arrayBuffer());
}

/** An .ico holding PNG images (supported by every browser in use). */
function ico(images: { size: number; data: Buffer }[]) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, data }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...images.map(({ data }) => data)]);
}

async function write(path: string, data: Buffer | string) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, data);
  console.log(`wrote ${path}`);
}

async function main() {
  await write("src/app/icon.svg", `${logoSvg({ size: 32 })}\n`);
  await write(
    "src/app/favicon.ico",
    ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(size) })))),
  );
  // iOS rounds the corners itself and shows transparency as black.
  await write("src/app/apple-icon.png", await png(180, { radius: 0 }));
  await write("public/icons/icon-192.png", await png(192));
  await write("public/icons/icon-512.png", await png(512));
  // Maskable: full bleed, the squares well inside the central safe zone (80 %).
  await write("public/icons/maskable-512.png", await png(512, { inset: 0.25, radius: 0 }));
}

void main();
