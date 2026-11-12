import type { ReactNode } from "react";
import { PageTransition } from "@/components/page-transition";

/** Remounts between /stats and /stats/disagree, so those moves fly too. */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition nested>{children}</PageTransition>;
}
