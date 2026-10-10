-- New report reasons (security addendum, layer 3). Added in their own migration: a new enum value
-- cannot be used in the transaction that adds it.
alter type public.report_reason add value if not exists 'illegal' before 'spam';
alter type public.report_reason add value if not exists 'pirated' after 'illegal';
alter type public.report_reason add value if not exists 'scam_phishing' after 'pirated';
alter type public.report_reason add value if not exists 'harassment' after 'spam';
-- Child safety, terrorism or extremism, credible threats: hidden at once, preserved as evidence.
alter type public.report_reason add value if not exists 'severe' before 'illegal';
