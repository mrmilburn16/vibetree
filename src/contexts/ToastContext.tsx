"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Toast, type ToastVariant } from "@/components/ui/Toast";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "info", duration = 5000) => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, variant, duration }]);
    },
    []
  );

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-md flex-col gap-2 pointer-events-none">
        {toasts.map((t, i) => (
          <div
            key={t.id}
            className="pointer-events-auto animate-fade-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <Toast
              message={t.message}
              variant={t.variant}
              duration={t.duration}
              onClose={() => removeToast(t.id)}
              standalone={false}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
