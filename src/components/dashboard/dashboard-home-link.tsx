import Link from "next/link";
import { House } from "lucide-react";
import { getNavigationAction } from "@/lib/navigation";

export function DashboardHomeLink() {
  const backToMainAction = getNavigationAction("backToMain");

  return (
    <Link className="dashboard-home-link" href={backToMainAction.href} aria-label={backToMainAction.label}>
      <House size={19} aria-hidden="true" />
      <span>{backToMainAction.label}</span>
    </Link>
  );
}
