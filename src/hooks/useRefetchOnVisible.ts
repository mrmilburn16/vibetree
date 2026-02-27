"use client";

import { useEffect } from "react";

/**
 * Calls refetch when the document becomes visible again (e.g. user switches
 * back to the tab). Used so the dashboard project list stays in sync with
 * the API after creating projects on another device or tab.
 */
export function useRefetchOnVisible(refetch: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [enabled, refetch]);
}
