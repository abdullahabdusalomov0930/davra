"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { markNotificationsReadAction } from "@/server/actions/notifications";

/** Opening the page marks every notice read (after it has been shown as new once). */
export function MarkRead() {
  const router = useRouter();
  useEffect(() => {
    void markNotificationsReadAction().then((result) => {
      if (result.ok) router.refresh();
    });
  }, [router]);
  return null;
}
