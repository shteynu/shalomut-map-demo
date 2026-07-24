import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

type ActionCardProps = {
  href: string;
  title: string;
  body: string;
  icon: ReactNode;
  glow: string;
};

/* Dashboard action card: icon circle, copy, and a soft color glow blob
   behind the leading corner. The whole card is a single link target. */
export function ActionCard({ href, title, body, icon, glow }: ActionCardProps) {
  return (
    <Link className="action-card" href={href}>
      <span className="action-card-glow" style={{ backgroundColor: glow }} aria-hidden="true" />
      <span className="action-card-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{body}</p>
      <span className="action-card-cta">
        <ArrowLeft size={18} aria-hidden="true" />
        מעבר למסך
      </span>
    </Link>
  );
}
