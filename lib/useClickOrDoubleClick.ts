"use client";

import { useRef } from "react";

// A plain onClick fires before onDoubleClick can ever be detected, so a
// double-click intended to drop a sticky note would always navigate away
// first. This delays single-click action just long enough to see whether a
// second click follows within the window.
export function useClickOrDoubleClick(onSingleClick: () => void, delayMs = 240) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return {
    onClick: () => {
      if (timer.current) return;
      timer.current = setTimeout(() => {
        onSingleClick();
        timer.current = null;
      }, delayMs);
    },
    onDoubleClick: () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    },
  };
}
