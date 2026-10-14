import { cn } from "cn";

import { APP_NAME } from "@/lib/config";
import { LOGO_GRID, LOGO_SQUARE_RADIUS, LOGO_SQUARES, LOGO_STICKER_RADIUS } from "@/lib/brand";

/**
 * The sticker: four coloured squares on white, stuck on a little crooked. Decorative: the link around it
 * carries the name. It straightens up when the logo link is hovered.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${LOGO_GRID} ${LOGO_GRID}`}
      aria-hidden
      className={cn(
        "size-10 shrink-0 -rotate-6 drop-shadow-[0_4px_5px_rgb(0_0_0/0.22)] transition-transform duration-300 group-hover/logo:scale-105 group-hover/logo:rotate-0",
        className,
      )}
    >
      <rect
        x="0.5"
        y="0.5"
        width={LOGO_GRID - 1}
        height={LOGO_GRID - 1}
        rx={LOGO_STICKER_RADIUS - 0.5}
        fill="#ffffff"
        stroke="#e3e3e3"
      />
      {LOGO_SQUARES.map(({ x, y, size, fill }) => (
        <rect key={fill} x={x} y={y} width={size} height={size} rx={LOGO_SQUARE_RADIUS} fill={fill} />
      ))}
    </svg>
  );
}

/**
 * Sticker and wordmark: the app name, lower case, in the heading face. On the narrowest phones (under
 * 360px) only the sticker shows; the link around it keeps the name for screen readers.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="hidden font-heading text-[1.2rem] leading-none font-extrabold tracking-[-0.02em] min-[22.5rem]:inline sm:text-[1.4rem]">
        {APP_NAME.toLowerCase()}
      </span>
    </span>
  );
}
