import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getWallet, listTransactions } from "@/lib/simulatorWalletFirestore";

/**
 * GET /api/simulator-wallet
 * Returns balance (in cents), planId, and recent transactions. Requires auth.
 */
export async function GET(request: Request) {
  const user = await getSession(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [wallet, transactions] = await Promise.all([
      getWallet(user.uid),
      listTransactions(user.uid),
    ]);
    return NextResponse.json({
      balanceCents: wallet.balanceCents,
      planId: wallet.planId ?? "free",
      transactions: transactions.map((t) => ({
        date: t.date,
        type: t.type,
        amountCents: t.amountCents,
        balanceAfterCents: t.balanceAfterCents,
      })),
    });
  } catch (e) {
    console.error("[simulator-wallet] GET failed:", e);
    return NextResponse.json({ error: "Failed to load wallet" }, { status: 500 });
  }
}
