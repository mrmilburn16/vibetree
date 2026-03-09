#!/usr/bin/env node
/**
 * Validates that a generated Live Activities (Focus Timer or similar) build output
 * will produce a compilable result. Run against an unzipped Xcode export, e.g.:
 *   node scripts/validate-live-activities.mjs /tmp/vibetree-build-xxx/unzip
 *   node scripts/validate-live-activities.mjs /path/to/MyApp
 *
 * Checks:
 * 1. ActivityAttributes struct is defined in main app target (LiveActivity/ or Models/), NOT only in WidgetExtension/
 * 2. WidgetExtension/ has WidgetBundle and LiveActivityWidget (or equivalent) files
 * 3. All files that reference ActivityAttributes/ActivityKit types import ActivityKit
 * 4. NSSupportsLiveActivities is true in the app's Info.plist (or in pbxproj when using generated plist)
 */

import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

function findAppRoot(inputPath) {
  const resolved = join(process.cwd(), inputPath);
  if (!existsSync(resolved)) return { appRoot: null, projectName: null, error: `Path does not exist: ${resolved}` };

  const stat = statSync(resolved);
  if (!stat.isDirectory()) return { appRoot: null, projectName: null, error: `Not a directory: ${resolved}` };

  const entries = readdirSync(resolved);
  const xcodeproj = entries.find((e) => e.endsWith(".xcodeproj"));
  if (xcodeproj) {
    const projectName = xcodeproj.replace(/\.xcodeproj$/, "");
    const appDir = join(resolved, projectName);
    if (existsSync(appDir)) return { appRoot: appDir, projectName, unzipRoot: resolved };
    return { appRoot: null, projectName: null, error: `Expected app folder ${projectName}/ not found` };
  }

  const hasSwift = entries.some((e) => e.endsWith(".swift")) || entries.some((d) => {
    try {
      return readdirSync(join(resolved, d)).some((f) => f.endsWith(".swift"));
    } catch {
      return false;
    }
  });
  if (hasSwift) return { appRoot: resolved, projectName: resolved.split("/").pop(), unzipRoot: null };
  return { appRoot: null, projectName: null, error: `No .xcodeproj and no Swift files found in ${resolved}` };
}

function collectSwiftFiles(dir, prefix = "") {
  const out = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (e.name === "Pods" || e.name === ".build") continue;
      out.push(...collectSwiftFiles(join(dir, e.name), rel));
    } else if (e.name.endsWith(".swift")) {
      out.push({ rel, abs: join(dir, e.name) });
    }
  }
  return out;
}

const ACTIVITY_ATTRIBUTES_STRUCT_RE = /\bstruct\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*ActivityAttributes\b/;
const ACTIVITY_REFERENCE_RE = /\b(Activity<|ActivityAttributes|ActivityConfiguration|ActivityContent|Activity\.request|activity\.update|activity\.end)\b|:\s*([A-Za-z_][A-Za-z0-9_]*)Attributes\b/;
const IMPORT_ACTIVITY_KIT_RE = /^\s*import\s+ActivityKit\s*$/m;

function runChecks(appRoot, projectName, unzipRoot) {
  const results = { passed: [], failed: [], warnings: [] };
  const swiftFiles = collectSwiftFiles(appRoot);

  const byRel = new Map(swiftFiles.map((f) => [f.rel, f]));

  const readContent = (rel) => {
    const f = byRel.get(rel);
    if (!f) return null;
    try {
      return readFileSync(f.abs, "utf8");
    } catch {
      return null;
    }
  };

  const allPaths = swiftFiles.map((f) => f.rel);
  const widgetPaths = allPaths.filter((p) => p.startsWith("WidgetExtension/"));
  const mainAppPaths = allPaths.filter((p) => !p.startsWith("WidgetExtension/"));

  // --- Check 1: ActivityAttributes in main app target ---
  const attributesInWidget = [];
  const attributesInMainApp = [];
  for (const { rel, abs } of swiftFiles) {
    const content = readFileSync(abs, "utf8");
    const match = content.match(ACTIVITY_ATTRIBUTES_STRUCT_RE);
    if (match) {
      const structName = match[1];
      if (rel.startsWith("WidgetExtension/")) {
        attributesInWidget.push({ rel, structName });
      } else {
        attributesInMainApp.push({ rel, structName });
      }
    }
  }

  if (attributesInWidget.length > 0 && attributesInMainApp.length === 0) {
    results.failed.push({
      check: "ActivityAttributes in main app target",
      message: `ActivityAttributes struct(s) are defined only in WidgetExtension/ (${attributesInWidget.map((a) => a.structName).join(", ")} in ${attributesInWidget.map((a) => a.rel).join(", ")}). The main app cannot see types defined there — define them in LiveActivity/<Name>Attributes.swift or Models/<Name>Attributes.swift.`,
    });
  } else if (attributesInMainApp.length > 0) {
    results.passed.push({
      check: "ActivityAttributes in main app target",
      detail: attributesInMainApp.map((a) => `${a.structName} in ${a.rel}`).join("; "),
    });
  }
  if (attributesInWidget.length > 0 && attributesInMainApp.length > 0) {
    results.warnings.push({
      check: "ActivityAttributes in both targets",
      message: `ActivityAttributes also defined in WidgetExtension/ (${attributesInWidget.map((a) => a.rel).join(", ")}). The widget should only reference the type from the main app; remove the duplicate definition from WidgetExtension/.`,
    });
  }

  // --- Check 2: WidgetExtension has WidgetBundle and LiveActivityWidget ---
  const hasWidgetBundle = widgetPaths.some((p) => /WidgetBundle\.swift$/i.test(p));
  const hasLiveActivityWidget = widgetPaths.some((p) => /LiveActivity.*\.swift$/i.test(p) || /ActivityWidget\.swift$/i.test(p));
  if (widgetPaths.length > 0) {
    if (!hasWidgetBundle) {
      results.failed.push({
        check: "WidgetExtension structure",
        message: "WidgetExtension/ folder exists but no WidgetBundle.swift found. Expected WidgetExtension/WidgetBundle.swift with @main WidgetBundle.",
      });
    } else {
      results.passed.push({ check: "WidgetExtension structure", detail: "WidgetBundle.swift present." });
    }
    if (!hasLiveActivityWidget) {
      results.failed.push({
        check: "WidgetExtension structure",
        message: "WidgetExtension/ folder exists but no Live Activity widget file found. Expected e.g. WidgetExtension/LiveActivityWidget.swift with ActivityConfiguration(for: YourAttributes.self).",
      });
    } else {
      results.passed.push({ check: "WidgetExtension structure", detail: "Live Activity widget file present." });
    }
  } else if (mainAppPaths.some((p) => /LiveActivity\//.test(p) || /Attributes\.swift$/i.test(p))) {
    results.failed.push({
      check: "WidgetExtension structure",
      message: "Live Activity attributes or LiveActivity/ files exist but WidgetExtension/ folder is missing. Add WidgetExtension/WidgetBundle.swift and WidgetExtension/LiveActivityWidget.swift.",
    });
  }

  // --- Check 3: Files referencing Activity types import ActivityKit ---
  const filesReferencingActivity = [];
  for (const { rel, abs } of swiftFiles) {
    const content = readFileSync(abs, "utf8");
    if (ACTIVITY_REFERENCE_RE.test(content) && !IMPORT_ACTIVITY_KIT_RE.test(content)) {
      filesReferencingActivity.push(rel);
    }
  }
  if (filesReferencingActivity.length > 0) {
    results.failed.push({
      check: "ActivityKit import",
      message: `These files reference Activity/ActivityAttributes/ActivityConfiguration but do not import ActivityKit: ${filesReferencingActivity.join(", ")}. Add "import ActivityKit" at the top.`,
    });
  } else if (widgetPaths.length > 0 || attributesInMainApp.length > 0) {
    results.passed.push({ check: "ActivityKit import", detail: "All files that reference Activity types import ActivityKit." });
  }

  // --- Check 4: NSSupportsLiveActivities in app Info.plist ---
  const infoPlistPath = join(appRoot, "Info.plist");
  const pbxprojPath = unzipRoot ? join(unzipRoot, `${projectName}.xcodeproj`, "project.pbxproj") : null;
  let supportsLiveActivities = false;
  if (existsSync(infoPlistPath)) {
    const plistContent = readFileSync(infoPlistPath, "utf8");
    supportsLiveActivities = /NSSupportsLiveActivities\s*<\/key>\s*<true\s*\/>/.test(plistContent) ||
      /<key>NSSupportsLiveActivities<\/key>\s*<true\s*\/>/.test(plistContent);
  }
  if (!supportsLiveActivities && pbxprojPath && existsSync(pbxprojPath)) {
    const pbx = readFileSync(pbxprojPath, "utf8");
    supportsLiveActivities = /INFOPLIST_KEY_NSSupportsLiveActivities\s*=\s*YES/.test(pbx);
  }
  if (widgetPaths.length > 0 || attributesInMainApp.length > 0) {
    if (!supportsLiveActivities) {
      results.failed.push({
        check: "NSSupportsLiveActivities",
        message: "App Info.plist (or pbxproj) does not set NSSupportsLiveActivities to true. Required for Live Activities; add <key>NSSupportsLiveActivities</key><true/> to the app Info.plist or ensure the build generates it.",
      });
    } else {
      results.passed.push({ check: "NSSupportsLiveActivities", detail: "NSSupportsLiveActivities is true in app Info.plist or pbxproj." });
    }
  }

  return results;
}

function findLatestTempBuild() {
  const tmp = tmpdir();
  let entries = [];
  try {
    entries = readdirSync(tmp, { withFileTypes: true });
  } catch {
    return null;
  }
  const buildDirs = entries
    .filter((e) => e.isDirectory() && e.name.startsWith("vibetree-build-"))
    .map((e) => ({ name: e.name, path: join(tmp, e.name) }))
    .filter((d) => existsSync(join(d.path, "unzip")));
  if (buildDirs.length === 0) return null;
  buildDirs.sort((a, b) => {
    const statA = statSync(a.path);
    const statB = statSync(b.path);
    return (statB.mtimeMs || 0) - (statA.mtimeMs || 0);
  });
  return join(buildDirs[0].path, "unzip");
}

function main() {
  let inputPath = process.argv[2];
  if (!inputPath || inputPath === "--last" || inputPath === "last") {
    const latest = findLatestTempBuild();
    if (latest) {
      console.log("Using latest temp build:", latest);
      inputPath = latest;
    } else {
      const tmpBase = join(tmpdir(), "vibetree-build-");
      if (inputPath === "--last" || inputPath === "last") {
        console.error("No recent vibetree-build-* directory with unzip/ found in", tmpdir());
      }
      console.error("Usage: node scripts/validate-live-activities.mjs <path-to-unzipped-export>");
      console.error("");
      console.error("  path: Directory containing the unzipped Xcode project (e.g. /tmp/vibetree-build-xxx/unzip)");
      console.error("        or the app source folder (e.g. VibetreeApp/ with Swift files and Info.plist).");
      console.error("        Use --last to use the most recent runner temp build.");
      console.error("");
      console.error("  To use the last FocusTimer build from the runner's temp folder, run with --last or find");
      console.error(`  the latest directory under ${tmpBase}* and pass its unzip/ subfolder.`);
      process.exit(1);
    }
  }

  const { appRoot, projectName, unzipRoot, error } = findAppRoot(inputPath);
  if (error) {
    console.error(error);
    process.exit(1);
  }

  console.log("Validate Live Activities pipeline");
  console.log("=================================");
  console.log("App root:", appRoot);
  console.log("Project name:", projectName);
  console.log("");

  const results = runChecks(appRoot, projectName, unzipRoot);

  if (results.passed.length) {
    console.log("PASSED:");
    for (const p of results.passed) {
      console.log("  ✓", p.check, p.detail ? `— ${p.detail}` : "");
    }
    console.log("");
  }

  if (results.warnings.length) {
    console.log("WARNINGS:");
    for (const w of results.warnings) {
      console.log("  ⚠", w.check, "—", w.message);
    }
    console.log("");
  }

  if (results.failed.length) {
    console.log("FAILED (fix these for a compilable result):");
    for (const f of results.failed) {
      console.log("  ✗", f.check);
      console.log("    ", f.message);
    }
    console.log("");
    process.exit(1);
  }

  console.log("All checks passed. Live Activities pipeline looks compilable.");
  process.exit(0);
}

main();
