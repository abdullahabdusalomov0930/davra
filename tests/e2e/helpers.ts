import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { type BrowserContext, expect, type Page } from "@playwright/test";

/** Demo accounts from scripts/seed-demo.ts. */
export const accounts = {
  admin: "admin@example.com",
  moderator: "moderator@example.com",
  member: "nodira@example.com",
  otherMember: "jasur@example.com",
  reader: "malika@example.com",
  newMember: "yangi@example.com",
} as const;

export const DEMO_PASSWORD = "davra-demo-parol";

/** Session cookies per account, kept for the run (`pnpm test:e2e` starts from a fresh database). */
const SESSIONS = path.join("test-results", ".sessions");
type Cookies = Parameters<BrowserContext["addCookies"]>[0];

/**
 * Signs in once per account through the form, then reuses that session: sign-in is rate limited per
 * address and per account (D74), like for any visitor, and the suite signs in dozens of times.
 */
export async function signIn(page: Page, email: string, next = "/") {
  const file = path.join(SESSIONS, `${email}.json`);
  if (existsSync(file)) {
    await page.context().addCookies(JSON.parse(readFileSync(file, "utf8")) as Cookies);
    await page.goto(next);
    if (!new URL(page.url()).pathname.startsWith("/kirish")) return;
  }
  await signInWithForm(page, email, next);
  mkdirSync(SESSIONS, { recursive: true });
  writeFileSync(file, JSON.stringify(await page.context().cookies()));
}

/** The sign-in form itself. */
export async function signInWithForm(page: Page, email: string, next = "/", password = DEMO_PASSWORD) {
  await page.goto(`/kirish?next=${encodeURIComponent(next)}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parol", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/kirish"));
}

/** WCAG 2.1 A/AA checks by axe-core; any violation fails the test with its rule and elements. */
export async function expectNoAxeViolations(page: Page) {
  await page.waitForLoadState("networkidle");
  // Check the page as it looks once still: entrance and scroll animations fade text in, and axe would
  // otherwise measure contrast halfway through a fade. Reduced motion shows every element's final state.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact}): ${violation.nodes.map((node) => node.target.join(" ")).join(", ")}`,
  );
  expect(summary).toEqual([]);
}

/**
 * A few made-up words for card texts: the safety check refuses a card that nearly repeats one the
 * same member shared in the last 24 hours, and the tests run more often than that.
 */
export function randomWords() {
  return Array.from({ length: 4 }, () =>
    Math.random()
      .toString(36)
      .replace(/[^a-z]/g, "")
      .slice(0, 6),
  ).join(" ");
}
