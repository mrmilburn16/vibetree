"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { Maximize2, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { QRCode } from "@/components/ui";
import { ReadyIndicator } from "./ReadyIndicator";
import { FailedIndicator } from "./FailedIndicator";

type BuildStatus = "idle" | "building" | "live" | "failed";

const DEVICE_WIDTH = 280;
const DEVICE_HEIGHT = 568;

/** Screen inset when using image frame (match your mockup; % of frame size) */
const SCREEN_INSET = { top: 7.5, right: 5, bottom: 7.5, left: 5 };

const PROJECT_TYPE_STORAGE_KEY = "vibetree-project-type";

/** When true, show before/after comparison slider when two frames exist. Default false. */
const PREVIEW_BEFORE_AFTER_KEY = "vibetree-preview-before-after-enabled";

export function getBeforeAfterEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PREVIEW_BEFORE_AFTER_KEY) === "true";
  } catch {
    return false;
  }
}

export function setBeforeAfterEnabled(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(PREVIEW_BEFORE_AFTER_KEY, "true");
    else localStorage.removeItem(PREVIEW_BEFORE_AFTER_KEY);
    window.dispatchEvent(new CustomEvent("vibetree-preview-settings-changed"));
  } catch {}
}

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
  const [appetizePublicKey, setAppetizePublicKey] = useState<string | null>(null);
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
  /** Labels below the phone fade in on first drag and stay visible. */
  const [labelsRevealed, setLabelsRevealed] = useState(false);
  /** User preference: show before/after comparison (default off). Updated when settings modal saves. */
  const [comparisonEnabled, setComparisonEnabled] = useState(() => getBeforeAfterEnabled());
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const onSettingsChange = () => setComparisonEnabled(getBeforeAfterEnabled());
    window.addEventListener("vibetree-preview-settings-changed", onSettingsChange);
    return () => window.removeEventListener("vibetree-preview-settings-changed", onSettingsChange);
  }, []);

  // When build becomes live, fetch Appetize public key once; if we're still on the placeholder, poll every 5s for up to 60s
  const appetizePollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (buildStatus !== "live" || !isPro || !projectId) {
      setAppetizePublicKey(null);
      return;
    }
    let cancelled = false;

    const fetchKey = async (): Promise<string | null> => {
      const res = await fetch(`/api/projects/${projectId}/appetize`, { cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return data?.publicKey ?? null;
    };

    const POLL_INTERVAL_MS = 5000;
    const POLL_MAX_MS = 60000;

    const schedulePoll = (deadline: number) => {
      if (cancelled) return;
      if (Date.now() >= deadline) return;
      if (appetizePollTimeoutRef.current) clearTimeout(appetizePollTimeoutRef.current);
      appetizePollTimeoutRef.current = setTimeout(async () => {
        appetizePollTimeoutRef.current = null;
        if (cancelled || Date.now() >= deadline) return;
        console.log("[appetize] Polling for publicKey...");
        const key = await fetchKey();
        if (cancelled) return;
        if (key) {
          setAppetizePublicKey(key);
          console.log("[appetize] publicKey found, switching to interactive preview");
          return;
        }
        schedulePoll(deadline);
      }, POLL_INTERVAL_MS);
    };

    fetchKey().then((key) => {
      if (cancelled) return;
      if (key) {
        setAppetizePublicKey(key);
        console.log("[appetize] publicKey found, switching to interactive preview");
        return;
      }
      const deadline = Date.now() + POLL_MAX_MS;
      schedulePoll(deadline);
    });

    return () => {
      cancelled = true;
      if (appetizePollTimeoutRef.current) {
        clearTimeout(appetizePollTimeoutRef.current);
        appetizePollTimeoutRef.current = null;
      }
    };
  }, [buildStatus, isPro, projectId]);

  useEffect(() => {
    if (buildStatus !== "live" || !isPro || !projectId) {
      setSimulatorPreviewUrl(null);
      setBeforeUrl(null);
      setAfterUrl(null);
      prevSimulatorUrlRef.current = null;
      return;
    }
    if (appetizePublicKey) {
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
  }, [buildStatus, isPro, projectId, appetizePublicKey]);

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
      setLabelsRevealed(true);
      handleMove(e.clientX);
    },
    [handleMove]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      isDraggingRef.current = true;
      setLabelsRevealed(true);
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

  const showComparison = comparisonEnabled && isPro && beforeUrl && afterUrl;
  const showSingle = isPro && simulatorPreviewUrl && !showComparison;
  const showAppetize = isPro && appetizePublicKey;
  const frameWidth = DEVICE_WIDTH + 20;
  const [appetizeSessionStarted, setAppetizeSessionStarted] = useState(false);

  const appetizeIframeId = "preview-appetize-iframe";

  const loadAppetizeScript = useCallback((): Promise<void> => {
    const win = window as unknown as { appetize?: { getClient: (s: string) => Promise<unknown> } };
    if (typeof win.appetize?.getClient === "function") return Promise.resolve();
    if (document.querySelector('script[src="https://js.appetize.io/embed.js"]'))
      return new Promise((resolve) => {
        const check = () => {
          if (typeof win.appetize?.getClient === "function") {
            resolve();
            return;
          }
          setTimeout(check, 100);
        };
        setTimeout(check, 300);
      });
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://js.appetize.io/embed.js";
      script.async = true;
      script.onload = () => {
        const check = () => {
          if (typeof win.appetize?.getClient === "function") {
            resolve();
            return;
          }
          setTimeout(check, 100);
        };
        setTimeout(check, 500);
      };
      script.onerror = () => reject(new Error("Appetize script failed to load"));
      document.head.appendChild(script);
    });
  }, []);

  const handleStartAppetizeSession = useCallback(async () => {
    try {
      await loadAppetizeScript();
      const win = window as unknown as { appetize?: { getClient: (s: string) => Promise<{ startSession: (opts?: { grantPermissions?: boolean }) => Promise<unknown> }> } };
      const client = await win.appetize?.getClient(`#${appetizeIframeId}`);
      if (client) {
        await client.startSession({ grantPermissions: true });
        setAppetizeSessionStarted(true);
      }
    } catch (e) {
      console.warn("[PreviewPane] Appetize session start failed", e);
    }
  }, [loadAppetizeScript]);

  useEffect(() => {
    if (!showAppetize) setAppetizeSessionStarted(false);
  }, [showAppetize]);

  return (
    <div className="flex flex-col items-center">
      {showAppetize ? (
        /* No autoplay: session starts only when user taps overlay to preserve Appetize minutes */
        <div className="relative animate-fade-in flex items-center justify-center">
          <iframe
            id={appetizeIframeId}
            title="Interactive simulator"
            src={`https://appetize.io/embed/${appetizePublicKey}?scale=auto&centered=both&screenOnly=true&grantPermissions=true`}
            width={DEVICE_WIDTH}
            height={DEVICE_HEIGHT}
            className="border-0 rounded-[2rem] overflow-hidden"
            style={{ maxWidth: "100%", maxHeight: "100%" }}
          />
          {!appetizeSessionStarted && (
            <button
              type="button"
              onClick={handleStartAppetizeSession}
              className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-[2rem] border-0 bg-[var(--background-primary)]/90 backdrop-blur-sm cursor-pointer transition-opacity hover:opacity-95 focus:outline focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]"
              aria-label="Tap to start simulator"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--background-secondary)] border border-[var(--border-default)] shadow-lg">
                <Play className="h-7 w-7 text-[var(--text-primary)] fill-[var(--text-primary)]" strokeWidth={1.5} />
              </span>
              <span className="text-sm font-medium text-[var(--text-secondary)]">Tap to start simulator</span>
            </button>
          )}
        </div>
      ) : (
        <div
          className="relative animate-fade-in rounded-[2.75rem] p-[10px]"
          style={{
            width: frameWidth,
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
                  {/* Left half (before); no visible label inside frame — labels are below the phone */}
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: `inset(0 ${100 - splitPercent}% 0 0)`,
                    }}
                  >
                    <img
                      src={beforeUrl}
                      alt=""
                      className="h-full w-full object-cover object-top"
                      draggable={false}
                    />
                  </div>
                  {/* Right half (after); no visible label inside frame */}
                  <div
                    className="absolute inset-0"
                    style={{
                      clipPath: `inset(0 0 0 ${splitPercent}%)`,
                    }}
                  >
                    <img
                      src={afterUrl}
                      alt=""
                      className="h-full w-full object-cover object-top"
                      draggable={false}
                    />
                  </div>
                  {/* Divider line + drag handle: wide hit area (64px) so the handle is always draggable after refresh */}
                  <div
                    className="absolute top-0 bottom-0 z-[4] min-w-[64px] w-16 cursor-ew-resize pointer-events-auto touch-none"
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
                      className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)] pointer-events-none"
                      aria-hidden
                    />
                    {/* Circular handle with arrows */}
                    <div
                      className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/70 shadow-md pointer-events-none"
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
      )}
      {/* Before/After labels below the phone; fade in on first drag, then stay visible */}
      {showComparison && !showAppetize && (
        <div
          className="flex w-full items-center"
          style={{ marginTop: 12, width: frameWidth }}
          aria-hidden
        >
          <div className="flex flex-1 justify-center">
            <span
              className={`text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)] transition-opacity duration-200 ${labelsRevealed ? "opacity-100" : "opacity-0"}`}
            >
              Before
            </span>
          </div>
          <div className="flex flex-1 justify-center">
            <span
              className={`text-[11px] font-medium uppercase tracking-widest text-[var(--text-tertiary)] transition-opacity duration-200 ${labelsRevealed ? "opacity-100" : "opacity-0"}`}
            >
              After
            </span>
          </div>
        </div>
      )}
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
