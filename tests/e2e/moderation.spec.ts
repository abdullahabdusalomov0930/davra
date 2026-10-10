import { expect, type Page, test } from "@playwright/test";

import { accounts, randomWords, signIn } from "./helpers";

/** Moderation dialogs ask for a reason; the prefilled one (or a short one) is confirmed. */
async function confirmWithReason(page: Page, reason?: string) {
  const dialog = page.getByRole("dialog");
  const field = dialog.getByLabel("Sabab");
  if (reason || !(await field.inputValue())) await field.fill(reason ?? "E2E sinov qarori");
  await dialog.getByRole("button", { name: "Tasdiqlash" }).click();
  await expect(page.getByText("Bajarildi").first()).toBeVisible();
}

async function reportCard(page: Page, reason: string) {
  await page.getByRole("button", { name: "Shikoyat", exact: true }).click();
  await page.getByLabel(reason).check();
  await page.getByRole("dialog").getByRole("button", { name: "Yuborish" }).click();
  await expect(page.getByText(/Shikoyatingiz yuborildi|allaqachon shikoyat/)).toBeVisible();
}

test("a new member's card waits for a moderator, who approves it", async ({ browser }) => {
  const member = await (await browser.newContext()).newPage();
  await signIn(member, accounts.newMember, "/yangi-resurs");
  const title = `Yangi aʼzo kursi ${Date.now()}`;
  // A domain Davra has not seen: its link opens the "you are leaving" page first.
  await member.getByLabel("Havola (URL)").fill(`https://kurs${Date.now()}.example.org/dizayn`);
  await member.getByLabel("Sarlavha").fill(title);
  await member.getByLabel("Mavzu").selectOption({ label: "Dizayn" });
  for (const [group, label] of [
    ["Turi", "Veb-sayt"],
    ["Resurs tili", "Oʻzbekcha"],
    ["Narxi", "Bepul"],
    ["Daraja", "Barcha darajalar"],
  ]) {
    await member.getByRole("group", { name: group }).getByText(label, { exact: true }).click();
  }
  await member
    .getByLabel("Nimani oʻrgatadi?")
    .fill(`Dizayn asoslarini oʻzbek tilida tushuntiradigan sayt, koʻplab misollar bilan. ${randomWords()}`);
  await member.getByLabel("Kimga foydali?").fill("Dizaynni boshlayotganlar uchun");
  await member.getByRole("button", { name: "Ulashish" }).click();
  await expect(member.getByRole("heading", { level: 1 })).toHaveText(title);
  await expect(member.getByText("Moderator tekshiruvida")).toBeVisible();
  const cardPath = new URL(member.url()).pathname;

  const guest = await (await browser.newContext()).newPage();
  await guest.goto(cardPath);
  await expect(guest.getByText("Bu sahifa mavjud emas")).toBeVisible();

  const moderator = await (await browser.newContext()).newPage();
  await signIn(moderator, accounts.moderator, "/admin/resurslar");
  const row = moderator.locator("main li").filter({ hasText: title });
  await expect(row.getByText("Yangi aʼzo", { exact: true }).first()).toBeVisible();
  await row.getByRole("button", { name: "Tasdiqlash" }).click();
  await confirmWithReason(moderator);

  await guest.goto(cardPath);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText(title);
  await guest.getByRole("link", { name: /Havolaga oʻtish/ }).click();
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("Siz tashqi saytga oʻtyapsiz");
  await expect(guest.getByRole("link", { name: /Davom etish/ })).toHaveAttribute(
    "rel",
    "noopener noreferrer nofollow ugc",
  );
});

test("a new member's comment with a link waits for a moderator", async ({ browser }) => {
  const member = await (await browser.newContext()).newPage();
  await signIn(member, accounts.newMember, "/resurs/sqlbolt");
  const body = `Qoʻshimcha mashqlar shu yerda: https://example.org/mashq/${Date.now()}`;
  await member.getByLabel("Izohingiz").fill(body);
  await member.getByRole("button", { name: "Yuborish" }).click();
  await expect(member.getByText("Izohingiz moderator tekshiruvidan keyin hammaga koʻrinadi")).toBeVisible();
  const own = member.locator("li").filter({ hasText: body });
  await expect(own.getByText("Moderator tekshiruvida — hozircha faqat siz koʻrasiz")).toBeVisible();

  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/resurs/sqlbolt");
  await expect(guest.getByText(body)).toHaveCount(0);

  const moderator = await (await browser.newContext()).newPage();
  await signIn(moderator, accounts.moderator, "/admin/izohlar");
  const row = moderator.locator("main li").filter({ hasText: body });
  await expect(row.getByText("Yangi aʼzo havola qoʻshgan")).toBeVisible();
  await row.getByRole("button", { name: "Eʼlon qilish" }).click();
  await confirmWithReason(moderator);

  await guest.reload();
  await expect(guest.getByText(body)).toBeVisible();
});

test("a report reaches the moderators and can be dismissed", async ({ browser }) => {
  const reporter = await (await browser.newContext()).newPage();
  await signIn(reporter, accounts.otherMember, "/resurs/sqlbolt");
  await reporter.getByRole("button", { name: "Shikoyat", exact: true }).click();
  await reporter.getByLabel("Spam yoki reklama").check();
  await reporter.getByRole("dialog").getByRole("button", { name: "Yuborish" }).click();
  await expect(reporter.getByText(/Shikoyatingiz yuborildi|allaqachon shikoyat/)).toBeVisible();

  const moderator = await (await browser.newContext()).newPage();
  await signIn(moderator, accounts.moderator, "/admin/shikoyatlar");
  const report = moderator.locator("main li").filter({ hasText: "SQLBolt" });
  await report.getByRole("button", { name: "Rad etish" }).click();
  await confirmWithReason(moderator);
});

test("reports from three members hide a card until a moderator decides", async ({ browser }) => {
  const card = "/resurs/geogebra";
  // Weights: an established member counts 1.5, a brand-new account 0.25; three members pass 3.
  for (const [account, reason] of [
    [accounts.member, "Spam yoki reklama"],
    [accounts.newMember, "Spam yoki reklama"],
  ] as const) {
    const reporter = await (await browser.newContext()).newPage();
    await signIn(reporter, account, card);
    await reportCard(reporter, reason);
  }
  const guest = await (await browser.newContext()).newPage();
  await guest.goto(card);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("GeoGebra");

  const third = await (await browser.newContext()).newPage();
  await signIn(third, accounts.otherMember, card);
  await reportCard(third, "Notoʻgʻri maʼlumot");
  await guest.reload();
  await expect(guest.getByText("Bu sahifa mavjud emas")).toBeVisible();

  const author = await (await browser.newContext()).newPage();
  await signIn(author, accounts.reader, "/bildirishnomalar");
  await expect(author.getByText("Resursingiz yashirildi").first()).toBeVisible();

  const moderator = await (await browser.newContext()).newPage();
  await signIn(moderator, accounts.moderator, "/admin/shikoyatlar");
  const group = moderator.locator("main li").filter({ hasText: "GeoGebra" }).first();
  await expect(group.getByText("Avtomatik yashirilgan")).toBeVisible();
  await group.getByRole("button", { name: "Rad etish" }).click();
  await confirmWithReason(moderator);
  await guest.reload();
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText("GeoGebra");
});

test("a banned member cannot post, sees why, and can appeal", async ({ browser }) => {
  const moderator = await (await browser.newContext()).newPage();
  await signIn(moderator, accounts.moderator, "/admin/foydalanuvchilar?q=yangi");
  const row = moderator.locator("main li").filter({ hasText: "@yangi_azo" });
  await row.getByRole("button", { name: "Bloklash" }).click();
  const dialog = moderator.getByRole("dialog");
  await dialog.getByLabel("1 kun").check();
  await dialog.getByLabel("Sabab").fill("Takroriy spam havolalar");
  await dialog.getByRole("button", { name: "Tasdiqlash" }).click();
  await expect(moderator.getByText("Bajarildi").first()).toBeVisible();

  try {
    const member = await (await browser.newContext()).newPage();
    await signIn(member, accounts.newMember, "/yangi-resurs");
    await expect(member.getByText("Hisobingiz bloklangan.", { exact: false }).first()).toBeVisible();
    await expect(member.getByText("Takroriy spam havolalar", { exact: false }).first()).toBeVisible();
    await expect(member.getByRole("button", { name: "Ulashish" })).toHaveCount(0);

    await member.goto("/resurs/sqlbolt");
    await expect(member.getByLabel("Izohingiz")).toHaveCount(0);

    await member.getByRole("button", { name: "Eʼtiroz bildirish" }).first().click();
    await member.getByLabel("Nima uchun qaror notoʻgʻri?").fill("Men faqat bitta foydali havola ulashganman.");
    await member.getByRole("dialog").getByRole("button", { name: "Yuborish" }).click();
    await expect(member.getByText("Eʼtirozingiz yuborildi", { exact: false })).toBeVisible();

    await moderator.goto("/admin/etirozlar");
    const appeal = moderator.locator("main li").filter({ hasText: "Men faqat bitta foydali havola" });
    await appeal.getByRole("button", { name: "Qabul qilish" }).click();
    await confirmWithReason(moderator);
  } finally {
    // Lift the ban whatever happened, so later tests can use the account.
    await moderator.goto("/admin/foydalanuvchilar?q=yangi");
    const unban = moderator.locator("main li").filter({ hasText: "@yangi_azo" }).getByRole("button", {
      name: "Blokdan chiqarish",
    });
    if (await unban.count()) {
      await unban.click();
      await confirmWithReason(moderator);
    }
  }
});

test("regular members cannot open the moderation panel", async ({ page }) => {
  await signIn(page, accounts.member, "/admin");
  await expect(page.getByText("Bu sahifa mavjud emas")).toBeVisible();
});
