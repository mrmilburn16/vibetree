import { getAllBuildResults, type BuildResult } from "@/lib/buildResultsLog";
import {
  type IssueTag,
  type IssueSeverity,
  getIssueSeverity,
  classifyNotes,
} from "./issueClassifier";

export interface TagCount {
  tag: IssueTag;
  count: number;
  severity: IssueSeverity;
  /** Build IDs that have this tag. */
  buildIds: string[];
}

export interface SkillIssue {
  skillId: string;
  tags: TagCount[];
  totalIssues: number;
}

export interface TierIssue {
  tier: string;
  tags: TagCount[];
  totalIssues: number;
}

export type SuggestionType = "prompt_rule" | "skill_update" | "fixswift_rule";

export interface SystemFixSuggestion {
  type: SuggestionType;
  priority: number;
  tag: IssueTag;
  count: number;
  description: string;
  suggestedRule: string;
  targetFile: string;
  affectedSkills: string[];
}

const TAG_TO_SUGGESTION: Record<string, { description: string; suggestedRule: string; type: SuggestionType; targetFile: string }> = {
  layout_overlap: {
    description: "Prevent interactive controls from overlapping",
    suggestedRule: "Never place interactive controls (buttons, sliders, toggles) where they overlap other interactive controls. Use VStack/HStack with proper spacing instead of ZStack for controls. If using ZStack, ensure overlay content uses .allowsHitTesting(false) on non-interactive layers.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  tap_targets: {
    description: "Enforce minimum 44x44pt touch targets",
    suggestedRule: "Every interactive element (Button, NavigationLink, Toggle, Slider, Picker, TextField) must have at least 44x44pt touch area. Use .frame(minWidth: 44, minHeight: 44) on small controls. Add .padding(.vertical, 8) to list rows with small tap targets.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  safe_area: {
    description: "Respect safe areas and device notch/Dynamic Island",
    suggestedRule: "Never place interactive content in the device safe area insets. Do not use .ignoresSafeArea() on content that has buttons or text — only on background layers. Use .safeAreaInset(edge:) for floating bottom bars. For camera/AR overlays, overlay controls should sit inside the safe area using a VStack inside a ZStack with the camera view.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  tabbar_overlap: {
    description: "Prevent content from being hidden behind tab bars",
    suggestedRule: "When using a bottom tab bar or custom navigation bar, ensure scrollable content has proper bottom padding or uses .safeAreaInset(edge: .bottom). Never place buttons at the very bottom of a ZStack without accounting for tab bar height. Use TabView's built-in safe area handling.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  zstack_overlay: {
    description: "Fix ZStack layering of interactive elements",
    suggestedRule: "In ZStack layouts, only the topmost interactive layer should receive touches. Add .allowsHitTesting(false) to decorative or background layers. Never put two interactive views at the same ZStack level without proper offset/alignment separation.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  offset_positioning: {
    description: "Stop using .offset() for layout positioning",
    suggestedRule: "Never use .offset() to position primary UI elements — it does not affect the layout system and causes overlaps. Use proper VStack/HStack/alignment instead. .offset() is only acceptable for minor visual nudges on decorative elements.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  scroll_overflow: {
    description: "Wrap potentially long content in ScrollView",
    suggestedRule: "Any VStack with more than 5–6 children, or any screen with variable-length content, must be wrapped in ScrollView. Forms and lists handle scrolling automatically; standalone VStack layouts do not.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  broken_navigation: {
    description: "Ensure all navigation paths are connected and functional",
    suggestedRule: "Every NavigationLink must have a matching .navigationDestination(for:). Every sheet must have a dismiss mechanism (Done/Cancel button or swipe). Never nest NavigationStack inside NavigationStack. Verify every screen is reachable and every back path works.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  button_not_working: {
    description: "Ensure every button has a real action",
    suggestedRule: "Every Button must have a non-empty action body. Never use { } or { /* TODO */ } as an action. At minimum, show an alert or toggle state. If the feature isn't implemented, use a \"Coming soon\" alert.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  state_not_updating: {
    description: "Fix state management patterns",
    suggestedRule: "Ensure @State, @Binding, and @Observable properties are mutated correctly. Views must reference the state property that changes for SwiftUI to re-render. Don't mutate state in a non-main-thread context without DispatchQueue.main.async. Verify parent-child data flow uses the same source of truth.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  keyboard_overlap: {
    description: "Handle keyboard appearance gracefully",
    suggestedRule: "Wrap forms with text fields in ScrollView or Form (Form handles keyboard avoidance automatically). For custom layouts, use .scrollDismissesKeyboard(.interactively) and ensure the active field is visible above the keyboard.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  camera_orientation: {
    description: "Handle camera orientation correctly",
    suggestedRule: "When using AVCaptureSession, set the video orientation to match the device orientation. For UIViewRepresentable camera views, handle orientation changes in updateUIView. Lock to portrait if rotation is not needed: use .supportedInterfaceOrientations = [.portrait] on the hosting controller.",
    type: "skill_update",
    targetFile: "data/skills/camera-capture.json",
  },
  crash_on_launch: {
    description: "Prevent launch crashes from missing setup",
    suggestedRule: "Always check API availability before calling (e.g. HKHealthStore.isHealthDataAvailable(), DataScannerViewController.isSupported). Always handle nil/optional cases. Never force-unwrap optionals in the app entry point or initial view.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  permission_flow: {
    description: "Handle permission requests gracefully",
    suggestedRule: "Request permissions at the moment they are needed, not at app launch. Always handle the denied case with a clear message and a button to open Settings (UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)). Show a pre-permission explanation before the system dialog.",
    type: "skill_update",
    targetFile: "data/skills/camera-capture.json",
  },
  empty_state_missing: {
    description: "Add empty state placeholders",
    suggestedRule: "Every list or data-driven screen must show a ContentUnavailableView (iOS 17+) or custom empty state (icon + message + optional action) when there is no data. Never show a blank screen.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  dark_mode_issue: {
    description: "Fix dark mode color issues",
    suggestedRule: "Use semantic system colors (Color(.systemBackground), .primary, .secondary) instead of hardcoded Color.white or Color.black. Test in both light and dark mode. Custom colors should use Color(uiColor:) with dynamic providers or asset catalog colors.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  text_truncation: {
    description: "Prevent text truncation in layouts",
    suggestedRule: "Never set a fixed .frame(width:) on Text views — let them size naturally. Use .lineLimit(nil) for multi-line text. Use .minimumScaleFactor(0.7) if space is constrained but text must remain visible.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  missing_content: {
    description: "Ensure all content areas are populated",
    suggestedRule: "Every card, section, and view must show real sample/mock data — never leave content areas empty without an explicit empty state. Use realistic placeholder data (not \"Lorem ipsum\") so the UI feels complete.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
  animation_issue: {
    description: "Fix animation quality and performance",
    suggestedRule: "Use .spring(response: 0.35, dampingFraction: 0.85) for natural animations. Never use .linear (feels robotic). Keep animation durations under 0.5s for UI state changes. Test that animations don't cause layout jumps.",
    type: "prompt_rule",
    targetFile: "src/lib/llm/claudeAdapter.ts",
  },
};

export async function computeQAInsights() {
  const results = await getAllBuildResults();
  const withNotes = results.filter((r) => r.userNotes.trim().length > 0);

  const tagCounts: Record<string, { count: number; buildIds: string[] }> = {};

  for (const r of withNotes) {
    const tags = r.issueTags?.length ? r.issueTags : classifyNotes(r.userNotes);
    for (const tag of tags) {
      if (!tagCounts[tag]) tagCounts[tag] = { count: 0, buildIds: [] };
      tagCounts[tag].count++;
      tagCounts[tag].buildIds.push(r.id);
    }
  }

  const topTags: TagCount[] = Object.entries(tagCounts)
    .map(([tag, { count, buildIds }]) => ({
      tag: tag as IssueTag,
      count,
      severity: getIssueSeverity(tag as IssueTag),
      buildIds,
    }))
    .sort((a, b) => {
      const severityOrder: Record<IssueSeverity, number> = { critical: 0, major: 1, minor: 2 };
      const s = severityOrder[a.severity] - severityOrder[b.severity];
      return s !== 0 ? s : b.count - a.count;
    });

  const bySkill: Record<string, Record<string, { count: number; buildIds: string[] }>> = {};
  for (const r of withNotes) {
    const tags = r.issueTags?.length ? r.issueTags : classifyNotes(r.userNotes);
    for (const skillId of r.skillsUsed) {
      if (!bySkill[skillId]) bySkill[skillId] = {};
      for (const tag of tags) {
        if (!bySkill[skillId][tag]) bySkill[skillId][tag] = { count: 0, buildIds: [] };
        bySkill[skillId][tag].count++;
        bySkill[skillId][tag].buildIds.push(r.id);
      }
    }
  }

  const skillIssues: SkillIssue[] = Object.entries(bySkill)
    .map(([skillId, tagMap]) => {
      const tags: TagCount[] = Object.entries(tagMap)
        .map(([tag, { count, buildIds }]) => ({
          tag: tag as IssueTag,
          count,
          severity: getIssueSeverity(tag as IssueTag),
          buildIds,
        }))
        .sort((a, b) => b.count - a.count);
      return { skillId, tags, totalIssues: tags.reduce((s, t) => s + t.count, 0) };
    })
    .sort((a, b) => b.totalIssues - a.totalIssues);

  const byTier: Record<string, Record<string, { count: number; buildIds: string[] }>> = {};
  for (const r of withNotes) {
    const tags = r.issueTags?.length ? r.issueTags : classifyNotes(r.userNotes);
    if (!byTier[r.tier]) byTier[r.tier] = {};
    for (const tag of tags) {
      if (!byTier[r.tier][tag]) byTier[r.tier][tag] = { count: 0, buildIds: [] };
      byTier[r.tier][tag].count++;
      byTier[r.tier][tag].buildIds.push(r.id);
    }
  }

  const tierIssues: TierIssue[] = Object.entries(byTier)
    .map(([tier, tagMap]) => {
      const tags: TagCount[] = Object.entries(tagMap)
        .map(([tag, { count, buildIds }]) => ({
          tag: tag as IssueTag,
          count,
          severity: getIssueSeverity(tag as IssueTag),
          buildIds,
        }))
        .sort((a, b) => b.count - a.count);
      return { tier, tags, totalIssues: tags.reduce((s, t) => s + t.count, 0) };
    })
    .sort((a, b) => b.totalIssues - a.totalIssues);

  const suggestions: SystemFixSuggestion[] = topTags
    .filter((t) => t.count >= 1)
    .map((t) => {
      const mapping = TAG_TO_SUGGESTION[t.tag];
      if (!mapping) return null;
      const affectedSkills = skillIssues
        .filter((si) => si.tags.some((st) => st.tag === t.tag))
        .map((si) => si.skillId);
      return {
        type: mapping.type,
        priority: t.count * (t.severity === "critical" ? 3 : t.severity === "major" ? 2 : 1),
        tag: t.tag,
        count: t.count,
        description: mapping.description,
        suggestedRule: mapping.suggestedRule,
        targetFile: mapping.targetFile,
        affectedSkills,
      } satisfies SystemFixSuggestion;
    })
    .filter((s): s is SystemFixSuggestion => s !== null)
    .sort((a, b) => b.priority - a.priority);

  return {
    totalBuildsWithNotes: withNotes.length,
    totalBuilds: results.length,
    topTags,
    skillIssues,
    tierIssues,
    suggestions,
  };
}

export type QAInsightsResult = ReturnType<typeof computeQAInsights>;
