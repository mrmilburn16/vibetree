"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getCreditState,
  deduct as storeDeduct,
  add as storeAdd,
  setBalance as storeSetBalance,
  LOW_CREDIT_THRESHOLD,
} from "@/lib/credits";

interface CreditsContextValue {
  balance: number;
  isLow: boolean;
  hasCreditsForMessage: boolean;
  deduct: (amount: number) => boolean;
  add: (amount: number) => void;
  setBalance: (amount: number) => void;
  refresh: () => void;
}

const CreditsContext = createContext<CreditsContextValue | null>(null);

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [balance, setBalanceState] = useState<number | null>(null);
  const [serverMode, setServerMode] = useState<boolean | null>(null);

  const fetchServerBalance = useCallback(async (): Promise<number | null> => {
    try {
      const res = await fetch("/api/credits", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const b = typeof data.balance === "number" ? data.balance : 0;
        setBalanceState(b);
        setServerMode(true);
        return b;
      }
    } catch {
      // ignore
    }
    return null;
  }, []);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined") return;
    const serverBalance = await fetchServerBalance();
    if (serverBalance === null) {
      setServerMode(false);
      const state = getCreditState();
      setBalanceState(state.balance);
    }
  }, [fetchServerBalance]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deduct = useCallback(
    (amount: number): boolean => {
      if (serverMode === true) {
        setBalanceState((prev) => Math.max(0, (prev ?? 0) - amount));
        fetch("/api/credits/deduct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ amount }),
        })
          .then((res) => {
            if (res.status === 402) return refresh();
            if (res.ok) return res.json().then((data: { balance?: number }) => setBalanceState(typeof data.balance === "number" ? data.balance : 0));
            return refresh();
          })
          .catch(() => refresh());
        return true;
      }
      if (serverMode === false) {
        const ok = storeDeduct(amount);
        if (ok) setBalanceState(getCreditState().balance);
        return ok;
      }
      return false;
    },
    [serverMode, refresh]
  );

  const add = useCallback(
    (amount: number) => {
      if (serverMode === false) {
        storeAdd(amount);
        setBalanceState(getCreditState().balance);
      } else if (serverMode === true) {
        refresh();
      }
    },
    [serverMode, refresh]
  );

  const setBalance = useCallback(
    (amount: number) => {
      if (serverMode === false) {
        storeSetBalance(amount);
        setBalanceState(getCreditState().balance);
      } else if (serverMode === true) {
        refresh();
      }
    },
    [serverMode, refresh]
  );

  const currentBalance = balance ?? 0;
  const value: CreditsContextValue = {
    balance: currentBalance,
    isLow: currentBalance < LOW_CREDIT_THRESHOLD,
    hasCreditsForMessage: currentBalance >= 1,
    deduct,
    add,
    setBalance,
    refresh,
  };

  return <CreditsContext.Provider value={value}>{children}</CreditsContext.Provider>;
}

export function useCredits(): CreditsContextValue {
  const ctx = useContext(CreditsContext);
  if (!ctx) {
    return {
      balance: 0,
      isLow: true,
      hasCreditsForMessage: false,
      deduct: () => false,
      add: () => {},
      setBalance: () => {},
      refresh: () => {},
    };
  }
  return ctx;
}
