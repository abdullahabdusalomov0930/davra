import "server-only";

import { toLatin } from "@/lib/transliterate";

import en from "./data/words/en.json";
import ru from "./data/words/ru.json";
import uz from "./data/words/uz.json";

/**
 * Word filter (security addendum 2.1, DECISIONS.md D66). The lists live in data/words/*.json, one file
 * per language, and are STARTER LISTS: deliberately small, to be extended by the owner. An entry is
 *
 *   "word"          the whole word ("blyat")
 *   "stem*"         any word starting with it ("kazino*" also finds "kazinoda")
 *   "two words"     these words in a row; each may end with * ("pul ishla*")
 *
 * Entries may be written in Latin or Cyrillic: both are compared in Uzbek Latin. Before an entry
 * goes into a list, check that it is not part of an ordinary Uzbek, Russian or English word: the
 * Russian "хуй" is left out because it reads "xuy" (temper) in Uzbek, "sik*" because of "sikl".
 *
 * Simple disguises are seen through: upper case, letters repeated ("kaaazino"), dots, dashes or
 * spaces between letters ("k.a.z.i.n.o", "k a z i n o"), apostrophes, digits and symbols used as
 * letters ("k4z1n0", "$ex"), accents ("kàzìnò"), stylised Unicode letters (NFKC) and Cyrillic or
 * Greek letters that look Latin, and the other way round ("kаzino" with a Cyrillic "а").
 */

export const WORD_CATEGORIES = ["profanity", "hate", "sexual", "drugs_weapons", "scam", "gambling"] as const;

export type WordCategory = (typeof WORD_CATEGORIES)[number];

export type WordLists = Partial<Record<WordCategory, readonly string[]>>;

/** "аa еe" → { а: "a", е: "e" }. */
function pairs(list: string): Record<string, string> {
  return Object.fromEntries(list.split(" ").map((pair) => [...pair]));
}

// Letters that look alike across alphabets (visual, not by sound).
const CYRILLIC_LOOKS_LATIN = pairs("аa еe оo рp сc уy хx кk мm тt іi јj ѕs һh ԁd ԛq ԝw ӏl");
const LATIN_LOOKS_CYRILLIC = pairs("aа eе oо pр cс yу xх kк mм tт");
const GREEK_LOOKS_LATIN = pairs("αa βb εe ιi κk νv οo ρp τt υu χx");

// Digits and symbols used for letters. Applied to the lists' letters, not to the text, so "1" can be
// both "i" and "l".
const LEET: Record<string, string> = {
  a: "4@",
  b: "8",
  e: "3",
  g: "9",
  i: "1!|",
  l: "1|",
  o: "0",
  s: "5$",
  t: "7",
};

const APOSTROPHES = /[ʻʼ'‘’`´]/gu;
const IN_WORD = /[\p{L}\p{N}@$!|]/u;
const SEPARATORS = /[^\p{L}\p{N}@$!|]+/u;
// Dots, dashes and the like between two letters: "k.a.z.i.n.o", "ka-zi-no".
const INNER_SEPARATORS = /(?<=[\p{L}\p{N}])[.\-_*·•~+]+(?=[\p{L}\p{N}])/gu;
const MAX_TOKEN = 40;

const isLatin = (char: string) => /\p{Script=Latin}/u.test(char);
const isCyrillic = (char: string) => /\p{Script=Cyrillic}/u.test(char);

/** One word in Uzbek Latin, lower case, without accents or apostrophes. */
function foldToken(token: string): string {
  let chars = [...token].map((char) => GREEK_LOOKS_LATIN[char] ?? char);
  const latin = chars.filter(isLatin).length;
  const cyrillic = chars.filter(isCyrillic).length;

  // A word mixing alphabets is a disguise: read it in the alphabet most of its letters use.
  if (latin > 0 && cyrillic > 0) {
    chars =
      cyrillic > latin
        ? chars.map((char) => LATIN_LOOKS_CYRILLIC[char] ?? char)
        : chars.map((char) => CYRILLIC_LOOKS_LATIN[char] ?? char);
  }

  return toLatin(chars.join(""))
    .split("")
    .map((char) => CYRILLIC_LOOKS_LATIN[char] ?? (isLatin(char) ? char.normalize("NFD").replace(/\p{M}/gu, "") : char))
    .join("")
    .replace(APOSTROPHES, "")
    .replace(/[!|]+$/u, "")
    .replace(/^[!|]+/u, "")
    .replace(/(.)\1{2,}/gu, "$1$1");
}

function tokensOf(text: string): string[] {
  const tokens = text
    .split(SEPARATORS)
    .filter((token) => IN_WORD.test(token))
    .map(foldToken)
    // Numbers alone are never words of the lists ("2024" must not read "zoz4").
    .map((token) => (/^\p{N}+$/u.test(token) || token.length > MAX_TOKEN ? "#" : token));

  // Letters spaced out one by one ("k a z i n o") become one word again.
  const merged: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) merged.push(run.join(""));
    else merged.push(...run);
    run = [];
  };
  for (const token of tokens) {
    if ([...token].length === 1 && /\p{L}/u.test(token)) {
      run.push(token);
    } else {
      flush();
      merged.push(token);
    }
  }
  flush();
  return merged.filter(Boolean);
}

function prepare(text: string) {
  // Invisible characters (zero-width spaces and the like) would split a word in two.
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{Cf}/gu, "")
    .replace(APOSTROPHES, "");
}

/**
 * The words of a text as the filter compares them, e.g. for spotting near-duplicates:
 * "Bepul KURS — Pythón!" → ["bepul", "kurs", "python"].
 */
export function wordsOf(text: string): string[] {
  return tokensOf(prepare(text)).filter((token) => token !== "#");
}

const escape = (char: string) => char.replace(/[\\^$.*+?()[\]{}|/-]/g, "\\$&");

function letterPattern(char: string) {
  const alternatives = LEET[char];
  return alternatives ? `[${escape(char)}${[...alternatives].map(escape).join("")}]` : escape(char);
}

/** "kazino*" → a pattern for one word that tolerates repeated letters and look-alike symbols. */
function wordPattern(entry: string): string | null {
  const stem = entry.endsWith("*");
  const word = foldToken(prepare(stem ? entry.slice(0, -1) : entry));
  if (!word || !/^[\p{L}\p{N}]+$/u.test(word)) return null;

  let pattern = "";
  const chars = [...word];
  for (let i = 0; i < chars.length; i++) {
    const letter = letterPattern(chars[i]);
    if (chars[i + 1] === chars[i]) {
      pattern += `${letter}{2}`;
      i++;
    } else {
      pattern += `${letter}{1,2}`;
    }
  }
  return stem ? `${pattern}[^ ]*` : pattern;
}

function entryPattern(entry: string): string | null {
  const words = entry.trim().split(/\s+/u).map(wordPattern);
  return words.length === 0 || words.includes(null) ? null : words.join(" ");
}

export type WordFilter = {
  /** The categories whose words appear in the text. */
  find(text: string): WordCategory[];
};

export function createWordFilter(...lists: WordLists[]): WordFilter {
  const patterns = WORD_CATEGORIES.flatMap((category) => {
    const entries = lists.flatMap((list) => list[category] ?? []);
    const alternatives = entries.map(entryPattern).filter((pattern) => pattern !== null);
    if (alternatives.length === 0) return [];
    return [{ category, pattern: new RegExp(`(?:^| )(?:${alternatives.join("|")})(?= |$)`, "u") }];
  });

  return {
    find(text) {
      const prepared = prepare(text);
      // Once as written, once with dots and dashes inside words removed ("k.a.z.i.n.o").
      const variants = [tokensOf(prepared).join(" "), tokensOf(prepared.replace(INNER_SEPARATORS, "")).join(" ")];
      return patterns
        .filter(({ pattern }) => variants.some((variant) => pattern.test(variant)))
        .map(({ category }) => category);
    },
  };
}

// Each file's "_note" is for whoever edits the lists.
export const wordFilter = createWordFilter(...[uz, ru, en].map(({ _note, ...lists }) => lists));
