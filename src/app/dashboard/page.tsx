import { DashboardMapPage } from "@/components/dashboard";
import { activeRound } from "@/lib/demo-data";

export default function DashboardPage() {
  return <DashboardMapPage roundId={activeRound.id} />;
}
