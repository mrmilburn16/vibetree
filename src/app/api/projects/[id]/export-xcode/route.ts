import { NextResponse } from "next/server";
import JSZip from "jszip";
import { getProjectFiles, getProjectFilePaths } from "@/lib/projectFileStore";
import { buildPbxproj, detectPrivacyPermissions } from "@/lib/xcodeProject";
import { getProject, ensureProject } from "@/lib/projectStore";
import { fixSwiftCommonIssues } from "@/lib/llm/fixSwift";

function sanitizeXcodeName(name: string, fallback: string): string {
  const raw = (name || "").trim();
  if (!raw || raw.toLowerCase() === "untitled app") return fallback;
  // Remove emoji / symbols; keep letters, numbers, spaces, dashes.
  const cleaned = raw.replace(/[^\p{L}\p{N}\s-]+/gu, "").trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  let joined = parts.map((p) => p.slice(0, 1).toUpperCase() + p.slice(1)).join("");
  joined = joined.replace(/[^A-Za-z0-9]/g, "");
  if (!joined) return fallback;
  if (!/^[A-Za-z]/.test(joined)) joined = `Vibetree${joined}`;
  return joined.slice(0, 32);
}

type SwiftFile = { path: string; content: string };

function isValidBundleId(value: string): boolean {
  return /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/i.test(value);
}

function buildWidgetInfoPlist(): string {
  // Minimal WidgetKit extension Info.plist; required for the extension target.
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).WidgetExtension</string>
  </dict>
</dict>
</plist>
`;
}

async function buildZipFromSwiftFiles(
  filesArr: SwiftFile[],
  filenameId: string,
  options: { projectName: string; bundleId: string; developmentTeam?: string }
): Promise<Response> {
  const swiftFilesRaw = filesArr.filter((f) => typeof f?.path === "string" && f.path.endsWith(".swift"));
  const swiftFiles = fixSwiftCommonIssues(swiftFilesRaw);
  if (swiftFiles.length === 0) {
    return NextResponse.json(
      { error: "No Swift files to export. Build your app in the chat first." },
      { status: 400 }
    );
  }

  let swiftPaths = swiftFiles.map((f) => f.path);
  const filesMap: Record<string, string> = {};
  for (const f of swiftFiles) filesMap[f.path] = f.content ?? "";

  const usesLiquidGlass = swiftPaths.some((p) => {
    const c = filesMap[p] ?? "";
    return (
      c.includes(".glassEffect(") ||
      c.includes(".glassEffectID(") ||
      c.includes("GlassEffectContainer")
    );
  });
  const deploymentTarget = usesLiquidGlass ? "26.0" : "17.0";

  const detectFirstActivityAttributesType = (): string | null => {
    for (const p of swiftPaths) {
      const c = filesMap[p] ?? "";
      const m = c.match(/\bstruct\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*ActivityAttributes\b/);
      if (m?.[1]) return m[1];
    }
    return null;
  };

  let widgetSwiftPaths = swiftPaths.filter((p) => p.startsWith("WidgetExtension/"));
  let appSwiftPaths = swiftPaths.filter((p) => !p.startsWith("WidgetExtension/"));

  // Fallback: if the app clearly contains Live Activity attributes but no WidgetExtension files,
  // auto-generate a minimal widget extension so the exported project actually runs one-shot.
  const hasLiveActivityCode = appSwiftPaths.some((p) => p.startsWith("LiveActivity/"));
  if (widgetSwiftPaths.length === 0 && hasLiveActivityCode) {
    const attrsType = detectFirstActivityAttributesType();
    if (attrsType) {
      const widgetBundlePath = "WidgetExtension/WidgetBundle.swift";
      const widgetPath = "WidgetExtension/LiveActivityWidget.swift";
      filesMap[widgetBundlePath] = `import WidgetKit
import SwiftUI

@main
struct WidgetExtensionBundle: WidgetBundle {
  var body: some Widget {
    AppLiveActivityWidget()
  }
}
`;
      filesMap[widgetPath] = `import ActivityKit
import WidgetKit
import SwiftUI

struct AppLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: ${attrsType}.self) { _ in
      VStack(alignment: .leading, spacing: 8) {
        Text("Live Activity")
          .font(.headline)
        Text("In progress")
          .font(.subheadline)
          .foregroundStyle(.secondary)
      }
      .padding()
    } dynamicIsland: { _ in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          Text("Live Activity")
            .font(.headline)
        }
      } compactLeading: {
        Text("LA")
      } compactTrailing: {
        Text("•")
      } minimal: {
        Text("LA")
      }
    }
  }
}
`;
      swiftPaths = [...swiftPaths, widgetBundlePath, widgetPath];
      widgetSwiftPaths = [widgetBundlePath, widgetPath];
      appSwiftPaths = swiftPaths.filter((p) => !p.startsWith("WidgetExtension/"));
    }
  }
  const sharedForWidget = appSwiftPaths.filter(
    (p) => p.startsWith("LiveActivity/") && !/Manager\.swift$/i.test(p)
  );
  const widgetSources = widgetSwiftPaths.length > 0 ? Array.from(new Set([...widgetSwiftPaths, ...sharedForWidget])) : [];
  const widgetInfoPlistPath = widgetSources.length > 0 ? "WidgetExtension/Info.plist" : null;
  if (widgetInfoPlistPath) {
    filesMap[widgetInfoPlistPath] = buildWidgetInfoPlist();
  }

  const allPaths = widgetInfoPlistPath ? [...swiftPaths, widgetInfoPlistPath] : [...swiftPaths];

  const allSwiftFiles = allPaths
    .filter((p) => p.endsWith(".swift"))
    .map((p) => ({ path: p, content: filesMap[p] ?? "" }));
  const privacyPermissions = detectPrivacyPermissions(allSwiftFiles);

  const pbxproj = buildPbxproj(allPaths, {
    deploymentTarget,
    projectName: options.projectName,
    bundleId: options.bundleId,
    developmentTeam: options.developmentTeam,
    privacyPermissions,
    appSwiftPaths,
    widget:
      widgetInfoPlistPath && widgetSources.length > 0
        ? {
            name: `${options.projectName}Widget`,
            bundleId: `${options.bundleId}.widget`,
            swiftPaths: widgetSources,
            infoPlistPath: widgetInfoPlistPath,
          }
        : undefined,
  });

  const zip = new JSZip();
  zip.file(`${options.projectName}.xcodeproj/project.pbxproj`, pbxproj);

  for (const path of allPaths) {
    zip.file(`${options.projectName}/${path}`, filesMap[path] ?? "");
  }

  const bytes = await zip.generateAsync({ type: "uint8array" });
  // JSZip's typings use Uint8Array<ArrayBufferLike> (can be backed by SharedArrayBuffer).
  // Create a brand-new Uint8Array backed by a plain ArrayBuffer and copy into it.
  const body = new Uint8Array(bytes.byteLength);
  body.set(bytes);

  // NOTE: Use the standard Web Response here (not NextResponse) because some Vercel/Next typings
  // make NextResponse's constructor overly strict about BodyInit.
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${options.projectName}-${filenameId}.zip"`,
    },
  });
}

/**
 * POST /api/projects/[id]/export-xcode
 * Accepts Swift files in the body so export works even if server memory is cleared.
 * Body: { files: Array<{ path, content }> }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }
  const body = await request.json().catch(() => ({}));
  const files = Array.isArray(body?.files) ? (body.files as SwiftFile[]) : [];
  const providedName = typeof body?.projectName === "string" ? body.projectName : "";
  const providedBundleId = typeof body?.bundleId === "string" ? body.bundleId : "";
  const providedTeam = typeof body?.developmentTeam === "string" ? body.developmentTeam : "";
  const project = getProject(id) ?? ensureProject(id, providedName || "Untitled app");
  const projectName = sanitizeXcodeName(providedName || project.name, "VibetreeApp");
  const candidateBundleId = (providedBundleId || project.bundleId || "com.vibetree.app").trim();
  const bundleId = isValidBundleId(candidateBundleId) ? candidateBundleId : "com.vibetree.app";
  const developmentTeam = providedTeam.trim();
  return await buildZipFromSwiftFiles(files, id.slice(0, 12), {
    projectName,
    bundleId,
    developmentTeam: developmentTeam || undefined,
  });
}

/**
 * GET /api/projects/[id]/export-xcode
 * Returns a zip containing a minimal Xcode project (.xcodeproj + Swift sources)
 * that opens in Xcode and builds to iPhone. Pro (Swift) only.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Project ID required" }, { status: 400 });
  }
  const url = new URL(request.url);
  const developmentTeam = (url.searchParams.get("developmentTeam") ?? "").trim();

  const project = getProject(id) ?? ensureProject(id, "Untitled app");
  const projectName = sanitizeXcodeName(project.name, "VibetreeApp");
  const candidateBundleId = (project.bundleId || "com.vibetree.app").trim();
  const bundleId = isValidBundleId(candidateBundleId) ? candidateBundleId : "com.vibetree.app";

  const paths = getProjectFilePaths(id).filter((p) => p.endsWith(".swift"));
  const files = getProjectFiles(id);
  if (!files || paths.length === 0) {
    return NextResponse.json(
      { error: "No Swift files to export. Build your app in the chat first. (Tip: if you refreshed the page or restarted the dev server, the server’s in-memory file cache is cleared—rebuild once, then export.)" },
      { status: 400 }
    );
  }

  const filesArr: SwiftFile[] = paths.map((p) => ({ path: p, content: files[p] ?? "" }));
  return await buildZipFromSwiftFiles(filesArr, id.slice(0, 12), {
    projectName,
    bundleId,
    developmentTeam: developmentTeam || undefined,
  });
}
