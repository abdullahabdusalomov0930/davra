/**
 * Password policy (security addendum 5.1): at least 10 characters, and not one of the passwords
 * people pick most. The list is a small built-in one: entries of 10+ characters from public
 * most-common-password lists, plus local ones. Supabase stores and checks the password itself; set
 * the same minimum length in the Supabase dashboard (README).
 */
export const PASSWORD_MIN_LENGTH = 10;
/** Supabase hashes passwords with bcrypt, which ignores everything after 72 bytes. */
export const PASSWORD_MAX_LENGTH = 72;

const COMMON_PASSWORDS = new Set([
  "0123456789",
  "0987654321",
  "1029384756",
  "1111111111",
  "1122334455",
  "1234512345",
  "1234567890",
  "12345678910",
  "123456789a",
  "123456789q",
  "1234567890a",
  "1234567890q",
  "1234567891",
  "123456789abc",
  "1234qwerasdf",
  "123qweasdzxc",
  "1q2w3e4r5t",
  "1q2w3e4r5t6y",
  "1qaz2wsx3edc",
  "2222222222",
  "5555555555",
  "7777777777",
  "8888888888",
  "9876543210",
  "a123456789",
  "aaaaaaaaaa",
  "abc1234567",
  "abcd123456",
  "abcdefghij",
  "administrator",
  "asdfghjkl1",
  "asdfghjkl;",
  "baseball123",
  "football123",
  "iloveyou12",
  "iloveyou123",
  "letmein123",
  "password12",
  "password123",
  "password1234",
  "password!",
  "passw0rd123",
  "princess123",
  "q1w2e3r4t5",
  "q1w2e3r4t5y6",
  "qazwsxedcrfv",
  "qwerty1234",
  "qwerty12345",
  "qwerty123456",
  "qwertyuiop",
  "qwertyuiop1",
  "qwertyuiop123",
  "starwars123",
  "sunshine123",
  "superman123",
  "trustno1234",
  "welcome123",
  "zaq12wsxcde",
  "zxcvbnm123",
  "zxcvbnm1234",
  // Local ones.
  "parol12345",
  "parol123456",
  "parolparol",
  "toshkent123",
  "toshkent2024",
  "toshkent2025",
  "toshkent2026",
  "uzbekistan",
  "uzbekistan1",
  "uzbekistan123",
  "o'zbekiston",
  "ozbekiston",
  "ozbekiston123",
  "samarqand123",
  "davra12345",
  "davradavra",
]);

/** Common, one repeated character, or a run like "abcdefghij" or "9876543210". */
export function isCommonPassword(password: string): boolean {
  const value = password.toLowerCase();
  if (COMMON_PASSWORDS.has(value)) return true;
  if (new Set(value).size <= 2) return true;
  const codes = [...value].map((char) => char.codePointAt(0)!);
  const steps = new Set(codes.slice(1).map((code, index) => code - codes[index]));
  return steps.size === 1 && [1, -1].includes([...steps][0]);
}

/** The password contains the username or the part of the e-mail address before the @. */
export function containsPersonalInfo(password: string, { email, username }: { email?: string; username?: string }) {
  const value = password.toLowerCase();
  const parts = [username, email?.split("@")[0]].filter((part): part is string => Boolean(part && part.length >= 4));
  return parts.some((part) => value.includes(part.toLowerCase()));
}
