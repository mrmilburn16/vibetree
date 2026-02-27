"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Maximize2, ChevronLeft, ChevronRight } from "lucide-react";
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
  projectId = null,
}: {
  buildStatus: BuildStatus;
  buildFailureReason?: string | null;
  expoUrl?: string | null;
  onOpenRunOnDevice?: () => void;
  onRunOnDevice?: () => void;
  onPublish?: () => void;
  projectId?: string | null;
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
            <CSSDeviceFrame
              buildStatus={buildStatus}
              buildFailureReason={buildFailureReason}
              isPro={isPro}
              projectId={projectId}
            />
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
                  ? "Pro (Swift): Simulator stream appears above when a Mac runner is connected; or download and run in Xcode."
                  : "Build your app in the chat to generate Swift, then download the source."}
              </p>
              {buildStatus === "live" && onOpenRunOnDevice && (
                <button
                  type="button"
                  onClick={onOpenRunOnDevice}
                  className="cursor-pointer text-xs font-medium text-[var(--link-default)] hover:underline"
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
                  className="absolute right-2 top-2 cursor-pointer rounded p-1.5 text-[var(--text-tertiary)] transition-colors hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
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
                  className="cursor-pointer text-xs font-medium text-[var(--link-default)] hover:underline"
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

const SIMULATOR_POLL_MS = 250;
const SIMULATOR_POLL_BACKOFF_START_MS = 750;
const SIMULATOR_POLL_BACKOFF_MAX_MS = 5000;

function CSSDeviceFrame({
  buildStatus,
  buildFailureReason,
  isPro = false,
  projectId = null,
}: {
  buildStatus: BuildStatus;
  buildFailureReason?: string | null;
  isPro?: boolean;
  projectId?: string | null;
}) {
  const [simulatorPreviewUrl, setSimulatorPreviewUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  /** When we transition to "live", record time so we only show frames newer than this (skip previous build's frame). */
  const liveSinceRef = useRef<number>(0);
  /** Previous frame URL; when a new one arrives, we get before/after for the comparison slider. */
  const prevSimulatorUrlRef = useRef<string | null>(null);

  /** Before/after for comparison slider. Only set when we receive a new screenshot after an edit (second+ frame). */
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  /** Split position 0–100; 50 = half. Dragging left reveals more before, right more after. */
  const [splitPercent, setSplitPercent] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (buildStatus !== "live" || !isPro || !projectId) {
      setSimulatorPreviewUrl(null);
      setBeforeUrl(null);
      setAfterUrl(null);
      prevSimulatorUrlRef.current = null;
      return;
    }
    liveSinceRef.current = Date.now();
    let cancelled = false;
    let inFlight = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let delayMs = SIMULATOR_POLL_BACKOFF_START_MS;

    const scheduleNext = (nextDelay: number) => {
      if (cancelled) return;
      delayMs = Math.max(0, Math.min(SIMULATOR_POLL_BACKOFF_MAX_MS, nextDelay));
      timeoutId = setTimeout(poll, delayMs);
    };

    const poll = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      const updatedAfter = liveSinceRef.current || 0;
      try {
        const res = await fetch(
          `/api/projects/${projectId}/simulator-preview?t=${Date.now()}${updatedAfter ? `&updatedAfter=${updatedAfter}` : ""}`,
          { cache: "no-store" }
        );
        if (cancelled) return;
        // No frame yet: back off to avoid hammering the server (and your laptop).
        if (!res.ok) {
          scheduleNext(Math.min(SIMULATOR_POLL_BACKOFF_MAX_MS, Math.max(delayMs * 1.35, SIMULATOR_POLL_BACKOFF_START_MS)));
          return;
        }
        const blob = await res.blob();
        if (cancelled) return;
        const prevUrl = blobUrlRef.current;
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = URL.createObjectURL(blob);
        const newUrl = blobUrlRef.current;
        setSimulatorPreviewUrl(newUrl);
        // When we get a new frame and we had a previous one, store before/after for comparison.
        if (prevUrl && newUrl !== prevUrl) {
          setBeforeUrl((b) => {
            if (b && b.startsWith("blob:")) URL.revokeObjectURL(b);
            return prevUrl;
          });
          setAfterUrl(newUrl);
          setSplitPercent(50);
        }
        prevSimulatorUrlRef.current = newUrl;
        // Got a frame: return to fast polling for smoother updates.
        scheduleNext(SIMULATOR_POLL_MS);
      } catch {
        scheduleNext(Math.min(SIMULATOR_POLL_BACKOFF_MAX_MS, Math.max(delayMs * 1.35, SIMULATOR_POLL_BACKOFF_START_MS)));
      } finally {
        inFlight = false;
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
      setSimulatorPreviewUrl(null);
      prevSimulatorUrlRef.current = null;
    };
  }, [buildStatus, isPro, projectId]);

  const handleMove = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSplitPercent(pct);
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      handleMove(e.clientX);
    },
    [handleMove]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isDraggingRef.current = true;
      handleMove(e.touches[0].clientX);
    },
    [handleMove]
  );

  useEffect(() => {
    if (!isDraggingRef.current) return;
    const onMove = (e: MouseEvent) => handleMove(e.clientX);
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    };
    const onUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [handleMove]);

  const showComparison = isPro && beforeUrl && afterUrl;
  const showSingle = isPro && simulatorPreviewUrl && !showComparison;

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
      {/* Inner screen: clip all content to device rounded shape (iPhone isn't a perfect rectangle) */}
      <div
        className="relative h-full w-full overflow-hidden rounded-[2.25rem] bg-[var(--background-tertiary)]"
        style={{
          boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.25)",
          clipPath: "inset(0 round 2.25rem)",
        }}
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
              {showComparison ? (
                <div
                  ref={containerRef}
                  className="group absolute inset-0 overflow-hidden rounded-[2.25rem] select-none"
                  style={{ clipPath: "inset(0 round 2.25rem)" }}
                  aria-hidden
                >
                  {/* Before: visible on the left of the divider */}
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
                    }}
                  >
                    <img
                      src={beforeUrl}
                      alt="Before"
                      className="h-full w-full object-cover object-top"
                      draggable={false}
                    />
                  </div>
                  {/* After: visible on the right of the divider */}
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: `inset(0 0 0 ${splitPercent}%)`,
                    }}
                  >
                    <img
                      src={afterUrl}
                      alt="After"
                      className="h-full w-full object-cover object-top"
                      draggable={false}
                    />
                  </div>
                  {/* Labels: fade in on hover */}
                  <span className="pointer-events-none absolute left-3 top-1/2 z-[2] -translate-y-1/2 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    Before
                  </span>
                  <span className="pointer-events-none absolute right-3 top-1/2 z-[2] -translate-y-1/2 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    After
                  </span>
                  {/* Divider line + drag handle */}
                  <div
                    className="absolute top-0 bottom-0 z-[3] w-0 cursor-ew-resize"
                    style={{ left: `${splitPercent}%`, transform: "translateX(-50%)" }}
                    onMouseDown={handleMouseDown}
                    onTouchStart={handleTouchStart}
                    role="slider"
                    aria-label="Before/after comparison"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(splitPercent)}
                  >
                    {/* White vertical line */}
                    <div
                      className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
                      aria-hidden
                    />
                    {/* Circular handle with arrows */}
                    <div
                      className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/70 shadow-md"
                      aria-hidden
                    >
                      <ChevronLeft className="h-4 w-4 text-white" strokeWidth={2.5} />
                      <ChevronRight className="h-4 w-4 text-white" strokeWidth={2.5} />
                    </div>
                  </div>
                </div>
              ) : showSingle ? (
                <div
                  className="absolute inset-0 overflow-hidden rounded-[2.25rem]"
                  style={{ clipPath: "inset(0 round 2.25rem)" }}
                  aria-hidden
                >
                  <img
                    src={simulatorPreviewUrl}
                    alt="Simulator preview"
                    className="h-full w-full object-cover object-top"
                  />
                </div>
              ) : (
                <p className="text-body-muted relative text-center text-sm max-w-[200px] leading-relaxed">
                  {isPro
                    ? "Simulator stream will appear here once the build finishes on the Mac runner."
                    : "Simulator stream will appear here when connected."}
                </p>
              )}
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
