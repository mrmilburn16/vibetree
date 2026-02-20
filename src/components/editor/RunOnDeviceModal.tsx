"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Input, QRCode, Textarea } from "@/components/ui";

export function RunOnDeviceModal({
  isOpen,
  onClose,
  projectId,
}: {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
}) {
  const [expoUrl, setExpoUrl] = useState<string | null>(null);
  const [testFlightLink, setTestFlightLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [testFlightLoading, setTestFlightLoading] = useState(false);
  const [inviteEmails, setInviteEmails] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch Expo + TestFlight URLs when modal opens (mock returns both)
  useEffect(() => {
    if (!isOpen || !projectId) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/run-on-device`)
      .then((res) => res.json())
      .then((data) => {
        if (data.expoUrl) setExpoUrl(data.expoUrl);
        if (data.testFlightLink) setTestFlightLink(data.testFlightLink);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, projectId]);

  async function handleGetTestFlightLink() {
    if (!projectId) return;
    setTestFlightLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/run-on-device`);
      const data = await res.json();
      if (data.testFlightLink) setTestFlightLink(data.testFlightLink);
    } finally {
      setTestFlightLoading(false);
    }
  }

  async function handleInviteTesters(e: React.FormEvent) {
    e.preventDefault();
    const emails = inviteEmails
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (emails.length === 0) {
      setInviteMessage({ type: "error", text: "Enter at least one email address." });
      return;
    }
    setInviteLoading(true);
    setInviteMessage(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/invite-testers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails }),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteMessage({ type: "error", text: data.error ?? "Failed to send invites." });
        return;
      }
      setInviteMessage({ type: "success", text: data.message ?? `Invitations sent to ${emails.length} tester(s).` });
      setInviteEmails("");
    } catch {
      setInviteMessage({ type: "error", text: "Failed to send invites." });
    } finally {
      setInviteLoading(false);
    }
  }

  function handleCopyTestFlightLink() {
    if (!testFlightLink) return;
    navigator.clipboard.writeText(testFlightLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Run on your iPhone">
      <div className="space-y-6">
        {/* Primary: Open in Expo Go */}
        <section className="space-y-3">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Open in Expo Go</h3>
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
            </div>
          ) : (
            <p className="text-caption text-xs text-[var(--text-tertiary)]">Build your app first, then the QR code will appear here.</p>
          )}
        </section>

        {/* Second: TestFlight link (full native install) */}
        <section className="space-y-3 border-t border-[var(--border-default)] pt-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Get TestFlight link</h3>
          <p className="text-body-muted text-sm">
            We&apos;ll build your app and give you a link to install it via TestFlight on your iPhone—no Mac required.
          </p>
          {testFlightLink ? (
            <div className="flex flex-col gap-2">
              <QRCode value={testFlightLink} size={160} className="rounded border border-[var(--border-default)] bg-white p-2" />
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" type="button" onClick={handleCopyTestFlightLink}>
                  {copied ? "Copied!" : "Copy TestFlight link"}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="primary" type="button" onClick={handleGetTestFlightLink} disabled={testFlightLoading}>
              {testFlightLoading ? "Getting link…" : "Get TestFlight link"}
            </Button>
          )}
        </section>

        {/* Invite testers */}
        <section className="space-y-3 border-t border-[var(--border-default)] pt-4">
          <h3 className="text-sm font-medium text-[var(--text-primary)]">Invite testers</h3>
          <p className="text-body-muted text-sm">
            Enter email addresses and we&apos;ll send them a TestFlight invite. Separate multiple emails with commas or new lines.
          </p>
          <form onSubmit={handleInviteTesters} className="space-y-2">
            <Textarea
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="john@example.com, jane@example.com"
              rows={3}
              className="text-sm"
            />
            {inviteMessage && (
              <p className={`text-sm ${inviteMessage.type === "success" ? "text-[var(--semantic-success)]" : "text-[var(--semantic-error)]"}`}>
                {inviteMessage.text}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={inviteLoading}>
              {inviteLoading ? "Sending…" : "Send invites"}
            </Button>
          </form>
        </section>

        {/* Desktop agent */}
        <section className="border-t border-[var(--border-default)] pt-4">
          <p className="text-body-muted text-sm">
            Have a Mac? Plug in your iPhone and use our desktop agent to install the app directly.
          </p>
          <Button variant="secondary" type="button" className="mt-2">
            Download desktop agent for Mac
          </Button>
        </section>
      </div>
    </Modal>
  );
}
