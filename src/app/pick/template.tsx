import type { ReactNode } from "react";
import { PageTransition } from "@/components/page-transition";

/** Remounts between Pick and the swipe deck under it, so going from one to the other flies too. */
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition nested>{children}</PageTransition>;
}
