/** Up to two initials for an avatar placeholder ("Nodira Karimova" → "NK"). Safe for any script. */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "");
  return letters.join("").toLocaleUpperCase("uz") || "?";
}
