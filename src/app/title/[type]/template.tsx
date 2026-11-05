import type { ReactNode } from "react";
import { PageTransition } from "@/components/page-transition";

/**
 * Remounts when the title changes (a new [id], or a new [type] around it), so one title page to another
 * flies too.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition nested>{children}</PageTransition>;
}
