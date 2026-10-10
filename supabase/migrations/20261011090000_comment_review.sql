-- Comments can wait for a moderator (DECISIONS.md D64): links from new members, and texts the safety
-- check is unsure about. A separate migration, because a new enum value cannot be used in the
-- transaction that adds it.
alter type public.comment_status add value if not exists 'pending' before 'published';
