"use client";

import { useEffect, useRef } from "react";

import { LOGO_COLORS } from "@/lib/brand";

/** The squared paper's cell (globals.css, body background-size). Dots sit where its lines cross. */
const CELL = 28;
/** How far from the pointer the dots react, how far they are pushed, and their radius at rest. */
const RADIUS = 170;
const PUSH = 26;
const DOT = 2.5;
/** Each quarter around the pointer takes the logo square in the same corner. */
const TONES = [LOGO_COLORS.bottomRight, LOGO_COLORS.bottomLeft, LOGO_COLORS.topRight, LOGO_COLORS.topLeft];

/**
 * "Magnet dots" (DECISIONS.md D78): the paper has a faint dot where its lines cross (globals.css). Near the
 * mouse pointer, coloured dots rise from them, are pushed away from it and take the four colours of the
 * logo, one per corner. Pure decoration on a canvas
 * under the page: it never takes the pointer and is not read out. It only runs for a mouse or a pen on a
 * device that can hover, and never for people who prefer less motion or use forced colours. Between
 * moves it stops drawing.
 */
export function MagnetDots() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const motionQuery = window.matchMedia(
      "(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)",
    );
    const forcedColorsQuery = window.matchMedia("(forced-colors: active)");

    const target = { x: 0, y: 0, on: false };
    const current = { x: 0, y: 0, strength: 0 };
    let width = 0;
    let height = 0;
    let ratio = 1;
    let frame = 0;
    let enabled = false;

    const resize = () => {
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    };

    const draw = () => {
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.clearRect(0, 0, width, height);
      if (current.strength < 0.01) return;

      // The paper scrolls with the page, so its crossings move by the scroll offset.
      const originX = 0.5 - (window.scrollX % CELL);
      const originY = 0.5 - (window.scrollY % CELL);
      const firstColumn = Math.ceil((current.x - RADIUS - originX) / CELL);
      const lastColumn = Math.floor((current.x + RADIUS - originX) / CELL);
      const firstRow = Math.ceil((current.y - RADIUS - originY) / CELL);
      const lastRow = Math.floor((current.y + RADIUS - originY) / CELL);

      for (let row = firstRow; row <= lastRow; row++) {
        for (let column = firstColumn; column <= lastColumn; column++) {
          const baseX = originX + column * CELL;
          const baseY = originY + row * CELL;
          const dx = baseX - current.x;
          const dy = baseY - current.y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance >= RADIUS) continue;

          const force = (1 - distance / RADIUS) ** 2 * current.strength;
          const alpha = Math.min(1, force / 0.12);
          if (alpha < 0.02) continue;

          context.globalAlpha = alpha;
          context.fillStyle = TONES[(dx >= 0 ? 0 : 1) + (dy >= 0 ? 0 : 2)];
          context.beginPath();
          context.arc(
            baseX + (dx / distance) * force * PUSH,
            baseY + (dy / distance) * force * PUSH,
            DOT * (1 + force * 1.8),
            0,
            Math.PI * 2,
          );
          context.fill();
        }
      }
      context.globalAlpha = 1;
    };

    const tick = () => {
      frame = 0;
      current.x += (target.x - current.x) * 0.2;
      current.y += (target.y - current.y) * 0.2;
      current.strength += ((target.on ? 1 : 0) - current.strength) * 0.08;
      draw();
      const settled =
        Math.abs(target.x - current.x) < 0.1 &&
        Math.abs(target.y - current.y) < 0.1 &&
        Math.abs((target.on ? 1 : 0) - current.strength) < 0.002;
      if (!settled) frame = requestAnimationFrame(tick);
    };

    const schedule = () => {
      if (enabled && !frame && !document.hidden) frame = requestAnimationFrame(tick);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (!target.on && current.strength < 0.01) {
        // Start where the pointer is instead of sliding in from the last place it left.
        current.x = event.clientX;
        current.y = event.clientY;
      }
      target.x = event.clientX;
      target.y = event.clientY;
      target.on = true;
      schedule();
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      target.on = false;
      schedule();
    };

    const onBlur = () => {
      target.on = false;
      schedule();
    };

    const onScroll = () => {
      if (current.strength >= 0.01) schedule();
    };

    const onResize = () => {
      resize();
      draw();
    };

    const start = () => {
      enabled = true;
      resize();
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onPointerLeave);
      window.addEventListener("blur", onBlur);
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onResize);
    };

    const stop = () => {
      enabled = false;
      cancelAnimationFrame(frame);
      frame = 0;
      target.on = false;
      current.strength = 0;
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };

    const update = () => {
      const wanted = motionQuery.matches && !forcedColorsQuery.matches;
      if (wanted && !enabled) start();
      if (!wanted && enabled) stop();
    };

    update();
    motionQuery.addEventListener("change", update);
    forcedColorsQuery.addEventListener("change", update);
    return () => {
      motionQuery.removeEventListener("change", update);
      forcedColorsQuery.removeEventListener("change", update);
      stop();
    };
  }, []);

  return (
    <canvas ref={canvasRef} aria-hidden className="pointer-events-none fixed inset-0 -z-1 size-full print:hidden" />
  );
}
