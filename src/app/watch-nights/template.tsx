import type { ReactNode } from "react";
import { PageTransition } from "@/components/page-transition";

/** Remounts between /watch-nights, /watch-nights/new and /watch-nights/[id], so those moves fly too. */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition nested>{children}</PageTransition>;
}
