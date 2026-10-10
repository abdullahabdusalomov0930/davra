import { test } from "@playwright/test";

import { accounts, expectNoAxeViolations, signIn } from "./helpers";

// Brief 11: Accessibility ≥ 95 on public pages. axe-core finds what can be checked automatically
// (contrast, names, labels, landmarks, ARIA); keyboard flows are covered in the other specs.

const publicPages = [
  "/",
  "/?tartib=yangi",
  "/mavzular",
  "/mavzu/dasturlash",
  "/qidiruv?q=python",
  "/resurs/cs50-kompyuter-fanlariga-kirish",
  "/u/nodira",
  "/haftalik",
  "/qoidalar",
  "/maxfiylik",
  "/removal-request",
  "/kirish",
  "/royxatdan-otish",
  "/parolni-tiklash",
  "/sahifa-yoq",
];

for (const path of publicPages) {
  test(`guest: ${path}`, async ({ page }) => {
    await page.goto(path);
    await expectNoAxeViolations(page);
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`member pages (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await signIn(page, accounts.member);
    for (const path of [
      "/",
      "/yangi-resurs",
      "/saqlanganlar",
      "/obunalarim",
      "/sozlamalar",
      "/bildirishnomalar",
      "/resurs/leetcode-masalalari",
    ]) {
      await page.goto(path);
      await expectNoAxeViolations(page);
    }
  });
}

test("moderation panel", async ({ page }) => {
  await signIn(page, accounts.admin);
  for (const path of [
    "/admin",
    "/admin/resurslar",
    "/admin/shikoyatlar",
    "/admin/havolalar",
    "/admin/foydalanuvchilar",
    "/admin/mavzular",
    "/admin/domenlar",
    "/admin/izohlar",
    "/admin/etirozlar",
    "/admin/sorovlar",
    "/admin/jiddiy",
    "/admin/jurnal",
    "/admin/sozlamalar",
    "/admin/xavfsizlik",
  ]) {
    await page.goto(path);
    await expectNoAxeViolations(page);
  }
});
