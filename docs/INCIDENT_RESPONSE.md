# Incident response

What the owner and admins do when something goes wrong: severe content, a leaked key, a taken-over
account, a data leak. Background: [SECURITY.md](../SECURITY.md); how moderators decide everyday cases:
[MODERATION_GUIDE.md](MODERATION_GUIDE.md).

For every incident, keep a short private log: what happened, when you noticed, what you did and when.
Write down times in UTC. Do not paste keys, passwords or the content itself into the log or into chats.

> **TODO (owner):** consult a lawyer about Uzbekistan's rules for reporting illegal content and
> personal-data breaches (to whom, how fast, what to keep), and write the answer into the sections
> below. Nothing here is legal advice.

## Qisqa tartib (oʻzbekcha)

**Jiddiy kontent** (bolalar xavfsizligi, terrorizm, zoʻravonlik tahdidi):

1. Havolani ochmang va hech narsani yuklab olmang. Kontent birinchi shikoyatdayoq yashiriladi.
2. `/admin/jiddiy`: saqlangan nusxa (matn, manzil, muallif ID, vaqtlar, shikoyatlar) borligini
   tekshiring va „Dalillar saqlandi“ ni bosing.
3. Muallifni muddatsiz bloklang (`/admin/foydalanuvchilar`).
4. Advokat bilan maslahatlashing: qaysi organga va qancha muddatda xabar berish kerak.
5. Advokat rozi boʻlgandan keyin kartani oʻchiring (izoh yashirilganicha qoladi) va holatni „Yopish“
   bilan yoping.

**Kalit oshkor boʻldi:** darhol almashtiring ([SECURITY.md → Rotating keys](../SECURITY.md#rotating-keys)),
Vercel'da qayta deploy qiling, Supabase va Vercel loglarida begona foydalanishni tekshiring.

**Hisob egallab olindi:** parolni tiklang, sessiyalarni bekor qiling, xodim boʻlsa rolini olib qoʻying,
`/admin/jurnal` da shu hisob qilgan harakatlarni tekshirib, keraklilarini qaytaring.

**Maʼlumot sizdi:** manbani yoping (kalit, sessiya, xato), nima va kimning maʼlumoti chiqqanini
aniqlang, advokat bilan foydalanuvchilarga va organlarga xabar berish tartibini kelishing.

## Severe content

Child sexual abuse material, terrorism or violent extremism, credible threats of violence.

Davracha stores only text and a link, so the "content" is a card, comment or profile text and the address
it points to. The first `severe` report hides it at once (also from search, feeds and the sitemap) and
writes a frozen copy to `severe_incidents`: the text, the URL and final URL, the author id, timestamps
and every severe report. Only admins can read that table; the content cannot be deleted while the
incident is open.

1. **Do not open the link** and do not download, screenshot or forward anything. Downloading such
   material can itself be a crime. The admin page shows only the domain and a copyable address on
   purpose.
2. **Check the evidence** on `/admin/jiddiy`: the snapshot is there and complete (text, addresses,
   author id, report times). Then press **Dalillar saqlandi**. Do not copy the snapshot out of the
   database unless the lawyer asks for it.
3. **Stop the author:** ban the account permanently (`/admin/foydalanuvchilar` → Bloklash →
   Muddatsiz). Check the author's other cards and comments and report or hide them too.
4. **Legal step:** ask the lawyer whether and where to report (law enforcement, a national hotline)
   and what to hand over. The hosting service of the linked site can usually be told through its abuse
   contact; for child sexual abuse material, members of the INHOPE hotline network accept reports.
   **TODO (owner):** write down the contacts the lawyer recommends.
5. **Delete** only after the evidence is preserved and the lawyer agrees (a card: its page or
   Resurslar → Oʻchirish; a comment stays hidden), then **Yopish** the incident. The snapshot stays in
   `severe_incidents`; deleting the author's account does not remove it.
6. If the same link or domain appears again, block the domain on `/admin/domenlar`.

Look after the moderators who saw it: they should stop for the day and be able to talk to someone.

## Leaked key or password

Signs: a key committed to git (the CI secret scan or GitHub's secret scanning alerts), pasted into a
chat or issue, visible in a screenshot or log, or unexplained activity in Supabase or Vercel.

1. **Rotate at once**, before investigating: follow
   [SECURITY.md → Rotating keys](../SECURITY.md#rotating-keys). `SUPABASE_SECRET_KEY` first: it
   bypasses Row Level Security. Redeploy on Vercel after every change.
2. **A key in git history:** rotation is the fix. Rewriting history does not help once the commit was
   pushed (forks, clones and caches keep it); do it only if the owner wants the history clean.
3. **Look for misuse** in the time since the leak:
   - Supabase → Logs: API requests with the secret key from unknown addresses, unusual Postgres
     queries, Auth events (new admins, password changes).
   - `/admin/jurnal`: actions by unexpected actors; "Tizim" entries at odd times.
   - The database: new staff (`select username, role from public.profiles where role <> 'user'`),
     unexpected changes to `app_settings`, `blocked_domains`, `blocked_terms`.
   - Vercel → Logs and the project's Activity: new deployments or changed environment variables.
   - GitHub: new collaborators, deploy keys, Actions secrets or workflow changes.
4. **Owner accounts** (GitHub, Supabase, Vercel, Cloudflare, Google Cloud): if one may be affected,
   change its password, check its 2FA, sign out other sessions and review access tokens.
5. If data was read or changed, continue with **Data leak** below.

## Account takeover

### A staff account (moderator or admin)

1. **Remove the power first:** another admin sets the role to `user` (`/admin/foydalanuvchilar` → Rol).
   If no other admin can sign in, run in Supabase → SQL editor:
   ```sql
   update public.profiles set role = 'user' where username = '<username>';
   ```
2. **End the sessions:** in the SQL editor, `delete from auth.sessions where user_id = '<user id>';`.
   An access token already issued stays valid until it expires (Supabase's JWT expiry, one hour by
   default), which is why step 1 comes first.
3. **Reset the password:** Supabase → Authentication → Users → the user → Send password recovery. Make
   sure the e-mail address on the account is still the owner's.
4. **Undo the damage:** `/admin/jurnal` shows every action by that account with its reason. Restore
   hidden content, lift wrong bans, reverse role and setting changes, each with a reason such as
   "Hisob egallab olingan, qaror bekor qilindi".
5. Give the role back once the person has a new password, ideally a password manager, and consider
   `REQUIRE_RECENT_LOGIN_FOR_ADMIN=true`.

### A member's account

1. If it is posting spam or abuse, ban it temporarily (1 or 7 days): this hides its content at once.
2. Tell the owner (through the contact they used) to reset the password with "Parolni unutdingizmi?".
3. When they have access again, lift the ban; the hidden content comes back. Remove what the attacker
   posted.

Many failed sign-ins or many new accounts from one address show up on `/admin/xavfsizlik`.

## Data leak

Personal data Davracha holds: e-mail addresses (Supabase Auth), usernames, display names, optional bio,
university and field of study, what people posted, and hashed IP and e-mail values (30 days). Staff
data adds moderation history, reports and severe-incident snapshots.

1. **Contain:** find the source and close it: rotate keys, end sessions, fix or roll back the faulty
   deployment (Vercel → Deployments → an earlier one → Promote), or turn off the affected feature.
2. **Assess:** what data, whose, for how long, who could have read it. Use the logs listed under
   "Leaked key"; check whether a Row Level Security policy or a column grant was changed by a recent
   migration.
3. **Preserve:** keep the relevant logs (Supabase keeps them only for a limited time; export them) and
   your incident log.
4. **Notify:** with the lawyer, decide whom to tell and how fast: affected users, authorities.
   **TODO (owner):** write down the obligations under Uzbekistan's personal-data law once known.
5. **Fix and test:** add a pgTAP or unit test that would have caught it, so it cannot come back.
6. **Afterwards:** write a short summary (cause, impact, what changed) and add a decision to
   `DECISIONS.md` if the security model changed.

## After any incident

- Re-run `pnpm security:smoke https://<domain>` and check `/admin/xavfsizlik`.
- Update this document with what was missing or wrong.
