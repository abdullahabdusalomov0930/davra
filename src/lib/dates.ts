import type { useFormatter } from "next-intl";

type Formatter = ReturnType<typeof useFormatter>;

/**
 * Parts for Uzbek dates ("2026-yil 10-oktabr", "2026-yil oktabr"): Intl gives "10-oktabr, 2026".
 * Stand-alone month names come capitalized ("Oktabr"); inside a sentence they are lower-case.
 */
export function uzDateParts(format: Formatter, value: Date | string) {
  const date = typeof value === "string" ? new Date(value) : value;
  return {
    year: format.dateTime(date, { year: "numeric" }),
    month: format.dateTime(date, { month: "long" }).toLocaleLowerCase("uz"),
    day: format.dateTime(date, { day: "numeric" }),
  };
}
