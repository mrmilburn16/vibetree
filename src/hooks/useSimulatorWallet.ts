"use client";

import { useCallback, useEffect, useState } from "react";

export type PlanId = "free" | "starter" | "builder" | "pro";

export interface SimulatorWalletState {
  balanceCents: number;
  planId: PlanId;
  transactions: Array<{
    date: number;
    type: "topup" | "deduction";
    amountCents: number;
    balanceAfterCents: number;
  }>;
  loading: boolean;
  error: string | null;
}

export function useSimulatorWallet() {
  const [state, setState] = useState<SimulatorWalletState>({
    balanceCents: 0,
    planId: "free",
    transactions: [],
    loading: true,
    error: null,
  });

  const refresh = useCallback(async (): Promise<{
    balanceCents: number;
    planId: PlanId;
    transactions: SimulatorWalletState["transactions"];
  }> => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const fallback = { balanceCents: 0, planId: "free" as PlanId, transactions: [] };
    try {
      const res = await fetch("/api/simulator-wallet", { credentials: "include" });
      if (res.status === 401) {
        setState({
          ...fallback,
          loading: false,
          error: null,
        });
        return fallback;
      }
      if (!res.ok) {
        setState((s) => ({
          ...s,
          loading: false,
          error: "Failed to load wallet",
        }));
        return fallback;
      }
      const data = await res.json();
      const next = {
        balanceCents: data.balanceCents ?? 0,
        planId: (data.planId ?? "free") as PlanId,
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
      };
      setState({
        ...next,
        loading: false,
        error: null,
      });
      return next;
    } catch {
      setState((s) => ({
        ...s,
        loading: false,
        error: "Network error",
      }));
      return fallback;
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const canUseSimulator = state.planId !== "free";

  return { ...state, refresh, canUseSimulator };
}
