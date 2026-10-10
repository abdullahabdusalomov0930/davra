import { expect, test } from "@playwright/test";

test("home: the value in three points and the feed, no sign-in needed", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eng foydali oʻquv resurslari — bir joyda");
  await expect(page.locator("main article")).toHaveCount(18);

  await page.getByRole("link", { name: "Yangi", exact: true }).click();
  await expect(page).toHaveURL(/tartib=yangi/);
  await page.getByRole("link", { name: "Yana koʻrsatish" }).click();
  await expect(page.locator("main article")).not.toHaveCount(18);
});

test("resource page: details, a safe external link, a guest's like asks to sign in", async ({ page }) => {
  await page.goto("/resurs/cs50-kompyuter-fanlariga-kirish");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CS50: kompyuter fanlariga kirish");

  const open = page.getByRole("link", { name: /Havolaga oʻtish/ });
  // The link is kept as written (D39), only normalized.
  await expect(open).toHaveAttribute("href", "https://cs50.harvard.edu/x/");
  await expect(open).toHaveAttribute("target", "_blank");
  await expect(open).toHaveAttribute("rel", /noopener.*nofollow/);

  await page
    .getByRole("link", { name: /Yoqtirish uchun/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/kirish\?next=%2Fresurs%2Fcs50/);
});

test("search: Uzbek text, Cyrillic spelling and filters", async ({ page }) => {
  await page.goto("/qidiruv?q=python");
  await expect(page.getByRole("link", { name: "Python rasmiy qoʻllanmasi (tutorial)" })).toBeVisible();

  // Cyrillic is matched against the Latin spelling.
  await page.goto(`/qidiruv?q=${encodeURIComponent("чизиқли алгебра")}`);
  await expect(page.getByRole("link", { name: "MIT OCW 18.06: chiziqli algebra" })).toBeVisible();

  await page.goto("/qidiruv?til=ru");
  await expect(page.locator("main article")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "Современный учебник JavaScript" })).toBeVisible();
});

test("topics and the weekly top", async ({ page }) => {
  await page.goto("/mavzular");
  await page
    .getByRole("link", { name: /Matematika/ })
    .first()
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Matematika");
  await expect(page.locator("main article").first()).toBeVisible();

  await page.goto("/haftalik");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Haftalik Top 10");
  await expect(page.locator("main ol > li").first()).toContainText("Bu hafta:");
});

test("keyboard: the skip link jumps to the content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Asosiy mazmunga oʻtish" });
  await expect(skip).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
});

test("unknown pages answer 404 and are not indexed", async ({ page }) => {
  const response = await page.goto("/resurs/bunday-resurs-yoq");
  await expect(page.getByText("Bu sahifa mavjud emas")).toBeVisible();
  // Streamed pages send 200 before the 404 is known (D38); the robots tag keeps them out of search.
  expect([200, 404]).toContain(response?.status());
  const robots = await page
    .locator('meta[name="robots"]')
    .evaluateAll((tags) => tags.map((tag) => tag.getAttribute("content")));
  expect(robots.length).toBeGreaterThan(0);
  expect(robots.every((content) => content?.includes("noindex"))).toBe(true);
});
