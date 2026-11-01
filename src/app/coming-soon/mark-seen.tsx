"use client";

import { useEffect } from "react";
import { markAlertsSeen } from "./actions";

/** Marks the alerts as seen once the page has been shown, rather than when it's prefetched. Renders nothing. */
export function MarkAlertsSeen() {
  useEffect(() => {
    markAlertsSeen();
  }, []);
  return null;
}
