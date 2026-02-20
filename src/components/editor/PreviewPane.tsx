"use client";

import Image from "next/image";
import { Badge } from "@/components/ui";
import { BuildingIndicator } from "./BuildingIndicator";
import { ReadyIndicator } from "./ReadyIndicator";

type BuildStatus = "idle" | "building" | "live" | "failed";

const DEVICE_WIDTH = 280;
const DEVICE_HEIGHT = 568;

/** Screen inset when using image frame (match your mockup; % of frame size) */
const SCREEN_INSET = { top: 7.5, right: 5, bottom: 7.5, left: 5 };

export function PreviewPane({
  buildStatus,
}: {
  buildStatus: BuildStatus;
  onRunOnDevice?: () => void;
  onPublish?: () => void;
}) {
  const useImageFrame = false; // Set true when /iphone-frame.png is added

  return (
    <div
      className="flex h-full flex-col items-center justify-center p-8 sm:p-10"
      style={{
        background:
          "radial-gradient(ellipse 90% 80% at 50% 45%, rgba(var(--accent-rgb), 0.06) 0%, transparent 55%), radial-gradient(ellipse 80% 70% at 50% 50%, var(--background-secondary) 0%, transparent 70%), var(--background-primary)",
      }}
    >
      <div className="flex flex-col items-center">
        {useImageFrame ? (
          <RealisticImageFrame
            buildStatus={buildStatus}
            screenInset={SCREEN_INSET}
          />
        ) : (
          <CSSDeviceFrame buildStatus={buildStatus} />
        )}
        {/* Status below the device — no overlap */}
        <div className="mt-5 flex justify-center">
          {buildStatus === "building" && (
            <BuildingIndicator className="animate-fade-in" />
          )}
          {buildStatus === "live" && (
            <ReadyIndicator label="LIVE" className="animate-fade-in" />
          )}
          {buildStatus === "failed" && (
            <Badge variant="error" className="animate-fade-in shadow-lg">
              Build failed
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

function CSSDeviceFrame({ buildStatus }: { buildStatus: BuildStatus }) {
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
            <div className="h-9 w-9 animate-spin rounded-full border-2 border-[var(--badge-building)] border-t-transparent" />
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
            <p className="text-body-muted text-center text-sm leading-relaxed">
              Build failed. Try again or adjust your request.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RealisticImageFrame({
  buildStatus,
  screenInset,
}: {
  buildStatus: BuildStatus;
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
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--badge-building)] border-t-transparent" />
          )}
          {buildStatus === "live" && (
            <p className="text-body-muted text-center text-xs">Streaming…</p>
          )}
          {buildStatus === "failed" && (
            <p className="text-body-muted text-center text-xs">Build failed</p>
          )}
        </div>
      </div>
    </div>
  );
}
