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

function getSessionEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("vibetree-session");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.email ?? null;
  } catch {
    return null;
  }
}

export function CreditsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<CreditState | null>(null);

  const refresh = useCallback(() => {
    if (typeof window === "undefined") return;

    // Always hydrate from localStorage first for instant UI
    setState(getCreditState());

    // Then sync from server if a session exists
    const email = getSessionEmail();
    if (email) {
      fetch("/api/credits", {
        headers: { "x-user-email": email },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && typeof data.balance === "number") {
            const serverState: CreditState = {
              balance: data.balance,
              includedPerPeriod: data.monthlyAllowance ?? 50,
              periodStart:
                data.resetDate ?? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
            };
            storeSetBalance(serverState.balance);
            setState(serverState);
          }
        })
        .catch(() => {
          // Server unavailable — localStorage value stands
        });
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deduct = useCallback(
    (amount: number): boolean => {
      const ok = storeDeduct(amount);
      if (ok) {
        setState(getCreditState());
        // Fire-and-forget server deduction
        const email = getSessionEmail();
        if (email) {
          fetch("/api/credits", {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-user-email": email },
            body: JSON.stringify({ action: "deduct", amount }),
          }).catch(() => {});
        }
      }
      return ok;
    },
    []
  );

  const add = useCallback(
    (amount: number) => {
      storeAdd(amount);
      setState(getCreditState());
      const email = getSessionEmail();
      if (email) {
        fetch("/api/credits", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-user-email": email },
          body: JSON.stringify({ action: "add", amount }),
        }).catch(() => {});
      }
    },
    []
  );

  const setBalance = useCallback(
    (amount: number) => {
      storeSetBalance(amount);
      setState(getCreditState());
    },
    []
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
