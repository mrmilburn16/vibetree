"use client";

import { useEffect, useRef, useState } from "react";
import QRCodeLib from "qrcode";

export interface QRCodeProps {
  value: string;
  size?: number;
  className?: string;
}

/**
 * Renders a QR code as a canvas. Use when value is non-empty; otherwise nothing is shown.
 */
export function QRCode({ value, size = 200, className = "" }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!value || !canvasRef.current) {
      setError(null);
      return;
    }
    setError(null);
    QRCodeLib.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    }).catch((err) => setError(err instanceof Error ? err.message : "Failed to generate QR code"));
  }, [value, size]);

  if (!value) return null;
  if (error) {
    return (
      <div className={`flex items-center justify-center rounded bg-[var(--background-secondary)] text-[var(--text-tertiary)] ${className}`} style={{ width: size, height: size }}>
        <span className="text-xs">QR unavailable</span>
      </div>
    );
  }
  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-label="QR code"
      style={{ width: size, height: size }}
    />
  );
}
