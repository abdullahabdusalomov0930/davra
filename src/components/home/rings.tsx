import { cn } from "cn";

import { motion } from "./motion";

/**
 * Concentric rings, the brand's motif ("davra" is a circle of people): thin guide rings, one dashed
 * ring turning slowly with a dot riding on it, and a solid orange ring at the centre. Decorative.
 */
export function Rings({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const stroke = tone === "light" ? "rgb(255 255 255 / 0.6)" : "rgb(255 240 225 / 0.14)";
  return (
    <svg viewBox="0 0 400 400" aria-hidden className={cn("pointer-events-none", className)}>
      {[70, 120, 170].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} fill="none" stroke={stroke} strokeWidth="1.2" />
      ))}
      <g className="origin-center animate-spin-slow" style={motion({ duration: 48 })}>
        <circle cx="200" cy="200" r="145" fill="none" stroke={stroke} strokeWidth="1.5" strokeDasharray="2 10" />
        <circle cx="345" cy="200" r="6" className="fill-brand" />
      </g>
      <g className="origin-center animate-spin-slow" style={motion({ duration: 80 })}>
        <circle cx="200" cy="30" r="4" fill={stroke} />
        <circle cx="30" cy="200" r="3" fill={stroke} />
      </g>
      <circle cx="200" cy="200" r="36" fill="none" className="stroke-brand" strokeWidth="14" />
    </svg>
  );
}
