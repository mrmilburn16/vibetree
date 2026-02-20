"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Input } from "@/components/ui";

type PublishStep = "form" | "archiving" | "uploading" | "processing" | "done" | "error";

type CommunityAverage = { averageDays: number; sampleSize: number } | null;

export function PublishModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState<PublishStep>("form");
  const [appName, setAppName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [whatsNew, setWhatsNew] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [communityAverage, setCommunityAverage] = useState<CommunityAverage>(null);

  useEffect(() => {
    if (!isOpen || !signedIn) return;
    fetch("/api/publish/community-average")
      .then((res) => res.json())
      .then((data) => setCommunityAverage({ averageDays: data.averageDays ?? 2, sampleSize: data.sampleSize ?? 0 }))
      .catch(() => setCommunityAverage({ averageDays: 2, sampleSize: 0 }));
  }, [isOpen, signedIn]);

  async function handleSignIn() {
    setSignedIn(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setStep("archiving");
    await new Promise((r) => setTimeout(r, 800));
    setStep("uploading");
    await new Promise((r) => setTimeout(r, 1000));
    setStep("processing");
    await new Promise((r) => setTimeout(r, 600));
    setStep("done");
  }

  function handleRetry() {
    setStep("form");
    setErrorMessage("");
  }

  function handleClose() {
    setStep("form");
    setErrorMessage("");
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Publish to App Store">
      {!signedIn ? (
        <div className="space-y-4">
          <p className="text-body-muted text-sm">
            Sign in with your Apple Developer account to upload builds and submit to the App Store or TestFlight. You only need to sign in once—every submission after that is a single click.
          </p>
          <Button variant="primary" className="w-full" onClick={handleSignIn}>
            Sign in with Apple Developer
          </Button>
        </div>
      ) : (
        <>
          {step === "form" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="publish-app-name" className="text-body-muted mb-1.5 block text-sm">
                  App name
                </label>
                <Input
                  id="publish-app-name"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="My App"
                />
              </div>
              <div>
                <label htmlFor="publish-version" className="text-body-muted mb-1.5 block text-sm">
                  Version
                </label>
                <Input
                  id="publish-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                />
              </div>
              <div>
                <label htmlFor="publish-whats-new" className="text-body-muted mb-1.5 block text-sm">
                  What&apos;s new (optional)
                </label>
                <Input
                  id="publish-whats-new"
                  value={whatsNew}
                  onChange={(e) => setWhatsNew(e.target.value)}
                  placeholder="Initial release"
                />
              </div>
              {errorMessage && (
                <p className="text-sm text-[var(--semantic-error)]">{errorMessage}</p>
              )}
              {communityAverage && (
                <p className="text-body-muted text-sm">
                  {communityAverage.sampleSize > 0 ? (
                    <>Our users&apos; apps typically go live within <strong>{communityAverage.averageDays} {communityAverage.averageDays === 1 ? "day" : "days"}</strong> of submitting.</>
                  ) : (
                    <>Apple review usually takes 24–48 hours.</>
                  )}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Submit
                </Button>
              </div>
            </form>
          )}

          {(step === "archiving" || step === "uploading" || step === "processing") && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <StepItem label="Archiving" active={step === "archiving"} done={step !== "archiving"} />
                <StepItem label="Uploading" active={step === "uploading"} done={step === "processing"} />
                <StepItem label="Processing" active={step === "processing"} done={false} />
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-[var(--semantic-success)]">Build uploaded successfully.</p>
              {communityAverage && (
                <p className="text-body-muted text-sm">
                  Your app is in review. {communityAverage.sampleSize > 0 ? (
                    <>Vibetree users typically see their app live within <strong>{communityAverage.averageDays} {communityAverage.averageDays === 1 ? "day" : "days"}</strong>.</>
                  ) : (
                    <>Apple review usually takes 24–48 hours.</>
                  )}
                </p>
              )}
              <a
                href="https://appstoreconnect.apple.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--link-default)] hover:text-[var(--link-hover)]"
              >
                View in App Store Connect
              </a>
              <div className="flex justify-end">
                <Button variant="primary" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </div>
          )}

          {step === "error" && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-[var(--semantic-error)]">
                {errorMessage || "Upload failed. Check your Apple Developer account and try again."}
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={handleClose}>
                  Close
                </Button>
                <Button variant="primary" onClick={handleRetry}>
                  Retry
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function StepItem({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <span className="text-[var(--semantic-success)]">✓</span>
      ) : active ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--button-primary-bg)] border-t-transparent" />
      ) : (
        <span className="h-4 w-4 rounded-full border-2 border-[var(--border-default)]" />
      )}
      <span className={done ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}>
        {label}
      </span>
    </div>
  );
}
