/**
 * Ensures HealthKit-using apps get com.apple.developer.healthkit in the
 * exported entitlements file, and that the plist output is valid (no stray quotes).
 */
import { describe, it, expect } from "vitest";
import {
  detectEntitlements,
  generateEntitlementsPlist,
} from "@/lib/xcodeProject";

const SWIFT_WITH_HEALTHKIT = `
import SwiftUI
import HealthKit

struct ContentView: View {
    let store = HKHealthStore()
    var body: some View { Text("Hi") }
}
`;

const SWIFT_WITH_QUANTITY_TYPE_ONLY = `
import SwiftUI
import HealthKit

struct WorkoutView: View {
    let heartRateType = HKQuantityType(.heartRate)
    var body: some View { Text("HR") }
}
`;

describe("HealthKit entitlements", () => {
  it("detects HealthKit entitlement when Swift uses HKHealthStore", () => {
    const files = [{ path: "ContentView.swift", content: SWIFT_WITH_HEALTHKIT }];
    const ent = detectEntitlements(files);
    expect(ent).not.toBeNull();
    expect(ent!["com.apple.developer.healthkit"]).toBe(true);
  });

  it("detects HealthKit entitlement when Swift uses HKQuantityType only", () => {
    const files = [{ path: "View.swift", content: SWIFT_WITH_QUANTITY_TYPE_ONLY }];
    const ent = detectEntitlements(files);
    expect(ent).not.toBeNull();
    expect(ent!["com.apple.developer.healthkit"]).toBe(true);
  });

  it("generateEntitlementsPlist for HealthKit produces valid plist without stray quote", () => {
    const entitlements = { "com.apple.developer.healthkit": true };
    const plist = generateEntitlementsPlist(entitlements);
    expect(plist).toContain("<key>com.apple.developer.healthkit</key>");
    expect(plist).toContain("<true/>");
    expect(plist).not.toMatch(/<true\/>"\s/);
    expect(plist).not.toContain('"/>');
  });
});
