"use client";

import Image from "next/image";
import { Maximize2 } from "lucide-react";
import { QRCode } from "@/components/ui";
import { ReadyIndicator } from "./ReadyIndicator";
import { FailedIndicator } from "./FailedIndicator";

type BuildStatus = "idle" | "building" | "live" | "failed";

const DEVICE_WIDTH = 280;
const DEVICE_HEIGHT = 568;

/** Screen inset when using image frame (match your mockup; % of frame size) */
const SCREEN_INSET = { top: 7.5, right: 5, bottom: 7.5, left: 5 };

const PROJECT_TYPE_STORAGE_KEY = "vibetree-project-type";

export function PreviewPane({
  buildStatus,
  buildFailureReason = null,
  expoUrl = null,
  onOpenRunOnDevice,
}: {
  buildStatus: BuildStatus;
  buildFailureReason?: string | null;
  expoUrl?: string | null;
  onOpenRunOnDevice?: () => void;
  onRunOnDevice?: () => void;
  onPublish?: () => void;
}) {
  const useImageFrame = false; // Set true when /iphone-frame.png is added
  const isPro =
    typeof window !== "undefined" && localStorage.getItem(PROJECT_TYPE_STORAGE_KEY) === "pro";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-8 py-8 sm:px-10 sm:py-10 md:flex-row md:items-center md:gap-0"
      style={{ background: "var(--editor-pane-gradient)" }}
    >
      {/* Left half: device stays centered in pane by sitting at the end of this flex-1 */}
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center md:flex-row md:justify-end">
        <div className="flex flex-col items-center">
          {useImageFrame ? (
            <RealisticImageFrame
              buildStatus={buildStatus}
              buildFailureReason={buildFailureReason}
              screenInset={SCREEN_INSET}
            />
          ) : (
            <CSSDeviceFrame buildStatus={buildStatus} buildFailureReason={buildFailureReason} />
          )}
          <div className="mt-5 flex justify-center">
            {buildStatus === "live" && (
              <ReadyIndicator label="LIVE" className="animate-ready-pop" />
            )}
            {buildStatus === "failed" && (
              <FailedIndicator className="animate-fade-in" reason={buildFailureReason} />
            )}
          </div>
        </div>
      </div>

      {/* Right half: QR (Standard) or Download (Pro) */}
      <div className="mt-6 flex min-w-0 flex-1 flex-col items-center justify-center md:mt-0">
        <div className="relative w-full max-w-[240px] rounded-lg border border-[var(--border-default)] bg-[var(--background-secondary)] p-3">
          {isPro ? (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-body-muted text-xs">
                {buildStatus === "live"
                  ? "Pro (Swift): Download your app and open in Xcode to run on your iPhone or simulator."
                  : "Build your app in the chat to generate Swift, then download the source."}
              </p>
              {buildStatus === "live" && onOpenRunOnDevice && (
                <button
                  type="button"
                  onClick={onOpenRunOnDevice}
                  className="text-xs font-medium text-[var(--link-default)] hover:underline"
                >
                  Run on device (download source)
                </button>
              )}
            </div>
          ) : expoUrl ? (
            <>
              {onOpenRunOnDevice && (
                <button
                  type="button"
                  onClick={onOpenRunOnDevice}
                  aria-label="Show larger QR"
                  title="Show larger QR"
                  className="absolute right-2 top-2 rounded p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                </button>
              )}
              <div className="flex flex-col items-center gap-2">
                <QRCode
                  value={expoUrl}
                  size={130}
                  className="shrink-0 rounded border border-[var(--border-default)] bg-white p-1.5"
                />
                <p className="text-body-muted text-center text-xs leading-snug">
                  Scan this QR in Expo Go to preview on your iPhone
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-body-muted text-xs">
                {buildStatus === "live"
                  ? "Click Run on device above to start the preview server and show the QR code."
                  : "Build your app to see the preview QR"}
              </p>
              {buildStatus === "live" && onOpenRunOnDevice && (
                <button
                  type="button"
                  onClick={onOpenRunOnDevice}
                  className="text-xs font-medium text-[var(--link-default)] hover:underline"
                >
                  Run on device
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CSSDeviceFrame({
  buildStatus,
  buildFailureReason,
}: {
  buildStatus: BuildStatus;
  buildFailureReason?: string | null;
}) {
  return (
    <div
      className="relative animate-fade-in rounded-[2.75rem] p-[10px]"
      style={{
        width: DEVICE_WIDTH + 20,
        height: DEVICE_HEIGHT + 20,
        background: `linear-gradient(165deg, var(--border-subtle) 0%, var(--border-default) 35%, var(--background-secondary) 100%)`,
        boxShadow:
          "0 25px 50px -12px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[2.25rem] bg-[var(--background-tertiary)]"
        style={{ boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.25)" }}
      >
        <div
          className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-full bg-black"
          style={{
            width: 100,
            height: 28,
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        />
        <div className="flex h-full w-full flex-col items-center justify-center px-5 pt-12 pb-8">
          {buildStatus === "idle" && (
            <div className="flex flex-col items-center gap-2 text-center">
              <p className="text-sm font-medium text-[var(--text-secondary)]">
                Your preview lives here
              </p>
              <p className="text-body-muted max-w-[200px] text-xs leading-relaxed">
                Describe your app in the chat, then watch it appear in this frame.
              </p>
            </div>
          )}
          {buildStatus === "building" && (
            <div className="h-9 w-9 animate-spin-preview rounded-full border-2 border-[var(--spinner-preview)] border-t-transparent" />
          )}
          {buildStatus === "live" && (
            <>
              <div
                className="absolute inset-0 pointer-events-none animate-screen-shine rounded-[2.25rem] bg-white/[0.03]"
                aria-hidden
              />
              <p className="text-body-muted relative text-center text-sm max-w-[200px] leading-relaxed">
                Simulator stream will appear here when connected.
              </p>
            </>
          )}
          {buildStatus === "failed" && (
            <p className="text-body-muted text-center text-sm leading-relaxed max-w-[220px]">
              {buildFailureReason && buildFailureReason.trim()
                ? buildFailureReason.trim()
                : "Build failed. Try again or adjust your request."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RealisticImageFrame({
  buildStatus,
  buildFailureReason,
  screenInset,
}: {
  buildStatus: BuildStatus;
  buildFailureReason?: string | null;
  screenInset: { top: number; right: number; bottom: number; left: number };
}) {
  const w = DEVICE_WIDTH + 24;
  const h = DEVICE_HEIGHT + 24;
  const screenStyle = {
    position: "absolute" as const,
    top: `${screenInset.top}%`,
    left: `${screenInset.left}%`,
    right: `${screenInset.right}%`,
    bottom: `${screenInset.bottom}%`,
    borderRadius: "2rem",
    overflow: "hidden" as const,
    background: "var(--background-tertiary)",
  };

  return (
    <div className="relative animate-fade-in" style={{ width: w, height: h }}>
      <Image
        src="/iphone-frame.png"
        alt="iPhone"
        width={w}
        height={h}
        className="object-contain"
        priority
      />
      <div style={screenStyle}>
        <div className="flex h-full w-full flex-col items-center justify-center p-4">
          {buildStatus === "idle" && (
            <p className="text-body-muted text-center text-xs leading-relaxed">
              App preview will appear here.
            </p>
          )}
          {buildStatus === "building" && (
            <div className="h-8 w-8 animate-spin-preview rounded-full border-2 border-[var(--spinner-preview)] border-t-transparent" />
          )}
          {buildStatus === "live" && (
            <p className="text-body-muted text-center text-xs">Streaming…</p>
          )}
          {buildStatus === "failed" && (
            <p className="text-body-muted text-center text-xs max-w-[180px]">
              {buildFailureReason && buildFailureReason.trim()
                ? buildFailureReason.trim()
                : "Build failed"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
