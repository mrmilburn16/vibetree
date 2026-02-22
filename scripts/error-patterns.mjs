#!/usr/bin/env node
/**
 * Classify Swift compiler errors from build-results.jsonl into categories
 * and surface the most common patterns with fix suggestions.
 *
 * Run:  node scripts/error-patterns.mjs
 *       node scripts/error-patterns.mjs --json
 *       node scripts/error-patterns.mjs --category missing_import
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const LOG_PATH = join(process.cwd(), "data", "build-results.jsonl");

const args = process.argv.slice(2);
const jsonOutput = args.includes("--json");
const categoryFilter = (() => {
  const idx = args.indexOf("--category");
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
})();

if (!existsSync(LOG_PATH)) {
  if (jsonOutput) {
    console.log(JSON.stringify({ error: "No build results file found" }));
  } else {
    console.log("No build results file at data/build-results.jsonl — build some apps first.");
  }
  process.exit(0);
}

const lines = readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean);
const results = lines.map((l) => JSON.parse(l));

if (results.length === 0) {
  console.log("No build results yet.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Category definitions: name -> { patterns: RegExp[], suggestion(match) }
// ---------------------------------------------------------------------------

const CATEGORIES = {
  missing_import: {
    patterns: [
      /cannot find type '(\w+)' in scope/i,
      /cannot find '(\w+)' in scope/i,
      /use of undeclared type '(\w+)'/i,
      /no such module '(\w+)'/i,
      /use of unresolved identifier '(\w+)'/i,
    ],
    suggestion: (msg) => {
      const m =
        msg.match(/cannot find type '(\w+)'/i) ||
        msg.match(/cannot find '(\w+)'/i) ||
        msg.match(/no such module '(\w+)'/i) ||
        msg.match(/use of undeclared type '(\w+)'/i) ||
        msg.match(/use of unresolved identifier '(\w+)'/i);
      const symbol = m ? m[1] : "unknown";
      const frameworks = inferFramework(symbol);
      if (frameworks) return `Add auto-import for ${frameworks} in fixSwift.ts`;
      return `Add auto-import rule for '${symbol}' in fixSwift.ts`;
    },
  },

  type_mismatch: {
    patterns: [
      /cannot convert value of type/i,
      /produces result of type .+, but context expects/i,
      /requires the types .+ be equivalent/i,
      /cannot assign value of type/i,
    ],
    suggestion: () => "Add type conversion guidance to system prompt",
  },

  trailing_closure: {
    patterns: [
      /extra trailing closure/i,
      /contextual closure type/i,
    ],
    suggestion: () => "Strengthen trailing closure anti-pattern in system prompt",
  },

  missing_conformance: {
    patterns: [
      /does not conform to protocol/i,
      /type .+ does not conform/i,
    ],
    suggestion: () => "Add protocol conformance checklist to system prompt",
  },

  member_not_found: {
    patterns: [
      /has no member/i,
      /value of type .+ has no member/i,
      /instance member .+ cannot be used on type/i,
    ],
    suggestion: (msg) => {
      const m = msg.match(/has no member '(\w+)'/i);
      const member = m ? m[1] : "unknown";
      return `Add valid member reference for '${member}' to fixSwift.ts`;
    },
  },

  missing_return: {
    patterns: [
      /missing return in/i,
      /non-void function should return/i,
    ],
    suggestion: () => "Add return-type checking guidance to system prompt",
  },

  ambiguous_reference: {
    patterns: [
      /ambiguous use of/i,
      /ambiguous reference to/i,
    ],
    suggestion: () => "Add explicit disambiguation patterns to system prompt",
  },

  argument_mismatch: {
    patterns: [
      /missing argument/i,
      /extra argument/i,
      /incorrect argument label/i,
      /cannot invoke .+ with an argument list/i,
    ],
    suggestion: () => "Add argument-label validation to fixSwift.ts",
  },

  deprecated_api: {
    patterns: [
      /NavigationView/i,
      /\.foregroundColor\b/i,
      /\.navigationBarTitle\b/i,
      /\.navigationBarItems\b/i,
      /\.accentColor\b/i,
    ],
    suggestion: (msg) => {
      const migrations = {
        NavigationView: "NavigationStack",
        ".foregroundColor": ".foregroundStyle",
        ".navigationBarTitle": ".navigationTitle",
        ".navigationBarItems": ".toolbar",
        ".accentColor": ".tint",
      };
      for (const [old, replacement] of Object.entries(migrations)) {
        if (msg.includes(old)) return `Add migration from ${old} to ${replacement} in fixSwift.ts`;
      }
      return "Add deprecated-API migration rule in fixSwift.ts";
    },
  },

  binding_error: {
    patterns: [
      /cannot find type 'Binding' in scope/i,
      /cannot convert value .+ to expected argument type 'Binding/i,
      /use of unresolved identifier '\$\w+'/i,
      /\$\w+.*binding/i,
    ],
    suggestion: () => "Add @Binding / $ prefix guidance to system prompt",
  },
};

// Best-effort framework lookup for missing-import suggestions
function inferFramework(symbol) {
  const map = {
    BarMark: "Charts", LineMark: "Charts", PointMark: "Charts", AreaMark: "Charts",
    SectorMark: "Charts", RuleMark: "Charts", RectangleMark: "Charts", Chart: "Charts",
    MapKit: "MapKit", Map: "MapKit", MKMapView: "MapKit",
    ARView: "RealityKit", Entity: "RealityKit",
    AVCaptureSession: "AVFoundation", AVPlayer: "AVFoundation",
    CLLocationManager: "CoreLocation",
    PHPickerViewController: "PhotosUI",
    SFSafariViewController: "SafariServices",
    WKWebView: "WebKit",
    SKScene: "SpriteKit", SKSpriteNode: "SpriteKit",
    UIViewRepresentable: "SwiftUI", UIViewControllerRepresentable: "SwiftUI",
    Binding: "SwiftUI", EnvironmentObject: "SwiftUI",
    CoreData: "CoreData", NSManagedObject: "CoreData",
  };
  return map[symbol] || null;
}

// ---------------------------------------------------------------------------
// Normalize: strip file-path prefix, keep just the error message
// ---------------------------------------------------------------------------

function normalize(raw) {
  return raw
    .replace(/\S+\.swift:\d+(:\d+)*:\s*(error|warning):\s*/, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Classify a single normalized error
// ---------------------------------------------------------------------------

function classify(msg) {
  for (const [category, { patterns }] of Object.entries(CATEGORIES)) {
    for (const pat of patterns) {
      if (pat.test(msg)) return category;
    }
  }
  return "other";
}

// ---------------------------------------------------------------------------
// Collect & process
// ---------------------------------------------------------------------------

const allErrors = [];
for (const r of results) {
  for (const raw of r.compilerErrors || []) {
    const msg = normalize(raw);
    if (!msg) continue;
    allErrors.push({ raw, msg, category: classify(msg) });
  }
}

const countByMsg = {};
for (const e of allErrors) {
  if (!countByMsg[e.msg]) countByMsg[e.msg] = { count: 0, category: e.category };
  countByMsg[e.msg].count++;
}

const countByCategory = {};
for (const e of allErrors) {
  countByCategory[e.category] = (countByCategory[e.category] || 0) + 1;
}

const uniquePatterns = Object.keys(countByMsg).length;
const totalErrors = allErrors.length;

// Apply category filter
const filteredByMsg = categoryFilter
  ? Object.fromEntries(Object.entries(countByMsg).filter(([, v]) => v.category === categoryFilter))
  : countByMsg;

const filteredCategories = categoryFilter
  ? Object.fromEntries(Object.entries(countByCategory).filter(([k]) => k === categoryFilter))
  : countByCategory;

// ---------------------------------------------------------------------------
// JSON output
// ---------------------------------------------------------------------------

if (jsonOutput) {
  const top = Object.entries(filteredByMsg)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([msg, { count, category }]) => ({
      count,
      message: msg,
      category,
      suggestion: makeSuggestion(category, msg),
    }));

  console.log(JSON.stringify({
    totalBuilds: results.length,
    totalErrors,
    uniquePatterns,
    byCategory: filteredCategories,
    topErrors: top,
  }, null, 2));
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Pretty output
// ---------------------------------------------------------------------------

const BAR_WIDTH = 20;

function bar(value, max) {
  const filled = max > 0 ? Math.round((value / max) * BAR_WIDTH) : 0;
  return "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
}

function makeSuggestion(category, msg) {
  const def = CATEGORIES[category];
  if (!def) return "Review error and add handling rule";
  return def.suggestion(msg);
}

console.log(`\n${"=".repeat(60)}`);
console.log(`  ERROR PATTERN ANALYSIS`);
console.log(`${"=".repeat(60)}\n`);
console.log(`  Total builds analyzed: ${results.length}`);
console.log(`  Total errors:          ${totalErrors}`);
console.log(`  Unique error patterns: ${uniquePatterns}`);
if (categoryFilter) console.log(`  Filter:                --category ${categoryFilter}`);

// By category
const sortedCategories = Object.entries(filteredCategories).sort((a, b) => b[1] - a[1]);
const maxCatCount = sortedCategories.length > 0 ? sortedCategories[0][1] : 0;

console.log(`\n  BY CATEGORY:`);
for (const [cat, count] of sortedCategories) {
  const pct = totalErrors > 0 ? ((count / totalErrors) * 100).toFixed(1) : "0.0";
  console.log(`    ${cat.padEnd(22)} ${bar(count, maxCatCount)} ${count} (${pct}%)`);
}
if (sortedCategories.length === 0) {
  console.log("    (none)");
}

// Top errors
const topErrors = Object.entries(filteredByMsg)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 20);

if (topErrors.length > 0) {
  console.log(`\n  TOP ${Math.min(topErrors.length, 20)} MOST COMMON ERRORS:`);
  topErrors.forEach(([msg, { count, category }], i) => {
    const num = String(i + 1).padStart(3);
    const truncMsg = msg.length > 80 ? msg.slice(0, 77) + "..." : msg;
    console.log(`   ${num}. (${count}x) ${truncMsg}`);
    console.log(`        Category:   ${category}`);
    console.log(`        Suggestion: ${makeSuggestion(category, msg)}`);
  });
} else {
  console.log(`\n  No errors found${categoryFilter ? ` in category '${categoryFilter}'` : ""}.`);
}

console.log(`\n${"=".repeat(60)}\n`);
