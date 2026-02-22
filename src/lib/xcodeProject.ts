/**
 * Generate a minimal Xcode project (project.pbxproj) and file list for a set of Swift files.
 * Used by export-xcode to produce a zip that opens in Xcode and builds to iPhone.
 */

import crypto from "crypto";

function xcodeId(): string {
  return Buffer.from(crypto.randomBytes(12)).toString("hex").toUpperCase();
}

export interface SwiftFile {
  path: string;
  content: string;
}

export interface BuildPbxprojOptions {
  projectName: string;
  bundleId: string;
  deploymentTarget: string;
  /** If provided, avoids Xcode “Pick a Team” on first open. */
  developmentTeam: string;
  /**
   * When present, generate a Widget Extension target (used for Live Activities UI).
   * The exporter is responsible for including `infoPlistPath` in the `paths` list.
   */
  widget: {
    name: string;
    bundleId: string;
    swiftPaths: string[];
    infoPlistPath: string;
  };
  /**
   * Which Swift files should compile in the main app target.
   * Defaults to all `.swift` paths excluding `widget.swiftPaths`.
   */
  appSwiftPaths: string[];
  /**
   * Privacy permission keys to inject into the auto-generated Info.plist.
   * Keys are Info.plist keys (e.g. "NSCameraUsageDescription"),
   * values are the user-facing usage strings.
   */
  privacyPermissions: Record<string, string>;
}

interface PrivacyRule {
  patterns: RegExp[];
  key: string;
  description: string;
}

const PRIVACY_RULES: PrivacyRule[] = [
  {
    patterns: [/\bAVCaptureSession\b/, /\bAVCaptureDevice\b/, /\.camera\b/, /\bCaptureSession\b/],
    key: "NSCameraUsageDescription",
    description: "This app uses the camera for its features.",
  },
  {
    patterns: [/\bAVAudioSession\b/, /\bAVAudioRecorder\b/, /\bAVAudioEngine\b/, /\.microphone\b/],
    key: "NSMicrophoneUsageDescription",
    description: "This app uses the microphone for audio input.",
  },
  {
    patterns: [/\bPHPhotoLibrary\b/, /\bPHPickerViewController\b/, /\bUIImagePickerController\b/, /\bPHPickerConfiguration\b/],
    key: "NSPhotoLibraryUsageDescription",
    description: "This app accesses your photo library.",
  },
  {
    patterns: [/\bCLLocationManager\b/, /\bCoreLocation\b/, /\blocationManager\b/],
    key: "NSLocationWhenInUseUsageDescription",
    description: "This app uses your location while in use.",
  },
  {
    patterns: [/\bCNContactStore\b/, /\bimport Contacts\b/],
    key: "NSContactsUsageDescription",
    description: "This app accesses your contacts.",
  },
  {
    patterns: [/\bEKEventStore\b/, /\bimport EventKit\b/],
    key: "NSCalendarsUsageDescription",
    description: "This app accesses your calendar.",
  },
  {
    patterns: [/\bHKHealthStore\b/, /\bimport HealthKit\b/],
    key: "NSHealthShareUsageDescription",
    description: "This app reads your health data.",
  },
  {
    patterns: [/\bLAContext\b/, /\bbiometricType\b/, /\bFaceID\b/],
    key: "NSFaceIDUsageDescription",
    description: "This app uses Face ID for authentication.",
  },
  {
    patterns: [/\bSFSpeechRecognizer\b/, /\bimport Speech\b/],
    key: "NSSpeechRecognitionUsageDescription",
    description: "This app uses speech recognition.",
  },
  {
    patterns: [/\bCBCentralManager\b/, /\bCBPeripheralManager\b/, /\bimport CoreBluetooth\b/],
    key: "NSBluetoothAlwaysUsageDescription",
    description: "This app uses Bluetooth.",
  },
  {
    patterns: [/\bCMMotionManager\b/, /\bimport CoreMotion\b/],
    key: "NSMotionUsageDescription",
    description: "This app uses motion and fitness data.",
  },
  {
    patterns: [/\bNFCTagReaderSession\b/, /\bimport CoreNFC\b/],
    key: "NFCReaderUsageDescription",
    description: "This app uses NFC.",
  },
];

/**
 * Scan Swift file contents for privacy-sensitive API usage and return
 * the required Info.plist permission keys with default descriptions.
 */
export function detectPrivacyPermissions(
  files: SwiftFile[]
): Record<string, string> {
  const result: Record<string, string> = {};
  const combined = files.map((f) => f.content).join("\n");

  for (const rule of PRIVACY_RULES) {
    if (result[rule.key]) continue;
    for (const pattern of rule.patterns) {
      if (pattern.test(combined)) {
        result[rule.key] = rule.description;
        break;
      }
    }
  }

  return result;
}

/**
 * Build project.pbxproj content for the given Swift file paths.
 * Paths are relative (e.g. "App.swift", "ContentView.swift", "Models/Item.swift").
 */
export function buildPbxproj(
  paths: string[],
  options?: Partial<BuildPbxprojOptions>
): string {
  const projectName = options?.projectName ?? "VibetreeApp";
  const bundleId = options?.bundleId ?? "com.vibetree.app";
  const deploymentTarget = options?.deploymentTarget ?? "17.0";
  const developmentTeam = (options?.developmentTeam ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const developmentTeamLine = developmentTeam
    ? `\t\t\t\tDEVELOPMENT_TEAM = ${developmentTeam};\n`
    : "";

  const widget = options?.widget;
  const usesWidgetTarget =
    Boolean(widget) &&
    Array.isArray(widget?.swiftPaths) &&
    widget!.swiftPaths.length > 0 &&
    typeof widget!.infoPlistPath === "string" &&
    widget!.infoPlistPath.length > 0 &&
    paths.includes(widget!.infoPlistPath);

  const widgetName = usesWidgetTarget ? widget!.name : "";
  // Embedded extension bundle ID must be prefixed with the parent app's bundle ID (Apple requirement).
  const widgetBundleId = usesWidgetTarget ? `${bundleId}.widget` : "";
  const widgetInfoPlistPath = usesWidgetTarget ? widget!.infoPlistPath : "";
  // INFOPLIST_FILE is resolved relative to project root (next to the .xcodeproj),
  // while our exported sources live under `${projectName}/...`.
  const widgetInfoPlistBuildSetting = usesWidgetTarget
    ? `${projectName}/${widgetInfoPlistPath}`
    : "";
  const widgetSwiftPaths = usesWidgetTarget
    ? widget!.swiftPaths.filter((p) => p.endsWith(".swift"))
    : [];

  const allSwiftPaths = paths.filter((p) => p.endsWith(".swift"));
  const appSwiftPaths =
    options?.appSwiftPaths?.length
      ? options.appSwiftPaths.filter((p) => p.endsWith(".swift"))
      : allSwiftPaths.filter((p) => !widgetSwiftPaths.includes(p));

  const supportsLiveActivitiesLine = usesWidgetTarget
    ? `\t\t\t\tINFOPLIST_KEY_NSSupportsLiveActivities = YES;\n`
    : "";

  const privacyPerms = options?.privacyPermissions ?? {};
  const privacyPermLines = Object.entries(privacyPerms)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, desc]) => `\t\t\t\tINFOPLIST_KEY_${key} = ${JSON.stringify(desc)};`)
    .join("\n");
  const privacyPermBlock = privacyPermLines ? `${privacyPermLines}\n` : "";

  const fileTypeForPath = (p: string): string => {
    if (p.endsWith(".swift")) return "sourcecode.swift";
    if (p.endsWith(".plist")) return "text.plist.xml";
    return "text";
  };

  const fileRefIds = new Map<string, string>();
  for (const p of paths) fileRefIds.set(p, xcodeId());

  const appBuildFileIds = new Map<string, string>();
  for (const p of appSwiftPaths) appBuildFileIds.set(p, xcodeId());
  const widgetBuildFileIds = new Map<string, string>();
  if (usesWidgetTarget) {
    for (const p of widgetSwiftPaths) widgetBuildFileIds.set(p, xcodeId());
  }

  const projectProductsAppId = xcodeId();
  const projectProductsWidgetId = usesWidgetTarget ? xcodeId() : "";

  const projectObjectId = xcodeId();
  const mainGroupId = xcodeId();
  const sourcesGroupId = xcodeId();

  const appTargetId = xcodeId();
  const appSourcesPhaseId = xcodeId();
  const appFrameworksPhaseId = xcodeId();
  const appResourcesPhaseId = xcodeId();
  const embedAppExtensionsPhaseId = usesWidgetTarget ? xcodeId() : "";

  const widgetTargetId = usesWidgetTarget ? xcodeId() : "";
  const widgetSourcesPhaseId = usesWidgetTarget ? xcodeId() : "";
  const widgetFrameworksPhaseId = usesWidgetTarget ? xcodeId() : "";
  const widgetResourcesPhaseId = usesWidgetTarget ? xcodeId() : "";

  const debugConfigProjectId = xcodeId();
  const releaseConfigProjectId = xcodeId();
  const debugConfigAppTargetId = xcodeId();
  const releaseConfigAppTargetId = xcodeId();
  const debugConfigWidgetTargetId = usesWidgetTarget ? xcodeId() : "";
  const releaseConfigWidgetTargetId = usesWidgetTarget ? xcodeId() : "";
  const configListProjectId = xcodeId();
  const configListAppTargetId = xcodeId();
  const configListWidgetTargetId = usesWidgetTarget ? xcodeId() : "";

  const fileRefLines = paths
    .map((p) => {
      const id = fileRefIds.get(p)!;
      const name = p.includes("/") ? p.split("/").pop()! : p;
      return `\t\t${id} /* ${name} */ = {isa = PBXFileReference; lastKnownFileType = ${fileTypeForPath(
        p
      )}; path = ${JSON.stringify(p)}; sourceTree = "<group>"; };`;
    })
    .join("\n");

  const buildFileLines: string[] = [];
  for (const p of appSwiftPaths) {
    const buildId = appBuildFileIds.get(p)!;
    const fileRefId = fileRefIds.get(p)!;
    const name = p.includes("/") ? p.split("/").pop()! : p;
    buildFileLines.push(
      `\t\t${buildId} /* ${name} in Sources */ = {isa = PBXBuildFile; fileRef = ${fileRefId} /* ${name} */; };`
    );
  }
  if (usesWidgetTarget) {
    for (const p of widgetSwiftPaths) {
      const buildId = widgetBuildFileIds.get(p)!;
      const fileRefId = fileRefIds.get(p)!;
      const name = p.includes("/") ? p.split("/").pop()! : p;
      buildFileLines.push(
        `\t\t${buildId} /* ${name} in Sources (Widget) */ = {isa = PBXBuildFile; fileRef = ${fileRefId} /* ${name} */; };`
      );
    }
  }

  const embedWidgetBuildFileId = usesWidgetTarget ? xcodeId() : "";
  if (usesWidgetTarget) {
    buildFileLines.push(
      `\t\t${embedWidgetBuildFileId} /* ${widgetName}.appex in Embed App Extensions */ = {isa = PBXBuildFile; fileRef = ${projectProductsWidgetId} /* ${widgetName}.appex */; settings = {ATTRIBUTES = (RemoveHeadersOnCopy, );}; };`
    );
  }

  const appSourcesPhaseFiles = appSwiftPaths
    .map((p) => appBuildFileIds.get(p)!)
    .map((id) => `\t\t\t\t${id}`)
    .join(",\n");

  const widgetSourcesPhaseFiles = usesWidgetTarget
    ? widgetSwiftPaths
        .map((p) => widgetBuildFileIds.get(p)!)
        .map((id) => `\t\t\t\t${id}`)
        .join(",\n")
    : "";

  const groupChildren = paths
    .map((p) => {
      const id = fileRefIds.get(p)!;
      const name = p.includes("/") ? p.split("/").pop()! : p;
      return `\t\t\t\t${id} /* ${name} */`;
    })
    .join(",\n");

  const widgetFileRefLine = usesWidgetTarget
    ? `\t\t${projectProductsWidgetId} /* ${widgetName}.appex */ = {isa = PBXFileReference; explicitFileType = wrapper.app-extension; includeInIndex = 0; path = ${JSON.stringify(
        `${widgetName}.appex`
      )}; sourceTree = BUILT_PRODUCTS_DIR; };`
    : "";

  const widgetNativeTargetBlock = usesWidgetTarget
    ? `\t\t${widgetTargetId} /* ${widgetName} */ = {\n\t\t\tisa = PBXNativeTarget;\n\t\t\tbuildConfigurationList = ${configListWidgetTargetId} /* Build configuration list for PBXNativeTarget "${widgetName}" */;\n\t\t\tbuildPhases = (\n\t\t\t\t${widgetSourcesPhaseId} /* Sources */,\n\t\t\t\t${widgetFrameworksPhaseId} /* Frameworks */,\n\t\t\t\t${widgetResourcesPhaseId} /* Resources */,\n\t\t\t);\n\t\t\tbuildRules = (\n\t\t\t);\n\t\t\tdependencies = (\n\t\t\t);\n\t\t\tname = ${JSON.stringify(
        widgetName
      )};\n\t\t\tproductName = ${JSON.stringify(
        widgetName
      )};\n\t\t\tproductReference = ${projectProductsWidgetId} /* ${widgetName}.appex */;\n\t\t\tproductType = \"com.apple.product-type.app-extension\";\n\t\t};`
    : "";

  const widgetTargetsInProject = usesWidgetTarget
    ? `\t\t\t\t${widgetTargetId} /* ${widgetName} */,\n`
    : "";

  const widgetChildrenInGroup = usesWidgetTarget
    ? `\t\t\t\t${projectProductsWidgetId} /* ${widgetName}.appex */,\n`
    : "";

  const widgetFrameworksBlock = usesWidgetTarget
    ? `\t\t${widgetFrameworksPhaseId} /* Frameworks */ = {\n\t\t\tisa = PBXFrameworksBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`
    : "";

  const widgetResourcesBlock = usesWidgetTarget
    ? `\t\t${widgetResourcesPhaseId} /* Resources */ = {\n\t\t\tisa = PBXResourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`
    : "";

  const embedAppExtensionsBlock = usesWidgetTarget
    ? `\t\t${embedAppExtensionsPhaseId} /* Embed App Extensions */ = {\n\t\t\tisa = PBXCopyFilesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tdstPath = \"\";\n\t\t\tdstSubfolderSpec = 13;\n\t\t\tfiles = (\n\t\t\t\t${embedWidgetBuildFileId}\n\t\t\t);\n\t\t\tname = \"Embed App Extensions\";\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`
    : "";

  const embedAppExtensionsPhaseInAppTarget = usesWidgetTarget
    ? `\t\t\t\t${embedAppExtensionsPhaseId} /* Embed App Extensions */,\n`
    : "";

  const copyFilesSection = usesWidgetTarget
    ? `\n/* Begin PBXCopyFilesBuildPhase section */\n${embedAppExtensionsBlock}\n/* End PBXCopyFilesBuildPhase section */\n`
    : "";

  const widgetSourcesBlock = usesWidgetTarget
    ? `\t\t${widgetSourcesPhaseId} /* Sources */ = {\n\t\t\tisa = PBXSourcesBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n${widgetSourcesPhaseFiles}\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t};`
    : "";

  const widgetBuildConfigsBlock = usesWidgetTarget
    ? `\t\t${debugConfigWidgetTargetId} /* Debug */ = {\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {\n\t\t\t\tCODE_SIGN_STYLE = Automatic;\n${developmentTeamLine}\t\t\t\tCURRENT_PROJECT_VERSION = 1;\n\t\t\t\tGENERATE_INFOPLIST_FILE = NO;\n\t\t\t\tINFOPLIST_FILE = ${JSON.stringify(
        widgetInfoPlistBuildSetting
      )};\n\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = ${deploymentTarget};\n\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (\n\t\t\t\t\t\"$(inherited)\",\n\t\t\t\t\t\"@executable_path/Frameworks\",\n\t\t\t\t);\n\t\t\t\tMARKETING_VERSION = 1.0;\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = ${JSON.stringify(
        widgetBundleId
      )};\n\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";\n\t\t\t\tSDKROOT = iphoneos;\n\t\t\t\tSKIP_INSTALL = YES;\n\t\t\t\tSWIFT_VERSION = 5.0;\n\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";\n\t\t\t};\n\t\t\tname = Debug;\n\t\t};\n\t\t${releaseConfigWidgetTargetId} /* Release */ = {\n\t\t\tisa = XCBuildConfiguration;\n\t\t\tbuildSettings = {\n\t\t\t\tCODE_SIGN_STYLE = Automatic;\n${developmentTeamLine}\t\t\t\tCURRENT_PROJECT_VERSION = 1;\n\t\t\t\tGENERATE_INFOPLIST_FILE = NO;\n\t\t\t\tINFOPLIST_FILE = ${JSON.stringify(
        widgetInfoPlistBuildSetting
      )};\n\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = ${deploymentTarget};\n\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (\n\t\t\t\t\t\"$(inherited)\",\n\t\t\t\t\t\"@executable_path/Frameworks\",\n\t\t\t\t);\n\t\t\t\tMARKETING_VERSION = 1.0;\n\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = ${JSON.stringify(
        widgetBundleId
      )};\n\t\t\t\tPRODUCT_NAME = \"$(TARGET_NAME)\";\n\t\t\t\tSDKROOT = iphoneos;\n\t\t\t\tSKIP_INSTALL = YES;\n\t\t\t\tSWIFT_VERSION = 5.0;\n\t\t\t\tTARGETED_DEVICE_FAMILY = \"1,2\";\n\t\t\t};\n\t\t\tname = Release;\n\t\t};`
    : "";

  const widgetConfigListBlock = usesWidgetTarget
    ? `\t\t${configListWidgetTargetId} /* Build configuration list for PBXNativeTarget "${widgetName}" */ = {\n\t\t\tisa = XCConfigurationList;\n\t\t\tbuildConfigurations = (\n\t\t\t\t${debugConfigWidgetTargetId} /* Debug */,\n\t\t\t\t${releaseConfigWidgetTargetId} /* Release */,\n\t\t\t);\n\t\t\tdefaultConfigurationIsVisible = 0;\n\t\t\tdefaultConfigurationName = Release;\n\t\t};`
    : "";

  return `// !$*UTF8*$!
{
\tarchiveVersion = 1;
\tclasses = {
\t};
\tobjectVersion = 56;
\tobjects = {

/* Begin PBXBuildFile section */
${buildFileLines.join("\n")}
/* End PBXBuildFile section */

/* Begin PBXFileReference section */
${fileRefLines}
\t\t${projectProductsAppId} /* ${projectName}.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = ${JSON.stringify(
    `${projectName}.app`
  )}; sourceTree = BUILT_PRODUCTS_DIR; };
${widgetFileRefLine}
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
\t\t${appFrameworksPhaseId} /* Frameworks */ = {
\t\t\tisa = PBXFrameworksBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
${widgetFrameworksBlock}
/* End PBXFrameworksBuildPhase section */
${copyFilesSection}

/* Begin PBXGroup section */
\t\t${mainGroupId} = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
\t\t\t\t${sourcesGroupId} /* ${projectName} */,
\t\t\t\t${projectProductsAppId} /* ${projectName}.app */,
${widgetChildrenInGroup}\t\t\t);
\t\t\tsourceTree = "<group>";
\t\t};
\t\t${sourcesGroupId} /* ${projectName} */ = {
\t\t\tisa = PBXGroup;
\t\t\tchildren = (
${groupChildren}
\t\t\t);
\t\t\tpath = ${JSON.stringify(projectName)};
\t\t\tsourceTree = "<group>";
\t\t};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
\t\t${appTargetId} /* ${projectName} */ = {
\t\t\tisa = PBXNativeTarget;
\t\t\tbuildConfigurationList = ${configListAppTargetId} /* Build configuration list for PBXNativeTarget "${projectName}" */;
\t\t\tbuildPhases = (
\t\t\t\t${appSourcesPhaseId} /* Sources */,
\t\t\t\t${appFrameworksPhaseId} /* Frameworks */,
\t\t\t\t${appResourcesPhaseId} /* Resources */,
\t\t\t\t${embedAppExtensionsPhaseInAppTarget}
\t\t\t);
\t\t\tbuildRules = (
\t\t\t);
\t\t\tdependencies = (
\t\t\t);
\t\t\tname = ${JSON.stringify(projectName)};
\t\t\tproductName = ${JSON.stringify(projectName)};
\t\t\tproductReference = ${projectProductsAppId} /* ${projectName}.app */;
\t\t\tproductType = "com.apple.product-type.application";
\t\t};
${widgetNativeTargetBlock}
/* End PBXNativeTarget section */

/* Begin PBXProject section */
\t\t${projectObjectId} /* Project object */ = {
\t\t\tisa = PBXProject;
\t\t\tattributes = {
\t\t\t\tBuildIndependentTargetsInParallel = 1;
\t\t\t\tLastSwiftUpdateCheck = 1500;
\t\t\t\tLastUpgradeCheck = 1500;
\t\t\t};
\t\t\tbuildConfigurationList = ${configListProjectId} /* Build configuration list for PBXProject "${projectName}" */;
\t\t\tcompatibilityVersion = "Xcode 14.0";
\t\t\tdevelopmentRegion = en;
\t\t\thasScannedForEncodings = 0;
\t\t\tknownRegions = (
\t\t\t\ten,
\t\t\t\tBase,
\t\t\t);
\t\t\tmainGroup = ${mainGroupId};
\t\t\tproductRefGroup = ${mainGroupId} /* ${projectName} */;
\t\t\tprojectDirPath = "";
\t\t\tprojectRoot = "";
\t\t\ttargets = (
\t\t\t\t${appTargetId} /* ${projectName} */,
${widgetTargetsInProject}\t\t\t);
\t\t};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
\t\t${appResourcesPhaseId} /* Resources */ = {
\t\t\tisa = PBXResourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
${widgetResourcesBlock}
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
\t\t${appSourcesPhaseId} /* Sources */ = {
\t\t\tisa = PBXSourcesBuildPhase;
\t\t\tbuildActionMask = 2147483647;
\t\t\tfiles = (
${appSourcesPhaseFiles}
\t\t\t);
\t\t\trunOnlyForDeploymentPostprocessing = 0;
\t\t};
${widgetSourcesBlock}
/* End PBXSourcesBuildPhase section */

/* Begin XCBuildConfiguration section */
\t\t${debugConfigProjectId} /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
\t\t\t\tCLANG_ANALYZER_NONNULL = YES;
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;
\t\t\t\tCOPY_PHASE_STRIP = NO;
\t\t\t\tDEBUG_INFORMATION_FORMAT = dwarf;
\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;
\t\t\t\tENABLE_TESTABILITY = YES;
\t\t\t\tGCC_DYNAMIC_NO_PIC = NO;
\t\t\t\tGCC_OPTIMIZATION_LEVEL = 0;
\t\t\t\tGCC_PREPROCESSOR_DEFINITIONS = (
\t\t\t\t\t"DEBUG=1",
\t\t\t\t\t"$(inherited)",
\t\t\t\t);
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = ${deploymentTarget};
\t\t\t\tMTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
\t\t\t\tMTL_FAST_MATH = YES;
\t\t\t\tONLY_ACTIVE_ARCH = YES;
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
\t\t\t\tSWIFT_OPTIMIZATION_LEVEL = "-Onone";
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\t${releaseConfigProjectId} /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tALWAYS_SEARCH_USER_PATHS = NO;
\t\t\t\tASSETCATALOG_COMPILER_GENERATE_SWIFT_ASSET_SYMBOL_EXTENSIONS = YES;
\t\t\t\tCLANG_ANALYZER_NONNULL = YES;
\t\t\t\tCLANG_ENABLE_MODULES = YES;
\t\t\t\tCLANG_ENABLE_OBJC_ARC = YES;
\t\t\t\tCOPY_PHASE_STRIP = NO;
\t\t\t\tDEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
\t\t\t\tENABLE_NS_ASSERTIONS = NO;
\t\t\t\tENABLE_STRICT_OBJC_MSGSEND = YES;
\t\t\t\tGCC_OPTIMIZATION_LEVEL = s;
\t\t\t\tIPHONEOS_DEPLOYMENT_TARGET = ${deploymentTarget};
\t\t\t\tMTL_ENABLE_DEBUG_INFO = NO;
\t\t\t\tMTL_FAST_MATH = YES;
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSWIFT_COMPILATION_MODE = wholemodule;
\t\t\t\tVALIDATE_PRODUCT = YES;
\t\t\t};
\t\t\tname = Release;
\t\t};
\t\t${debugConfigAppTargetId} /* Debug */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
${developmentTeamLine}\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_ASSET_PATHS = "";
\t\t\t\tENABLE_PREVIEWS = YES;
\t\t\t\tGENERATE_INFOPLIST_FILE = YES;
${supportsLiveActivitiesLine}${privacyPermBlock}\t\t\t\tINFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;
\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = ${JSON.stringify(bundleId)};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t};
\t\t\tname = Debug;
\t\t};
\t\t${releaseConfigAppTargetId} /* Release */ = {
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME = AccentColor;
\t\t\t\tCODE_SIGN_STYLE = Automatic;
${developmentTeamLine}\t\t\t\tCURRENT_PROJECT_VERSION = 1;
\t\t\t\tDEVELOPMENT_ASSET_PATHS = "";
\t\t\t\tENABLE_PREVIEWS = YES;
\t\t\t\tGENERATE_INFOPLIST_FILE = YES;
${supportsLiveActivitiesLine}${privacyPermBlock}\t\t\t\tINFOPLIST_KEY_UIApplicationSupportsIndirectInputEvents = YES;
\t\t\t\tINFOPLIST_KEY_UILaunchScreen_Generation = YES;
\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPad = "UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
\t\t\t\tINFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationPortrait UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t);
\t\t\t\tMARKETING_VERSION = 1.0;
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = ${JSON.stringify(bundleId)};
\t\t\t\tPRODUCT_NAME = "$(TARGET_NAME)";
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tSWIFT_EMIT_LOC_STRINGS = YES;
\t\t\t\tSWIFT_VERSION = 5.0;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t};
\t\t\tname = Release;
\t\t};
${widgetBuildConfigsBlock}
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
\t\t${configListProjectId} /* Build configuration list for PBXProject "${projectName}" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t${debugConfigProjectId} /* Debug */,
\t\t\t\t${releaseConfigProjectId} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
\t\t${configListAppTargetId} /* Build configuration list for PBXNativeTarget "${projectName}" */ = {
\t\t\tisa = XCConfigurationList;
\t\t\tbuildConfigurations = (
\t\t\t\t${debugConfigAppTargetId} /* Debug */,
\t\t\t\t${releaseConfigAppTargetId} /* Release */,
\t\t\t);
\t\t\tdefaultConfigurationIsVisible = 0;
\t\t\tdefaultConfigurationName = Release;
\t\t};
${widgetConfigListBlock}
/* End XCConfigurationList section */
\t};
\trootObject = ${projectObjectId} /* Project object */;
}
`;
}
