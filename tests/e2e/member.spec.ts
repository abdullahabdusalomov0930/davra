import { expect, type Page, test } from "@playwright/test";

import { accounts, signIn } from "./helpers";

async function fillResourceForm(page: Page, { url, title }: { url: string; title: string }) {
  await page.getByLabel("Havola (URL)").fill(url);
  await page.getByLabel("Sarlavha").fill(title);
  await page.getByLabel("Mavzu").selectOption({ label: "Dasturlash" });
  for (const [group, label] of [
    ["Turi", "Kurs"],
    ["Resurs tili", "Inglizcha"],
    ["Narxi", "Bepul"],
    ["Daraja", "Boshlangʻich"],
  ]) {
    await page.getByRole("group", { name: group }).getByText(label, { exact: true }).click();
  }
  await page
    .getByLabel("Nimani oʻrgatadi?")
    .fill("Avtomatik testlar uchun yaratilgan resurs: matni yetarlicha uzun va mazmunli.");
  await page.getByLabel("Kimga foydali?").fill("Testlarni tekshirish uchun");
}

test("a trusted member's card is published at once", async ({ page }) => {
  await signIn(page, accounts.member, "/yangi-resurs");
  const title = `E2E kurs ${Date.now()}`;
  await fillResourceForm(page, { url: `https://example.com/e2e/${Date.now()}`, title });
  await page.getByRole("button", { name: "Ulashish" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(page.getByText("Tekshiruvda")).toHaveCount(0);
});

test("a duplicate link points at the existing card", async ({ page }) => {
  await signIn(page, accounts.member, "/yangi-resurs");
  await fillResourceForm(page, { url: "https://cs50.harvard.edu/x/?utm_source=telegram", title: "CS50 yana bir bor" });
  await page.getByRole("button", { name: "Ulashish" }).click();
  await expect(page.getByRole("link", { name: "Mavjud kartani ochish" })).toHaveAttribute(
    "href",
    "/resurs/cs50-kompyuter-fanlariga-kirish",
  );
});

test("like, save, rate and comment on someone else's card", async ({ page }) => {
  await signIn(page, accounts.member, "/resurs/y-combinator-kutubxonasi");

  // Buttons ignore clicks while the previous one is being saved (aria-busy).
  const like = page.getByRole("button", { name: /^Yoqtirish/ }).first();
  const liked = (await like.getAttribute("aria-pressed")) === "true";
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", String(!liked));
  await expect(like).not.toHaveAttribute("aria-busy", "true");
  await like.click();
  await expect(like).toHaveAttribute("aria-pressed", String(liked));
  await expect(like).not.toHaveAttribute("aria-busy", "true");

  const save = page.getByRole("button", { name: "Saqlab qoʻyish" }).first();
  if ((await save.getAttribute("aria-pressed")) !== "true") await save.click();
  await expect(save).toHaveAttribute("aria-pressed", "true");
  await expect(save).not.toHaveAttribute("aria-busy", "true");
  await page.goto("/saqlanganlar");
  await expect(page.getByRole("link", { name: "Y Combinator kutubxonasi" })).toBeVisible();

  await page.goto("/resurs/y-combinator-kutubxonasi");
  await page.getByText("4 yulduz").click({ force: true });
  await page.getByLabel("Qisqa sharh").fill("Startap haqida oʻylayotganlar uchun foydali maqolalar.");
  await page.getByRole("button", { name: "Bahoni saqlash" }).click();
  await expect(page.getByText("Bahoingiz saqlandi")).toBeVisible();
  await page.getByRole("button", { name: "Bahoni oʻchirish" }).click();
  await page.getByRole("button", { name: "Ha, oʻchirish" }).click();
  await expect(page.getByText("Bahoingiz oʻchirildi")).toBeVisible();

  const comment = `Rahmat! (${Date.now()})`;
  await page.getByLabel("Izohingiz").fill(comment);
  await page.getByRole("button", { name: "Yuborish" }).click();
  await expect(page.getByText(comment)).toBeVisible();
});

test("following a topic fills the Obunalarim feed", async ({ page }) => {
  // Malika follows little, so the topic's cards are on the feed's first page.
  await signIn(page, accounts.reader, "/mavzu/xitoy-tili");
  const follow = page.getByRole("button", { name: /Obuna boʻlish|Obunadasiz/ });
  if ((await follow.getAttribute("aria-pressed")) !== "true") await follow.click();
  await expect(follow).toHaveAttribute("aria-pressed", "true");

  await page.goto("/obunalarim");
  await expect(page.getByRole("link", { name: "Pleco lugʻati" })).toBeVisible();
});
