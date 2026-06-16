import { notFound } from "next/navigation";
import { DashboardDimensionPage } from "@/components/dashboard-mock";
import { getDimensionById, getDimensionStaticParams } from "@/lib/demo-data";

export const dynamicParams = false;

export function generateStaticParams() {
  return getDimensionStaticParams();
}

export default async function DimensionPage({
  params,
}: {
  params: Promise<{ dimension: string }>;
}) {
  const { dimension } = await params;
  const entry = getDimensionById(dimension);

  if (!entry) {
    notFound();
  }

  return <DashboardDimensionPage dimension={entry} />;
}
