"use client";

import { useState, useEffect } from "react";
import { Modal, QRCode } from "@/components/ui";

export function RunOnDeviceModal({
  isOpen,
  onClose,
  projectId,
  expoUrl: expoUrlProp,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  expoUrl?: string | null;
}) {
  const [expoUrlLocal, setExpoUrlLocal] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const expoUrl = expoUrlProp ?? expoUrlLocal;

  useEffect(() => {
    if (!isOpen || !projectId || expoUrlProp != null) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/run-on-device`)
      .then((res) => res.json())
      .then((data) => { if (data.expoUrl) setExpoUrlLocal(data.expoUrl); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, projectId, expoUrlProp]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Preview on your iPhone">
      <div className="space-y-4">
        <p className="text-body-muted text-sm">
          Scan the QR code with your iPhone camera or from inside the Expo Go app. Your app will load with no install step—no Apple Developer account needed.
        </p>
        {loading ? (
          <div className="flex h-[200px] items-center justify-center rounded border border-[var(--border-default)] bg-[var(--background-secondary)]">
            <span className="text-sm text-[var(--text-tertiary)]">Loading…</span>
          </div>
        ) : expoUrl ? (
          <div className="flex flex-col items-start gap-2">
            <QRCode value={expoUrl} size={200} className="rounded border border-[var(--border-default)] bg-white p-2" />
            <p className="text-caption text-xs text-[var(--text-tertiary)]">Open the Expo Go app, then scan this QR code.</p>
            <p className="text-caption text-xs text-[var(--text-tertiary)]">Or use the QR code in the preview pane to the right.</p>
          </div>
        ) : (
          <p className="text-caption text-xs text-[var(--text-tertiary)]">Build your app first, then the QR code will appear here.</p>
        )}
      </div>
    </Modal>
  );
}
