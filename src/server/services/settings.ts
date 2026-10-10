import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export type Settings = {
  report_hide_threshold: number;
  report_hide_threshold_urgent: number;
  interstitial_mode: "off" | "new_domains" | "unknown";
};

const DEFAULT_SETTINGS: Settings = {
  report_hide_threshold: 3,
  report_hide_threshold_urgent: 2,
  interstitial_mode: "new_domains",
};

/** Settings admins change on /admin/sozlamalar (public values). */
export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("app_settings").select("key, value");
  if (error) throw error;
  const values = Object.fromEntries(data.map((row) => [row.key, row.value]));
  return { ...DEFAULT_SETTINGS, ...values } as Settings;
});
