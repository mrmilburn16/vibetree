export type SwiftFile = { path: string; content: string };

export type LintWarning = {
  file: string;
  line?: number;
  message: string;
  severity: "error" | "warning";
  autoFixed: boolean;
};

export type LintResult = {
  files: SwiftFile[];
  warnings: LintWarning[];
  autoFixCount: number;
};

/**
 * Pre-build lint: checks for common structural issues in Swift files
 * and auto-fixes what it can. Call before xcodebuild to catch errors early.
 */
export function preBuildLint(files: SwiftFile[]): LintResult {
  const warnings: LintWarning[] = [];
  let autoFixCount = 0;
  const result = [...files.map(f => ({ ...f }))];

  for (const f of result) {
    if (!f.path.endsWith(".swift")) continue;
    const usesSwiftUI = /\b(View|Text|Button|List|NavigationStack|VStack|HStack|ZStack|ScrollView|Form|Toggle|Slider|Picker|Image|Color|@State|@Binding|@Observable|@Environment|some View)\b/.test(f.content);
    if (usesSwiftUI && !f.content.includes("import SwiftUI")) {
      f.content = "import SwiftUI\n" + f.content;
      warnings.push({ file: f.path, message: "Missing 'import SwiftUI' — auto-added", severity: "error", autoFixed: true });
      autoFixCount++;
    }
  }

  for (const f of result) {
    if (f.path !== "App.swift" && !f.path.endsWith("/App.swift")) continue;
    if (f.content.includes(": App") && !f.content.includes("@main")) {
      f.content = f.content.replace(/(struct\s+\w+\s*:\s*App\b)/, "@main\n$1");
      warnings.push({ file: f.path, message: "Missing @main on App struct — auto-added", severity: "error", autoFixed: true });
      autoFixCount++;
    }
  }

  for (const f of result) {
    if (f.path !== "App.swift" && !f.path.endsWith("/App.swift")) continue;
    if (f.content.includes(": App") && !f.content.includes("WindowGroup")) {
      warnings.push({ file: f.path, message: "App struct has no WindowGroup — app will not display any content. Needs manual fix.", severity: "error", autoFixed: false });
    }
  }

  for (const f of result) {
    if (!f.path.endsWith(".swift")) continue;
    const hasNavLink = /\bNavigationLink\b/.test(f.content);
    const hasNavStack = /\bNavigationStack\b/.test(f.content);
    const hasNavView = /\bNavigationView\b/.test(f.content);
    const isView = /var\s+body\s*:\s*some\s+View/.test(f.content);
    if (hasNavLink && !hasNavStack && !hasNavView && isView) {
      const viewName = f.path.replace(/\.swift$/, "").split("/").pop() ?? "";
      const otherFileWraps = result.some(other =>
        other.path !== f.path &&
        other.content.includes("NavigationStack") &&
        other.content.includes(viewName)
      );
      if (!otherFileWraps) {
        warnings.push({ file: f.path, message: "NavigationLink found but no NavigationStack wrapper detected. Navigation may not work.", severity: "warning", autoFixed: false });
      }
    }
  }

  for (const f of result) {
    if (!f.path.endsWith(".swift")) continue;
    const emptyActionRe = /Button\s*\([^)]*\)\s*\{\s*\}/g;
    let match;
    while ((match = emptyActionRe.exec(f.content)) !== null) {
      const lineNum = f.content.substring(0, match.index).split("\n").length;
      warnings.push({ file: f.path, line: lineNum, message: "Button with empty action { } — button does nothing when tapped", severity: "warning", autoFixed: false });
    }
  }

  for (const f of result) {
    if (!f.path.endsWith(".swift")) continue;
    if (/\bGeometryReader\b/.test(f.content)) {
      warnings.push({ file: f.path, message: "GeometryReader detected — can cause layout issues; verify it's necessary", severity: "warning", autoFixed: false });
    }
  }

  for (const f of result) {
    if (!f.path.endsWith(".swift")) continue;
    if (/UIScreen\.main\.bounds/.test(f.content)) {
      warnings.push({ file: f.path, message: "UIScreen.main.bounds used — prefer GeometryReader or .frame(maxWidth: .infinity)", severity: "warning", autoFixed: false });
    }
  }

  for (const f of result) {
    if (!f.path.endsWith(".swift")) continue;
    const navStackCount = (f.content.match(/\bNavigationStack\b/g) || []).length;
    if (navStackCount > 1) {
      warnings.push({ file: f.path, message: `Multiple NavigationStack declarations (${navStackCount}) in one file — may cause nested navigation bugs`, severity: "warning", autoFixed: false });
    }
  }

  for (const f of result) {
    if (!f.path.endsWith(".swift")) continue;
    if (!/\b(struct|class|enum|protocol|extension|func)\b/.test(f.content)) {
      warnings.push({ file: f.path, message: "File has no type declarations — may be empty or incomplete", severity: "warning", autoFixed: false });
    }
  }

  return { files: result, warnings, autoFixCount };
}
