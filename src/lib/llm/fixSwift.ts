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

    content = content.replace(/\bNavigationView\b/g, "NavigationStack");

    content = content.replace(/\.navigationBarTitle\b/g, ".navigationTitle");

    content = content.replace(/\.foregroundColor\b/g, ".foregroundStyle");

    const usesCharts = /\b(Chart|BarMark|LineMark|AreaMark|PointMark|RuleMark|SectorMark)\b/.test(content);
    if (usesCharts && !content.includes("import Charts")) {
      content = "import Charts\n" + content;
    }

    const usesMapKit = /\b(Map\s*\(|MKCoordinateRegion|MapAnnotation|MapMarker|MapPolyline|MapCircle|CLLocationCoordinate2D)\b/.test(content);
    if (usesMapKit && !content.includes("import MapKit")) {
      content = "import MapKit\n" + content;
    }

    const usesAV = /\b(AVPlayer|AVAudioPlayer|AVAudioSession|AVAudioRecorder|AVAudioEngine|AVCaptureSession)\b/.test(content);
    if (usesAV && !content.includes("import AVFoundation")) {
      content = "import AVFoundation\n" + content;
    }

    const usesStoreKit = /\b(Product|Transaction|StoreKit|SubscriptionStoreView)\b/.test(content);
    if (usesStoreKit && !content.includes("import StoreKit")) {
      content = "import StoreKit\n" + content;
    }

    const usesCoreLocation = /\b(CLLocationManager|CLLocation|CLGeocoder|CLPlacemark)\b/.test(content);
    if (usesCoreLocation && !content.includes("import CoreLocation") && !content.includes("import MapKit")) {
      content = "import CoreLocation\n" + content;
    }

    const usesUserNotifications = /\b(UNUserNotificationCenter|UNMutableNotificationContent|UNNotificationRequest)\b/.test(content);
    if (usesUserNotifications && !content.includes("import UserNotifications")) {
      content = "import UserNotifications\n" + content;
    }

    const importRe = /^import\s+\w+$/gm;
    const seenImports = new Set<string>();
    content = content.replace(importRe, (match) => {
      if (seenImports.has(match)) return "";
      seenImports.add(match);
      return match;
    });
    content = content.replace(/\n{3,}/g, "\n\n");

    if (f.path === "App.swift" || f.path.endsWith("/App.swift")) {
      if (content.includes("struct") && content.includes(": App") && !content.includes("@main")) {
        content = content.replace(/(struct\s+\w+\s*:\s*App\b)/, "@main\n$1");
      }
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

  if (/Cannot find.*(Chart|BarMark|LineMark|AreaMark|PointMark)/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "Charts") && /\b(Chart|BarMark|LineMark|AreaMark|PointMark)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "Charts") : f);
        changed = true;
      }
    }
  }

  if (/Cannot find.*(Map|MKCoordinateRegion|MapAnnotation)/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "MapKit") && /\b(Map\s*\(|MKCoordinateRegion|MapAnnotation)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "MapKit") : f);
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
