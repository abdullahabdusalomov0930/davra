import type messages from "../../../messages/uz.json";

/** Keys of `Validation.*` in messages/uz.json. Schemas return these keys; forms translate them. */
export type ValidationKey = keyof (typeof messages)["Validation"];

/** Zod `error` option that carries a translation key, checked at compile time. */
export function message(key: ValidationKey) {
  return { error: key };
}
