export type SwiftTextFile = { path: string; content: string };

/**
 * Best-effort fixes for common, safe-to-repair SwiftUI compile issues in LLM output.
 *
 * We can't run Xcode builds server-side, so we use small heuristics that reduce
 * obvious “won’t compile” cases without changing intended logic.
 */
export function fixSwiftCommonIssues(files: SwiftTextFile[]): SwiftTextFile[] {
  return files.map((f) => {
    if (!f?.path?.endsWith(".swift") || typeof f.content !== "string") return f;

    let content = f.content;

    // Common mistake: using `$viewModel` as a value (not `$viewModel.someBinding`),
    // which triggers “Cannot find '$viewModel' in scope” unless using `@Bindable`.
    if (!content.includes("@Bindable")) {
      content = content.replace(/\$viewModel(?!\.)/g, "viewModel");
    }

    // Common mistake: escaping quotes inside string interpolation Swift code,
    // e.g. `.currency(code: \"USD\")` which breaks the string literal.
    content = content.replace(
      /\.currency\(code:\s*\\\"([A-Za-z]{3})\\\"\)/g,
      '.currency(code: "$1")'
    );

    // Common mistake: using `.accent` as a ShapeStyle/Color member; SwiftUI uses `.accentColor`.
    // Examples we fix: `.foregroundStyle(.accent)` / `.fill(.accent)` / `Color.accent`
    content = content.replace(/\.accent(?!Color)\b/g, ".accentColor");

    // Common mistake: passing a numeric string literal where a Double is expected.
    // Examples we fix: `ProgressView(value: "0.7", total: 1)` / `Gauge(value: "42", in: 0...100)`
    content = content.replace(
      /\b(ProgressView|Gauge)\(\s*value:\s*"(\d+(?:\.\d+)?)"\s*,/g,
      "$1(value: $2,"
    );

    return { ...f, content };
  });
}

/**
 * Apply rule-based fixes using the saved Swift files + build log/errors only (no LLM).
 * Returns { files, changed } so caller can decide whether to create a retry job.
 */
export function applyRuleBasedFixesFromBuild(
  files: SwiftTextFile[],
  compilerErrors: string[],
  logLines: string[]
): { files: SwiftTextFile[]; changed: boolean } {
  const combined = [...compilerErrors, ...logLines].join("\n");
  let result = fixSwiftCommonIssues(files);
  let changed = false;

  const hasImport = (content: string, mod: string) =>
    new RegExp(`import\\s+${mod}\\b`).test(content);

  const appFile = () =>
    result.find((f) => f.path === "App.swift" || f.path.endsWith("/App.swift")) ?? result[0];

  // Add missing UIKit if the build log says it's needed
  if (/Cannot find 'UIKit' in scope|'UIKit' in scope/i.test(combined)) {
    const f = appFile();
    if (f && !hasImport(f.content, "UIKit")) {
      const newContent = f.content.startsWith("import ") ? "import UIKit\n" + f.content : "import UIKit\n" + f.content;
      result = result.map((p) => (p.path === f.path ? { ...p, content: newContent } : p));
      changed = true;
    }
  }

  // Add missing SwiftUI if referenced
  if (/Cannot find 'SwiftUI' in scope|'SwiftUI' in scope/i.test(combined)) {
    const f = appFile();
    if (f && !hasImport(f.content, "SwiftUI")) {
      const newContent = f.content.startsWith("import ") ? "import SwiftUI\n" + f.content : "import SwiftUI\n" + f.content;
      result = result.map((p) => (p.path === f.path ? { ...p, content: newContent } : p));
      changed = true;
    }
  }

  // Add missing Foundation if referenced
  if (/Cannot find 'Foundation' in scope|'Foundation' in scope/i.test(combined)) {
    const f = appFile();
    if (f && !hasImport(f.content, "Foundation")) {
      const newContent = f.content.startsWith("import ") ? "import Foundation\n" + f.content : "import Foundation\n" + f.content;
      result = result.map((p) => (p.path === f.path ? { ...p, content: newContent } : p));
      changed = true;
    }
  }

  if (!changed) {
    const before = files.map((f) => f.content).join("\n");
    const after = result.map((f) => f.content).join("\n");
    changed = before !== after;
  }

  return { files: result, changed };
}

