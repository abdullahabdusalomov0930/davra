import { AVATAR_SIZE } from "./images";

function encode(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Crops an image to the centre square and scales it to `size` px, in the browser. Re-encoding also
 * strips EXIF metadata such as GPS location. WebP when the browser can encode it, JPEG otherwise.
 */
export async function resizeToSquare(file: Blob, size = AVATAR_SIZE): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is not available");
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close();

  const webp = await encode(canvas, "image/webp", 0.85);
  if (webp?.type === "image/webp") return webp;

  // JPEG has no transparency: paint transparent areas white instead of black.
  context.globalCompositeOperation = "destination-over";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size, size);
  const jpeg = await encode(canvas, "image/jpeg", 0.9);
  if (!jpeg) throw new Error("Could not encode the image");
  return jpeg;
}
