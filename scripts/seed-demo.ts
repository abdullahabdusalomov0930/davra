/**
 * Fills a local database with demo accounts, the cards in supabase/seed/demo-resources.csv, and some
 * likes, saves, ratings, comments and follows, so feeds, "Haftalik Top 10" and the admin panel have
 * something to show. Run after `pnpm db:reset`:
 *
 *   pnpm db:seed
 *
 * Refuses to run against anything but a local Supabase unless `--allow-remote` is given. Every demo
 * account uses the password below; never seed a public project with them.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { parseCsvRecords } from "../src/lib/csv";

import { type AdminClient, adminClientFromEnv, importRecords, isLocalHost } from "./lib/import-core";

const PASSWORD = "davra-demo-parol";

type DemoUser = {
  email: string;
  username: string;
  displayName: string;
  role: "user" | "moderator" | "admin";
  university?: string;
  fieldOfStudy?: string;
  bio?: string;
  /** New accounts are not trusted yet: their cards wait for a moderator. */
  isNew?: boolean;
};

const USERS: DemoUser[] = [
  { email: "admin@example.com", username: "davra_admin", displayName: "Davracha Admin", role: "admin" },
  {
    email: "moderator@example.com",
    username: "dilnoza",
    displayName: "Dilnoza Rahimova",
    role: "moderator",
    university: "Oʻzbekiston davlat jahon tillari universiteti",
    fieldOfStudy: "Ingliz filologiyasi",
    bio: "IELTS 8.0. Til oʻrganish va akademik yozuv boʻyicha resurslar ulashaman.",
  },
  {
    email: "nodira@example.com",
    username: "nodira",
    displayName: "Nodira Karimova",
    role: "user",
    university: "Toshkent axborot texnologiyalari universiteti",
    fieldOfStudy: "Dasturiy injiniring",
    bio: "3-kurs talabasi. Veb dasturlash va maʼlumotlar tahlili.",
  },
  {
    email: "jasur@example.com",
    username: "jasur",
    displayName: "Jasur Aliyev",
    role: "user",
    university: "Toshkent davlat iqtisodiyot universiteti",
    fieldOfStudy: "Moliya",
    bio: "Iqtisodiyot, startaplar va xitoy tili.",
  },
  {
    email: "malika@example.com",
    username: "malika",
    displayName: "Malika Yusupova",
    role: "user",
    university: "Oʻzbekiston Milliy universiteti",
    fieldOfStudy: "Amaliy matematika",
  },
  { email: "yangi@example.com", username: "yangi_azo", displayName: "Yangi Aʼzo", role: "user", isNew: true },
];

const COMMENTS = [
  "Rahmat, aynan shunday manba qidirayotgan edim!",
  "Boshlovchilar uchun biroz qiyin, lekin oxirigacha koʻrishga arziydi.",
  "Ikkinchi boʻlimdagi mashqlar ayniqsa foydali boʻldi.",
  "Oʻzbek tilidagi muqobili bormi? Bilsangiz yozib qoldiring.",
  "Imtihondan oldin shu bilan takrorladim, natija yaxshi chiqdi.",
];

const REVIEWS = [
  "Tushuntirishlari aniq, misollar koʻp.",
  "Bepul boʻlishiga qaramay sifati juda yuqori.",
  "Mashqlar koʻproq boʻlganida yanada yaxshi boʻlardi.",
];

/** Deterministic pseudo-random numbers, so every seed gives the same data. */
function random(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

async function ensureUser(admin: AdminClient, user: DemoUser): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { username: user.username, display_name: user.displayName },
  });
  if (error) throw new Error(`Could not create ${user.email}: ${error.message}`);

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      role: user.role,
      university: user.university ?? null,
      field_of_study: user.fieldOfStudy ?? null,
      bio: user.bio ?? null,
      // Older accounts are trusted and their ratings count (D17, D18).
      created_at: user.isNew ? new Date().toISOString() : daysAgo(40),
    })
    .eq("id", data.user.id);
  if (profileError) throw new Error(`Could not update @${user.username}: ${profileError.message}`);
  return data.user.id;
}

async function insert(admin: AdminClient, table: "resource_likes" | "resource_saves", rows: object[]) {
  if (rows.length === 0) return;
  const { error } = await admin.from(table).insert(rows as never);
  if (error) throw new Error(`Could not insert ${table}: ${error.message}`);
}

async function main() {
  const { admin, host } = adminClientFromEnv();
  if (!isLocalHost(host) && !process.argv.includes("--allow-remote")) {
    throw new Error(`Refusing to seed ${host}: demo accounts share one known password. Use a local database.`);
  }

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("username", "davra_admin");
  if (count) {
    console.log("Demo data is already there. Run `pnpm db:reset` first for a fresh copy.");
    return;
  }

  console.log(`Seeding ${host}`);
  const ids = new Map<string, string>();
  for (const user of USERS) ids.set(user.username, await ensureUser(admin, user));

  // Cards, grouped by the member who "shared" them (the shared_by column).
  const { columns, records } = parseCsvRecords(
    await readFile(join(process.cwd(), "supabase/seed/demo-resources.csv"), "utf8"),
  );
  for (const [username, authorId] of ids) {
    const own = records.filter((record) => record.values.shared_by === username);
    if (own.length === 0) continue;
    const summary = await importRecords(admin, own, { columns, authorId, log: () => {} });
    if (summary.invalid || summary.failed) throw new Error(`Demo cards for @${username} did not import cleanly.`);
  }

  const { data: resources, error } = await admin
    .from("resources")
    .select("id, author_id, topic_id")
    .eq("status", "published")
    .order("created_at");
  if (error) throw error;

  // Spread the publication dates over the last six weeks, so "Yangi" and "Mashhur" differ.
  const next = random(2026);
  for (const resource of resources) {
    await admin
      .from("resources")
      .update({ published_at: daysAgo(1 + next() * 42) })
      .eq("id", resource.id);
  }

  // Readers like, save, rate and comment on other people's cards over the last three weeks.
  const readers = ["davra_admin", "dilnoza", "nodira", "jasur", "malika"].map((name) => ids.get(name)!);
  const likes = [];
  const saves = [];
  for (const resource of resources) {
    for (const reader of readers) {
      if (reader === resource.author_id) continue;
      if (next() < 0.55) likes.push({ user_id: reader, resource_id: resource.id, created_at: daysAgo(next() * 21) });
      if (next() < 0.25) saves.push({ user_id: reader, resource_id: resource.id, created_at: daysAgo(next() * 21) });
      if (next() < 0.3) {
        const stars = 3 + Math.floor(next() * 3);
        const { error: ratingError } = await admin.from("resource_ratings").insert({
          user_id: reader,
          resource_id: resource.id,
          stars,
          review_text: next() < 0.4 ? REVIEWS[Math.floor(next() * REVIEWS.length)] : null,
          created_at: daysAgo(next() * 21),
        });
        if (ratingError) throw new Error(`Could not rate: ${ratingError.message}`);
      }
      if (next() < 0.08) {
        await admin.from("comments").insert({
          resource_id: resource.id,
          author_id: reader,
          body: COMMENTS[Math.floor(next() * COMMENTS.length)],
        });
      }
    }
  }
  await insert(admin, "resource_likes", likes);
  await insert(admin, "resource_saves", saves);

  // Follows, for the "Obunalarim" feed.
  const { data: topics } = await admin.from("topics").select("id, slug");
  const topic = (slug: string) => topics!.find((row) => row.slug === slug)!.id;
  await admin.from("follows_topics").insert([
    { user_id: ids.get("nodira")!, topic_id: topic("dasturlash") },
    { user_id: ids.get("nodira")!, topic_id: topic("malumotlar-tahlili") },
    { user_id: ids.get("jasur")!, topic_id: topic("tadbirkorlik") },
    { user_id: ids.get("malika")!, topic_id: topic("matematika") },
  ]);
  await admin.from("follows_users").insert([
    { follower_id: ids.get("nodira")!, followed_id: ids.get("malika")! },
    { follower_id: ids.get("jasur")!, followed_id: ids.get("dilnoza")! },
    { follower_id: ids.get("malika")!, followed_id: ids.get("nodira")! },
  ]);

  // Something for the moderation queue: a new member's card and a report.
  const { error: pendingError } = await admin.from("resources").insert({
    slug: "w3schools-html-darslari",
    author_id: ids.get("yangi_azo")!,
    topic_id: topic("dasturlash"),
    title: "W3Schools: HTML darslari",
    url: "https://www.w3schools.com/html/",
    type: "website",
    language: "en",
    price: "free",
    level: "beginner",
    summary:
      "HTML teglarini qisqa misollar va brauzerda darhol sinab koʻrish mumkin boʻlgan muharrir bilan oʻrgatadigan darslar.",
    for_whom: "HTMLni endi boshlayotganlar uchun",
    status: "pending",
  });
  if (pendingError) throw new Error(`Could not add the pending card: ${pendingError.message}`);
  await admin.from("reports").insert({
    reporter_id: ids.get("jasur")!,
    target_type: "resource",
    target_id: resources[0].id,
    reason: "wrong_info",
    details: "Kurs tavsifida yil notoʻgʻri koʻrsatilgan.",
  });

  console.log(
    `Done: ${USERS.length} accounts, ${resources.length + 1} cards, ${likes.length} likes, ${saves.length} saves.`,
  );
  console.log(`Sign in with any of: ${USERS.map((user) => user.email).join(", ")} — password "${PASSWORD}".`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
