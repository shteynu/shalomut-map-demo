import { activeRound, organization } from "@/lib/demo-data";
import { DashboardHomeLink } from "./dashboard-home-link";

export function DashboardHeading({ title }: { title: string }) {
  return (
    <header className="dashboard-heading">
      <DashboardHomeLink />
      <h1>{title}</h1>
      <p>
        {organization.name}, {activeRound.period}
      </p>
    </header>
  );
}
