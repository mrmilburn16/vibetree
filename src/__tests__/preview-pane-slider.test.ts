/**
 * Before/after comparison slider: ensure the drag handle has a grabbable hit area
 * so clicks register (fix for w-0 making the handle unclickable).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const PREVIEW_PANE_PATH = join(
  process.cwd(),
  "src",
  "components",
  "editor",
  "PreviewPane.tsx"
);

describe("PreviewPane before/after slider", () => {
  it("divider has a non-zero width hit area so the handle is draggable", () => {
    const content = readFileSync(PREVIEW_PANE_PATH, "utf8");
    // Divider must have a width class that gives a grabbable strip (e.g. min-w-[40px] or w-10), not w-0 only
    expect(content).toMatch(/cursor-ew-resize/);
    const hasZeroWidthOnly = /className="[^"]*absolute[^"]*top-0[^"]*bottom-0[^"]*z-\[3\][^"]*\bw-0\b[^"]*cursor-ew-resize/.test(content);
    expect(hasZeroWidthOnly).toBe(false);
    const hasMinWidthOrWidth = /(min-w-\[\d+px\]|w-\d+).*cursor-ew-resize|cursor-ew-resize.*(min-w-\[\d+px\]|w-\d+)/.test(content);
    expect(hasMinWidthOrWidth).toBe(true);
  });

  it("divider has onMouseDown and onTouchStart for drag", () => {
    const content = readFileSync(PREVIEW_PANE_PATH, "utf8");
    expect(content).toContain("onMouseDown={handleMouseDown}");
    expect(content).toContain("onTouchStart={handleTouchStart}");
  });

  it("visible line and circle have pointer-events-none so parent receives clicks", () => {
    const content = readFileSync(PREVIEW_PANE_PATH, "utf8");
    // Children of the divider should not capture pointer so the parent strip gets the event
    expect(content).toContain("pointer-events-none");
  });

  it("divider has pointer-events-auto and wide hit area (64px) so it works after refresh", () => {
    const content = readFileSync(PREVIEW_PANE_PATH, "utf8");
    expect(content).toMatch(/pointer-events-auto/);
    // 64px or w-16 so the handle is reliably clickable
    expect(content).toMatch(/min-w-\[64px\]|w-16/);
  });
});
