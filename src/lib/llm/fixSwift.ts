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

    // Avoid plain black or flat-color full-screen backgrounds (looks unfinished in dark mode).
    // Use systemGray4 → secondarySystemBackground so in dark mode the top is visibly gray (#3A3A3C)
    // not pure black; in light mode it adapts to a soft light gradient.
    const GRADIENT_BG = "LinearGradient(colors: [Color(.systemGray4), Color(.secondarySystemBackground)], startPoint: .top, endPoint: .bottom)";
    content = content.replace(/\.background\s*\(\s*Color\.black\s*\)/g, `.background(${GRADIENT_BG})`);
    content = content.replace(/\.background\s*\{\s*Color\.black\s*\}/g, `.background { ${GRADIENT_BG} }`);
    content = content.replace(/ZStack\s*\{\s*Color\.black\b/g, `ZStack { ${GRADIENT_BG}`);
    content = content.replace(/\bColor\.black\b(\s*\.ignoresSafeArea\s*\(\s*\))/g, `${GRADIENT_BG}$1`);
    // Also fix ZStack { Color(.systemBackground).ignoresSafeArea() — still looks black in dark mode
    content = content.replace(
      /ZStack\s*\{\s*Color\(\s*\.systemBackground\s*\)\s*\.ignoresSafeArea\s*\(\s*\)/g,
      `ZStack { ${GRADIENT_BG}.ignoresSafeArea()`
    );

    const usesFoundation = /\b(Date|UUID|JSONDecoder|JSONEncoder|UserDefaults|FileManager|Data|URL|URLSession|Timer|Calendar|DateFormatter|NumberFormatter|Locale|TimeZone|NotificationCenter|Bundle)\b/.test(content);
    if (usesFoundation && !content.includes("import Foundation") && !content.includes("import SwiftUI")) {
      content = "import Foundation\n" + content;
    }

    content = content.replace(/\bNavigationView\b/g, "NavigationStack");

    content = content.replace(/\.navigationBarTitle\b/g, ".navigationTitle");

    content = content.replace(/\.foregroundColor\b/g, ".foregroundStyle");

    content = content.replace(
      /NSAttributedString\.Key\.foregroundStyle\b/g,
      "NSAttributedString.Key.foregroundColor"
    );
    content = content.replace(
      /NSAttributedString\.Key\.fontStyle\b/g,
      "NSAttributedString.Key.font"
    );
    content = content.replace(
      /NSAttributedString\.Key\.backgroundStyle\b/g,
      "NSAttributedString.Key.backgroundColor"
    );

    content = content.replace(
      /\bTheme\.accentColor\b/g,
      "Color.accentColor"
    );
    // HapticPattern, BeatPattern, and other types have no member 'accentColor' — use Color.accentColor
    content = content.replace(
      /\b(HapticPattern|BeatPattern)\.accentColor\b/g,
      "Color.accentColor"
    );
    // ShapeStyle has no member 'accentColor' — use Color.accentColor (e.g. in .foregroundStyle, .tint, .fill)
    content = content.replace(
      /(?<!Color\.)\.accentColor\b/g,
      "Color.accentColor"
    );

    // LLM typo: "Color" or "color" repeated → ColorColorColor / colorcolorcolor (cannot find in scope). Fix to Color.
    content = content.replace(/\bColorColorColor\b/g, "Color");
    content = content.replace(/\bColorColor\b/g, "Color");
    content = content.replace(/\bcolorcolorcolor\b/g, "Color");
    content = content.replace(/\bcolorcolor\b/g, "Color");

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

    const usesStoreKit = /\b(SubscriptionStoreView|StoreKit\.Transaction|Product\.SubscriptionInfo|import StoreKit)\b/.test(content);
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

    const usesWidgetKit = /\b(TimelineProvider|TimelineEntry|WidgetConfiguration|StaticConfiguration|AppIntentConfiguration|WidgetFamily|WidgetBundle|Widget\b(?!Extension))\b/.test(content);
    if (usesWidgetKit && !content.includes("import WidgetKit")) {
      content = "import WidgetKit\n" + content;
    }

    const usesActivityKit = /\b(Activity<|ActivityAttributes|ActivityContent|ActivityConfiguration)\b/.test(content);
    if (usesActivityKit && !content.includes("import ActivityKit")) {
      content = "import ActivityKit\n" + content;
    }

    const usesARKit = /\b(ARSession|ARWorldTrackingConfiguration|ARPlaneAnchor|ARRaycastResult|ARSCNView|ARAnchor|ARFrame)\b/.test(content);
    if (usesARKit && !content.includes("import ARKit")) {
      content = "import ARKit\n" + content;
    }

    const usesRealityKit = /\b(ARView|AnchorEntity|ModelEntity|Entity|RealityKit|SimpleMaterial)\b/.test(content);
    if (usesRealityKit && !content.includes("import RealityKit")) {
      content = "import RealityKit\n" + content;
    }

    const usesHealthKit = /\b(HKHealthStore|HKQuantityType|HKSampleQuery|HKStatisticsQuery|HKWorkout|HKUnit|HKObjectType)\b/.test(content);
    if (usesHealthKit && !content.includes("import HealthKit")) {
      content = "import HealthKit\n" + content;
    }

    const usesShazamKit = /\b(SHSession|SHManagedSession|SHMatch|SHMediaItem|SHSignature|SHCatalog)\b/.test(content);
    if (usesShazamKit && !content.includes("import ShazamKit")) {
      content = "import ShazamKit\n" + content;
    }

    const usesMusicKit = /\b(ApplicationMusicPlayer|MusicCatalogSearchRequest|MusicLibraryRequest|MusicPersonalRecommendationsRequest|MusicItem\b|MusicKit\.|MusicLibrary\b)\b/.test(content);
    if (usesMusicKit && !content.includes("import MusicKit")) {
      content = "import MusicKit\n" + content;
    }
    // iOS MusicKit: never show "Failed to request developer token" to the user (wrong concept on iOS).
    if (usesMusicKit && /Failed to request developer token|developer token|developerToken/i.test(content)) {
      content = content.replace(/Failed to request developer token/gi, "Could not access Apple Music");
    }
    // Sanitize runtime error display: Apple's API can return "Failed to request developer token"; don't show that.
    if (usesMusicKit) {
      content = content.replace(
        /\berror\.localizedDescription\b/g,
        '(error.localizedDescription.contains("developer token") ? "Could not access Apple Music" : error.localizedDescription)'
      );
    }

    const usesSoundAnalysis = /\b(SNAudioStreamAnalyzer|SNClassifySoundRequest|SNClassificationResult|SNResultsObserving|SNRequest)\b/.test(content);
    if (usesSoundAnalysis && !content.includes("import SoundAnalysis")) {
      content = "import SoundAnalysis\n" + content;
    }

    const usesVisionKit = /\b(DataScannerViewController|VNDocumentCameraViewController)\b/.test(content);
    if (usesVisionKit && !content.includes("import VisionKit")) {
      content = "import VisionKit\n" + content;
    }

    const usesUIKit = /\b(UIView\b|UIViewController|UIColor|UIFont|UIImage|UIApplication|UIViewRepresentable|UIViewControllerRepresentable|UITapGestureRecognizer|UIPasteboard|UIScreen|UIActivityViewController)\b/.test(content);
    if (usesUIKit && !content.includes("import UIKit") && !content.includes("import SwiftUI")) {
      content = "import UIKit\n" + content;
    }

    // @Published requires Combine; unknown attribute 'Published' means missing import Combine
    const usesCombine = /\b(@Published|PassthroughSubject|CurrentValueSubject|AnyCancellable|\.sink\(|\.assign\(|Publishers\.)\b/.test(content);
    if (usesCombine && !content.includes("import Combine")) {
      content = "import Combine\n" + content;
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

    // Weather proxy returns units=imperial (Fahrenheit, mph). Remove any temperature conversion so we display raw value.
    content = content.replace(/\s*-\s*273\.15\s*\)\s*\*\s*9\s*\/\s*5\s*\+\s*32/g, ")");
    content = content.replace(/\s*-\s*273\.15\s*\)/g, ")"); // (x - 273.15) used as Celsius → use value as-is (proxy sends Fahrenheit)
    content = content.replace(/\s*-\s*273\.15\b/g, ""); // e.g. "let celsius = kelvin - 273.15" → "let celsius = kelvin" (value is already F)
    content = content.replace(/\s*-\s*273\b(?!\.\d)/g, ""); // integer Kelvin: - 273 (not 273.15) → remove
    content = content.replace(/\bcelsius\s*\*\s*9\s*\/\s*5\s*\+\s*32\b/g, "celsius"); // Celsius→F formula: use value as-is
    content = content.replace(/\bcelsius\s*\*\s*1\.8\s*\+\s*32\b/g, "celsius"); // same, 1.8 variant
    content = content.replace(/\bfahrenheit\s*=\s*celsius\s*\*\s*9\s*\/\s*5\s*\+\s*32\b/g, "fahrenheit = celsius");
    content = content.replace(/\bfahrenheit\s*=\s*celsius\s*\*\s*1\.8\s*\+\s*32\b/g, "fahrenheit = celsius");
    content = content.replace(/\bf\s*=\s*celsius\s*\*\s*9\s*\/\s*5\s*\+\s*32\b/g, "f = celsius");
    content = content.replace(/\bf\s*=\s*celsius\s*\*\s*1\.8\s*\+\s*32\b/g, "f = celsius");
    // main.temp / .temp from API — remove * 9/5 + 32 or * 1.8 + 32
    content = content.replace(/(\w*(?:\.main)?\?\.temp|main\.temp)\s*\*\s*(9\s*\/\s*5|1\.8)\s*\+\s*32/g, "$1");
    content = content.replace(/\btemp\s*\*\s*(9\s*\/\s*5|1\.8)\s*\+\s*32\b/g, "temp");
    content = content.replace(/\bkelvin\s*\*\s*9\s*\/\s*5\s*\+\s*32\b/g, "kelvin");
    content = content.replace(/\bkelvin\s*\*\s*1\.8\s*\+\s*32\b/g, "kelvin");
    content = content.replace(/value:\s*celsius,\s*unit:\s*UnitTemperature\.celsius/g, "value: celsius, unit: UnitTemperature.fahrenheit"); // celsius now holds F
    content = content.replace(/Measurement\(\s*value:\s*celsius\s*\*\s*9\s*\/\s*5\s*\+\s*32\s*,\s*unit:\s*UnitTemperature\.fahrenheit\s*\)/g, "Measurement(value: celsius, unit: UnitTemperature.fahrenheit)");
    content = content.replace(/Measurement\(\s*value:\s*celsius\s*\*\s*1\.8\s*\+\s*32\s*,\s*unit:\s*UnitTemperature\.fahrenheit\s*\)/g, "Measurement(value: celsius, unit: UnitTemperature.fahrenheit)");
    content = content.replace(/UnitTemperature\.kelvin/g, "UnitTemperature.fahrenheit");

    // Fallback location: avoid hardcoding a specific city (e.g. San Jose). Use skill standard so "Current Location" / API name is generic when location fails.
    content = content.replace(/\bkFallbackLat\s*=\s*37\.3382\b/g, "kFallbackLat = 32.78");
    content = content.replace(/\bkFallbackLon\s*=\s*-121\.8863\b/g, "kFallbackLon = -79.93");

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

  if (/cannot find type 'UIView' in scope|cannot find type 'UIViewController' in scope|cannot find 'UIColor'/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "UIKit") && /\b(UIView\b|UIViewController|UIColor|UIViewRepresentable|UIViewControllerRepresentable|UITapGestureRecognizer)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "UIKit") : f);
        changed = true;
      }
    }
  }

  if (/Cannot find.*(ARView|AnchorEntity|ModelEntity|ARWorldTrackingConfiguration)/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "RealityKit") && /\b(ARView|AnchorEntity|ModelEntity|Entity)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "RealityKit") : f);
        changed = true;
      }
      if (!hasImport(file.content, "ARKit") && /\b(ARSession|ARWorldTrackingConfiguration|ARPlaneAnchor)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "ARKit") : f);
        changed = true;
      }
    }
  }

  if (/Cannot find.*(HKHealthStore|HKQuantityType|HKSampleQuery)/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "HealthKit") && /\b(HKHealthStore|HKQuantityType|HKSampleQuery|HKWorkout)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "HealthKit") : f);
        changed = true;
      }
    }
  }

  if (/Cannot find.*(TimelineProvider|TimelineEntry|WidgetConfiguration|StaticConfiguration)/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "WidgetKit") && /\b(TimelineProvider|TimelineEntry|WidgetConfiguration|StaticConfiguration)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "WidgetKit") : f);
        changed = true;
      }
    }
  }

  if (/Cannot find type '.*Intent' in scope/i.test(combined)) {
    for (const file of result) {
      if (file.path.startsWith("WidgetExtension/") && !hasImport(file.content, "AppIntents") && /\b(AppIntent|WidgetConfigurationIntent|AppIntentConfiguration|AppIntentTimelineProvider)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "AppIntents") : f);
        changed = true;
      }
    }
  }

  if (/Cannot find.*(Activity<|ActivityAttributes|ActivityContent)/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "ActivityKit") && /\b(Activity<|ActivityAttributes|ActivityContent|ActivityConfiguration)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "ActivityKit") : f);
        changed = true;
      }
    }
  }

  if (/Cannot find.*(SHSession|SHManagedSession|SHMatch|SHMediaItem)/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "ShazamKit") && /\b(SHSession|SHManagedSession|SHMatch|SHMediaItem)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "ShazamKit") : f);
        changed = true;
      }
    }
  }

  if (/Cannot find.*(SNAudioStreamAnalyzer|SNClassifySoundRequest|SNClassificationResult)/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "SoundAnalysis") && /\b(SNAudioStreamAnalyzer|SNClassifySoundRequest|SNClassificationResult)\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "SoundAnalysis") : f);
        changed = true;
      }
    }
  }

  if (/Cannot find.*(DataScannerViewController)/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "VisionKit") && /\bDataScannerViewController\b/.test(file.content)) {
        result = result.map((f) => f.path === file.path ? addImportToFile(f, "VisionKit") : f);
        changed = true;
      }
    }
  }

  // unknown attribute 'Published' — @Published requires import Combine
  if (/unknown attribute ['"]Published['"]/i.test(combined)) {
    for (const file of result) {
      if (!hasImport(file.content, "Combine") && /@Published\b/.test(file.content)) {
        result = result.map((f) => (f.path === file.path ? addImportToFile(f, "Combine") : f));
        changed = true;
      }
    }
  }

  // cannot find type 'Context' in scope — UIViewRepresentable/WidgetKit provide Context; need SwiftUI or WidgetKit
  if (/cannot find type ['"]Context['"] in scope/i.test(combined)) {
    for (const file of result) {
      if (/\b(makeUIView|updateUIView)\s*\([^)]*context:\s*Context\b/.test(file.content) && !hasImport(file.content, "SwiftUI")) {
        result = result.map((f) => (f.path === file.path ? addImportToFile(f, "SwiftUI") : f));
        changed = true;
      }
      if (/\b(TimelineProvider|getSnapshot|getTimeline)\b.*Context\b/.test(file.content) && !hasImport(file.content, "WidgetKit")) {
        result = result.map((f) => (f.path === file.path ? addImportToFile(f, "WidgetKit") : f));
        changed = true;
      }
    }
  }

  // cannot find 'ColorColorColor' in scope — LLM repeated "Color"; fix to Color
  if (/cannot find ['"]?ColorColorColor['"]? in scope/i.test(combined)) {
    result = result.map((f) =>
      f.content.includes("ColorColorColor")
        ? { ...f, content: f.content.replace(/\bColorColorColor\b/g, "Color") }
        : f
    );
    changed = true;
  }

  for (const file of result) {
    let c = file.content;
    let fileChanged = false;

    // AsyncStream is AsyncSequence — use "for await" not "for"
    if (/for\s+(\w+)\s+in\s+\w+\.recognizedItems\b/.test(c) && !/for\s+await\s/.test(c)) {
      c = c.replace(/for\s+(\w+)\s+in\s+(\w+\.recognizedItems)\b/g, "for await $1 in $2");
      fileChanged = true;
    }

    if (fileChanged) {
      result = result.map((f) => f.path === file.path ? { ...f, content: c } : f);
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
