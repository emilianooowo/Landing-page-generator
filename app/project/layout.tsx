import type { ReactNode } from "react";
import { PrivateShell } from "@/components/app/PrivateShell";

export default function ProjectLayout({ children }: { children: ReactNode }) {
  return <PrivateShell>{children}</PrivateShell>;
}
