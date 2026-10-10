import { expect, test } from "@playwright/test";

const pages = [
  "/",
  "/resurs/cs50-kompyuter-fanlariga-kirish",
  "/qidiruv?q=ingliz",
  "/haftalik",
  "/maxfiylik",
  "/kirish",
];

for (const path of pages) {
  test(`fits a phone screen: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
}

test("the menu opens and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menyuni ochish" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Mavzular" }).click();
  await expect(page).toHaveURL(/\/mavzular$/);
});
