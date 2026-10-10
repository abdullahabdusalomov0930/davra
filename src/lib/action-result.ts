import type messages from "../../messages/uz.json";

import type { ValidationKey } from "./validators";

export type ActionErrorKey = keyof (typeof messages)["ActionErrors"];

/** What a Server Action returns to a form. Messages are translation keys, never raw text. */
export type ActionResult<Field extends string = never> =
  { ok: true } | { ok: false; error: ActionErrorKey; fieldErrors?: Partial<Record<Field, ValidationKey>> };

/**
 * Calls a Server Action from the browser. A network failure would otherwise throw into the nearest
 * error boundary and replace the page; a form only needs to show a message.
 */
export async function callAction<Field extends string = never>(
  action: () => Promise<ActionResult<Field>>,
): Promise<ActionResult<Field>> {
  try {
    return await action();
  } catch {
    return { ok: false, error: "unknown" };
  }
}
