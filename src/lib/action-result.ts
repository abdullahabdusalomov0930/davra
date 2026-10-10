import type messages from "../../messages/uz.json";

import type { ValidationKey } from "./validators";

export type ActionErrorKey = keyof (typeof messages)["ActionErrors"];

/**
 * What a Server Action returns to a form. Messages are translation keys, never raw text. `Data` is
 * merged into the success branch; `duplicateSlug` points at an existing resource with the same link.
 */
export type ActionResult<Field extends string = never, Data extends object = object> =
  | ({ ok: true } & Data)
  | {
      ok: false;
      error: ActionErrorKey;
      fieldErrors?: Partial<Record<Field, ValidationKey>>;
      duplicateSlug?: string;
    };

/**
 * Calls a Server Action from the browser. A network failure would otherwise throw into the nearest
 * error boundary and replace the page; a form only needs to show a message.
 */
export async function callAction<Field extends string = never, Data extends object = object>(
  action: () => Promise<ActionResult<Field, Data>>,
): Promise<ActionResult<Field, Data>> {
  try {
    return await action();
  } catch {
    return { ok: false, error: "unknown" };
  }
}
