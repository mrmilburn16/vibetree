"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  getCreditState,
  deduct as storeDeduct,
  add as storeAdd,
  setBalance as storeSetBalance,
  LOW_CREDIT_THRESHOLD,
  type CreditState,
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
  const [state, setState] = useState<CreditState | null>(null);

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;
    setState(getCreditState());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deduct = useCallback(
    (amount: number): boolean => {
      const ok = storeDeduct(amount);
      if (ok) refresh();
      return ok;
    },
    [refresh]
  );

  const add = useCallback(
    (amount: number) => {
      storeAdd(amount);
      refresh();
    },
    [refresh]
  );

  const setBalance = useCallback(
    (amount: number) => {
      storeSetBalance(amount);
      refresh();
    },
    [refresh]
  );

  const value: CreditsContextValue =
    state === null
      ? {
          balance: 0,
          isLow: true,
          hasCreditsForMessage: false,
          deduct: () => false,
          add,
          setBalance,
          refresh,
        }
      : {
          balance: state.balance,
          isLow: state.balance < LOW_CREDIT_THRESHOLD,
          hasCreditsForMessage: state.balance >= 1,
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
