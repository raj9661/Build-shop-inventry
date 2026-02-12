import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const data = await prisma.businessMetric.findMany({
    where: { period: "daily" },
    orderBy: { recordedAt: "asc" },
    take: 30,
  });

  const formatted: Record<string, any> = data.reduce((acc: Record<string, any>, item) => {
    const date = item.recordedAt.toISOString().split("T")[0];
    if (!acc[date]) acc[date] = { date };
    (acc[date] as any)[item.metricName] = Number(item.value as any);
    return acc;
  }, {} as Record<string, any>);

  return NextResponse.json(Object.values(formatted));
}


