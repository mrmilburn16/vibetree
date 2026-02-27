import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRefetchOnVisible } from "./useRefetchOnVisible";

describe("useRefetchOnVisible", () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>;
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addEventListenerSpy = vi.spyOn(document, "addEventListener");
    removeEventListenerSpy = vi.spyOn(document, "removeEventListener");
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });

  it("registers a visibilitychange listener when enabled", () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnVisible(refetch, true));

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
  });

  it("does not register a listener when disabled", () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnVisible(refetch, false));

    expect(addEventListenerSpy).not.toHaveBeenCalled();
  });

  it("calls refetch when document becomes visible", async () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnVisible(refetch, true));

    const call = addEventListenerSpy.mock.calls.find(
      (c) => c[0] === "visibilitychange"
    );
    const handler = call?.[1] as () => void;
    expect(handler).toBeDefined();

    refetch.mockClear();
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      writable: true,
      configurable: true,
    });
    handler();

    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("does not call refetch when document is not visible", () => {
    const refetch = vi.fn();
    renderHook(() => useRefetchOnVisible(refetch, true));

    const call = addEventListenerSpy.mock.calls.find(
      (c) => c[0] === "visibilitychange"
    );
    const handler = call?.[1] as () => void;
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
    handler();

    expect(refetch).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const refetch = vi.fn();
    const { unmount } = renderHook(() => useRefetchOnVisible(refetch, true));

    const call = addEventListenerSpy.mock.calls.find(
      (c) => c[0] === "visibilitychange"
    );
    const handler = call?.[1];

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "visibilitychange",
      handler
    );
  });
});
