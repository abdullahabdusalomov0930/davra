import { expect, test } from "@playwright/test";

import { accounts, randomWords, signIn } from "./helpers";

test("a new member's card waits for a moderator, who approves it", async ({ browser }) => {
  const member = await (await browser.newContext()).newPage();
  await signIn(member, accounts.newMember, "/yangi-resurs");
  const title = `Yangi aʼzo kursi ${Date.now()}`;
  await member.getByLabel("Havola (URL)").fill(`https://example.org/e2e/${Date.now()}`);
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
  await row.getByRole("button", { name: "Tasdiqlash" }).click();
  await expect(moderator.getByText("Bajarildi").first()).toBeVisible();

  await guest.goto(cardPath);
  await expect(guest.getByRole("heading", { level: 1 })).toHaveText(title);
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
  await expect(moderator.getByText("Bajarildi").first()).toBeVisible();

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
  await expect(moderator.getByText("Bajarildi").first()).toBeVisible();
});

test("regular members cannot open the moderation panel", async ({ page }) => {
  await signIn(page, accounts.member, "/admin");
  await expect(page.getByText("Bu sahifa mavjud emas")).toBeVisible();
});
