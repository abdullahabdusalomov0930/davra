import { z } from "zod";

// Zod compiles object parsers with `new Function` when the environment allows it, and probes for that
// on first use. The site's Content-Security-Policy forbids eval, so in the browser the probe is blocked
// and reported as a CSP violation. Interpreted parsing is fast enough for forms and server inputs.
// Import `z` from here, never from "zod" directly (enforced by ESLint).
z.config({ jitless: true });

export { z };
