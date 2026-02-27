/**
 * Ensures the export pipeline detects MusicKit so agent-generated Apple Music apps
 * get MusicKit.framework linked and NSAppleMusicUsageDescription in Info.plist.
 * Run this to verify "ask the agent to use MusicKit" will succeed without burning API tokens.
 */
import { describe, it, expect } from "vitest";
import {
  buildPbxproj,
  detectRequiredFrameworks,
  detectPrivacyPermissions,
} from "@/lib/xcodeProject";

const MINIMAL_MUSICKIT_SWIFT = `
import SwiftUI
import MusicKit

struct ContentView: View {
    var body: some View {
        Text("Apple Music")
    }
    
    func search() async {
        let request = MusicCatalogSearchRequest(term: "Drake", types: [Song.self])
        let response = try? await request.response()
    }
}
`;

const MINIMAL_APP_SWIFT = `
import SwiftUI

@main
struct TestApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
`;

describe("MusicKit export pipeline", () => {
  it("detects MusicKit framework when Swift uses MusicKit APIs", () => {
    const files = [{ path: "ContentView.swift", content: MINIMAL_MUSICKIT_SWIFT }];
    const frameworks = detectRequiredFrameworks(files);
    expect(frameworks).toContain("MusicKit");
  });

  it("adds NSAppleMusicUsageDescription when Swift uses MusicKit", () => {
    const files = [{ path: "ContentView.swift", content: MINIMAL_MUSICKIT_SWIFT }];
    const privacy = detectPrivacyPermissions(files);
    expect(privacy["NSAppleMusicUsageDescription"]).toBeDefined();
    expect(privacy["NSAppleMusicUsageDescription"]).toMatch(/Apple Music|music/i);
  });

  it("export-style build produces pbxproj that links MusicKit.framework", () => {
    const files = [
      { path: "App.swift", content: MINIMAL_APP_SWIFT },
      { path: "ContentView.swift", content: MINIMAL_MUSICKIT_SWIFT },
    ];
    const paths = files.map((f) => f.path);
    const frameworks = detectRequiredFrameworks(files);
    const privacyPermissions = detectPrivacyPermissions(files);

    expect(frameworks).toContain("MusicKit");
    expect(privacyPermissions["NSAppleMusicUsageDescription"]).toBeDefined();

    const result = buildPbxproj(paths, {
      projectName: "MusicKitTestApp",
      bundleId: "com.test.musickit",
      deploymentTarget: "17.0",
      developmentTeam: "",
      privacyPermissions,
      frameworks,
      appSwiftPaths: paths,
    });

    expect(result.pbxproj).toContain("MusicKit.framework");
    expect(result.pbxproj).toMatch(/MusicKit\.framework in Frameworks/);
  });
});
