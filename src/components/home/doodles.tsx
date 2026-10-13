import { cn } from "cn";

/*
 * Pen doodles for the margins of the landing page: drawn in the current text colour, decorative only.
 * They replace arrow and pencil characters, which the handwriting font does not have.
 */

type DoodleProps = { className?: string };

/** A curved arrow that swoops down and to the right. */
export function CurvedArrow({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 120 90"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("pointer-events-none", className)}
    >
      <path d="M10 10c30 5 60 25 80 60" />
      <path d="M78 62l12 10 2-16" />
    </svg>
  );
}

/** A short arrow pointing right, as in "for example →". */
export function RightArrow({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 40 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("pointer-events-none", className)}
    >
      <path d="M3 11c9-2 21-3 32-1" />
      <path d="M28 4l7 6-7 6" />
    </svg>
  );
}

/** A small arrow pointing up, under a button. */
export function UpArrow({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 20 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("pointer-events-none", className)}
    >
      <path d="M11 29c-2-8-2-17 0-25" />
      <path d="M4 10l7-7 6 7" />
    </svg>
  );
}

/** A pencil, after a handwritten note. */
export function Pencil({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn("pointer-events-none", className)}
    >
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      <path d="M14.5 5.5l3 3" />
    </svg>
  );
}

/** A loose underline, like a pen stroke under a word. */
export function Squiggle({ className }: DoodleProps) {
  return (
    <svg
      viewBox="0 0 200 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      preserveAspectRatio="none"
      aria-hidden
      className={cn("pointer-events-none", className)}
    >
      <path d="M3 9c30-6 60-6 90-2s70 3 104-3" />
    </svg>
  );
}
