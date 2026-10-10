/** Uzbek Cyrillic (and Russian) letters in Uzbek Latin, lower-case. */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "x",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  ў: "oʻ",
  қ: "q",
  ғ: "gʻ",
  ҳ: "h",
};

const CYRILLIC = /[Ѐ-ӿ]/;

export function hasCyrillic(text: string): boolean {
  return CYRILLIC.test(text);
}

/**
 * Uzbek Latin spelling of Cyrillic text, lower-cased: "Шахсий молия" → "shaxsiy moliya",
 * "Ўзбек" → "oʻzbek". Other characters are kept as they are.
 */
export function toLatin(text: string): string {
  return Array.from(text.toLowerCase())
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join("");
}
