import { DashboardHomeLink } from "./dashboard-home-link";

type DashboardHeadingProps = {
  title: string;
  organizationName: string;
  roundTitle: string;
};

export function DashboardHeading({
  title,
  organizationName,
  roundTitle,
}: DashboardHeadingProps) {
  return (
    <header className="dashboard-heading">
      <DashboardHomeLink />
      <h1>{title}</h1>
      <p>
        {organizationName}, {roundTitle}
      </p>
    </header>
  );
}
