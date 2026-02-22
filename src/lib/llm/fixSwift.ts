export type SwiftTextFile = { path: string; content: string };

/**
 * Best-effort fixes for common, safe-to-repair SwiftUI compile issues in LLM output.
 * Applied to every file both during initial generation and after auto-fix.
 */
export function fixSwiftCommonIssues(files: SwiftTextFile[]): SwiftTextFile[] {
  return files.map((f) => {
    if (!f?.path?.endsWith(".swift") || typeof f.content !== "string") return f;

    let content = f.content;

    if (!content.includes("@Bindable")) {
      content = content.replace(/\$viewModel(?!\.)/g, "viewModel");
    }

    content = content.replace(
      /\.currency\(code:\s*\\\"([A-Za-z]{3})\\\"\)/g,
      '.currency(code: "$1")'
    );

    content = content.replace(/\.accent(?!Color)\b/g, ".accentColor");

    content = content.replace(
      /\b(ProgressView|Gauge)\(\s*value:\s*"(\d+(?:\.\d+)?)"\s*,/g,
      "$1(value: $2,"
    );

    const usesSwiftUI = /\b(Color|LinearGradient|RoundedRectangle|Circle|Rectangle|Text|Image|Button|List|NavigationStack|NavigationView|Form|VStack|HStack|ZStack|ScrollView|ForEach|Group|Section|TabView|NavigationLink|Spacer|Divider|Toggle|Slider|Picker|DatePicker|ProgressView|Gauge|Chart|BarMark|LineMark|AreaMark|PointMark|View|some View|@State|@Binding|@Environment|@StateObject|@ObservedObject|@Published|@Observable|@AppStorage|GeometryReader|LazyVGrid|LazyHGrid|GridItem|Sheet|Alert|ToolbarItem)\b/.test(content);
    if (usesSwiftUI && !content.includes("import SwiftUI")) {
      content = "import SwiftUI\n" + content;
    }

    const usesFoundation = /\b(Date|UUID|JSONDecoder|JSONEncoder|UserDefaults|FileManager|Data|URL|URLSession|Timer|Calendar|DateFormatter|NumberFormatter|Locale|TimeZone|NotificationCenter|Bundle)\b/.test(content);
    if (usesFoundation && !content.includes("import Foundation") && !content.includes("import SwiftUI")) {
      content = "import Foundation\n" + content;
    }

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

  const addImportToFile = (file: SwiftTextFile, mod: string): SwiftTextFile => ({
    ...file,
    content: `import ${mod}\n${file.content}`,
  });

  const fileByErrorPath = (errorPath: string): SwiftTextFile | undefined => {
    const base = errorPath.split("/").pop() ?? errorPath;
    return result.find(
      (f) => f.path === errorPath || f.path.endsWith(`/${base}`) || f.path.split("/").pop() === base
    );
  };

  const fileRe = /([A-Za-z0-9_/]+\.swift):\d+/g;
  let match: RegExpExecArray | null;
  const filesNeedingSwiftUI = new Set<string>();
  const filesNeedingFoundation = new Set<string>();

  for (const err of [...compilerErrors, ...logLines]) {
    while ((match = fileRe.exec(err)) !== null) {
      const filePath = match[1];
      if (/Cannot find.*(Color|View|Text|Image|Button|NavigationStack|List|VStack|HStack|Form|Toggle|Slider|Picker|ProgressView|ScrollView|ForEach|Group|Section|Spacer|Divider|Rectangle|Circle|RoundedRectangle|LinearGradient|State|Binding|Environment|StateObject|ObservedObject)/i.test(err)) {
        filesNeedingSwiftUI.add(filePath);
      }
      if (/Cannot find.*(Date|UUID|UserDefaults|Data|URL|Timer|Calendar|FileManager)/i.test(err)) {
        filesNeedingFoundation.add(filePath);
      }
    }
    fileRe.lastIndex = 0;
  }

  for (const path of filesNeedingSwiftUI) {
    const file = fileByErrorPath(path);
    if (file && !hasImport(file.content, "SwiftUI")) {
      result = result.map((f) => f.path === file.path ? addImportToFile(f, "SwiftUI") : f);
      changed = true;
    }
  }

  for (const path of filesNeedingFoundation) {
    const file = fileByErrorPath(path);
    if (file && !hasImport(file.content, "Foundation") && !hasImport(file.content, "SwiftUI")) {
      result = result.map((f) => f.path === file.path ? addImportToFile(f, "Foundation") : f);
      changed = true;
    }
  }

  if (/Cannot find 'UIKit' in scope/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "UIKit") && /UIKit|UIColor|UIFont|UIImage|UIApplication/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "UIKit") : f);
        changed = true;
      }
    }
  }

  if (!changed) {
    const before = files.map((f) => f.content).join("\n");
    const after = result.map((f) => f.content).join("\n");
    changed = before !== after;
  }

  return { files: result, changed };
}
