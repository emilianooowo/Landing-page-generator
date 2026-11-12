import type { ReactNode } from "react";
import { PublicShell } from "@/components/app/PublicShell";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
