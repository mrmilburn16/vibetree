import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

type Range = "7d" | "30d" | "90d" | "this_month" | "last_month";

function getDateRange(range: Range): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case "7d":
      start.setDate(start.getDate() - 7);
      break;
    case "30d":
      start.setDate(start.getDate() - 30);
      break;
    case "90d":
      start.setDate(start.getDate() - 90);
      break;
    case "this_month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;
    case "last_month":
      start.setMonth(start.getMonth() - 1);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    default:
      start.setDate(start.getDate() - 30);
  }
  return { start, end };
}

function generateTimeSeries(days: number, base: number, variance: number) {
  return Array.from({ length: days }, (_, i) => ({
    date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10),
    value: Math.round(base + (Math.random() - 0.5) * variance),
  }));
}

export async function GET(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const range = (searchParams.get("range") as Range) || "30d";
  const { start, end } = getDateRange(range);
  const days = Math.max(7, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));

  // Mock data: revenue, cost by model, credits, growth, fraud, alerts
  const mrr = 12400;
  const oneTime = 800;
  const totalRevenue = mrr + oneTime;
  const costByModel = {
    "Claude Opus 4.6": 1820,
    "Claude Sonnet 4.6": 2480,
    "GPT-5.2": 1560,
  };
  const totalCost = Object.values(costByModel).reduce((a, b) => a + b, 0);
  const grossProfit = totalRevenue - totalCost;
  const grossMarginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  const revenueByDay = generateTimeSeries(days, 400, 120);
  const costByDay = generateTimeSeries(days, 180, 60);
  const creditsConsumed = 42800;
  const creditsGranted = 52000;
  const usageRatePct = creditsGranted > 0 ? (creditsConsumed / creditsGranted) * 100 : 0;

  const creditsByModel = {
    "Claude Opus 4.6": 4200,
    "Claude Sonnet 4.6": 26800,
    "GPT-5.2": 11800,
  };

  const activeSubscriptions = 142;
  const upcomingRenewals = 18;
  const trialsEnding = 5;
  const failedPayments = 2;
  const newSubs = 12;
  const churnedSubs = 4;

  const conversionVisitorSignup = 3.2;
  const conversionSignupPaid = 18.5;
  const cac = 42;
  const ltv = 186;
  const ltvCac = ltv / cac;
  const churnRatePct = 2.8;

  const suspiciousCount = 3;
  const flaggedUsers = [
    { id: "u_1", ip: "192.168.1.1", reason: "High velocity (12 msg/min)", score: 78 },
    { id: "u_2", ip: "10.0.0.5", reason: "Same IP, 4 accounts", score: 65 },
    { id: "u_3", ip: "172.16.0.2", reason: "Credit burn 3× avg", score: 58 },
  ];

  const projectedCostMonth = totalCost * (30 / days);
  const projectedRevenueMonth = mrr;
  const marginByModel = {
    "Claude Opus 4.6": 12,
    "Claude Sonnet 4.6": 8,
    "GPT-5.2": 15,
  };

  const alerts = [
    { id: "1", type: "warning", title: "Sonnet margin < 10%", message: "Consider raising credit cost for Sonnet 4.6 or reviewing prompts." },
    { id: "2", type: "info", title: "3 flagged users (24h)", message: "Review Fraud & suspicious usage section." },
    { id: "3", type: "success", title: "MRR up 12% vs last period", message: "Revenue trend is positive." },
  ];

  const prevPeriod = {
    revenue: totalRevenue * 0.88,
    cost: totalCost * 1.05,
    marginPct: grossMarginPct - 2,
    churnPct: churnRatePct + 0.5,
  };

  return NextResponse.json({
    range,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    revenue: {
      mrr,
      oneTime,
      total: totalRevenue,
      byDay: revenueByDay,
    },
    cost: {
      total: totalCost,
      byModel: costByModel,
      byDay: costByDay,
      projectedMonth: projectedCostMonth,
    },
    profit: {
      gross: grossProfit,
      marginPct: grossMarginPct,
      byModel: marginByModel,
    },
    credits: {
      consumed: creditsConsumed,
      granted: creditsGranted,
      usageRatePct,
      byModel: creditsByModel,
    },
    subscriptions: {
      active: activeSubscriptions,
      upcomingRenewals,
      trialsEnding,
      failedPayments,
      newSubs,
      churnedSubs,
    },
    growth: {
      conversionVisitorSignup,
      conversionSignupPaid,
      cac,
      ltv,
      ltvCac,
      churnRatePct,
    },
    fraud: {
      suspiciousCount,
      flaggedUsers,
    },
    forecasting: {
      projectedCostMonth,
      projectedRevenueMonth,
      projectedMarginPct: projectedRevenueMonth > 0 ? ((projectedRevenueMonth - projectedCostMonth) / projectedRevenueMonth) * 100 : 0,
    },
    alerts,
    prevPeriod,
  });
}
