import type { CSSProperties } from "react";

/** Inline custom properties for the motion utilities in globals.css (--delay, --duration). */
export function motion({ delay, duration }: { delay?: number; duration?: number }): CSSProperties {
  return {
    ...(delay !== undefined && { "--delay": `${delay}ms` }),
    ...(duration !== undefined && { "--duration": `${duration}s` }),
  } as CSSProperties;
}
