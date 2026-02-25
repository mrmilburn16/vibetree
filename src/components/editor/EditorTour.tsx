"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui";

const TOUR_STORAGE_KEY = "vibetree-editor-tour-seen";

export function EditorTour({
  onDismiss,
}: {
  onDismiss?: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!seen) setShow(true);
  }, []);

  function handleDismiss() {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOUR_STORAGE_KEY, "1");
    }
    setShow(false);
    onDismiss?.();
  }

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-labelledby="tour-title"
      aria-modal="true"
    >
      <div className="mx-4 max-w-md rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--background-primary)] p-6 shadow-xl">
        <h2 id="tour-title" className="text-heading-section mb-2">
          Welcome to the editor
        </h2>
        <p className="text-body-muted mb-4 text-sm">
          Describe your app in plain language. The AI will generate Swift code, and you can preview it live. Use the chat panel to iterate—add features, fix bugs, or change the design.
        </p>
        <ul className="text-body-muted mb-6 list-inside list-disc space-y-1 text-sm">
          <li>Type a prompt (e.g. &quot;A todo list with due dates&quot;)</li>
          <li>Preview updates as the AI generates code</li>
          <li>Run on device or export when ready</li>
        </ul>
        <Button variant="primary" onClick={handleDismiss} className="w-full">
          Get started
        </Button>
      </div>
    </div>
  );
}
