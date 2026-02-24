export type IssueTag =
  | "layout_overlap"
  | "tap_targets"
  | "safe_area"
  | "tabbar_overlap"
  | "zstack_overlay"
  | "offset_positioning"
  | "scroll_overflow"
  | "text_truncation"
  | "broken_navigation"
  | "state_not_updating"
  | "permission_flow"
  | "camera_orientation"
  | "crash_on_launch"
  | "button_not_working"
  | "missing_content"
  | "dark_mode_issue"
  | "animation_issue"
  | "keyboard_overlap"
  | "empty_state_missing";

interface TagRule {
  tag: IssueTag;
  patterns: RegExp[];
}

const TAG_RULES: TagRule[] = [
  {
    tag: "layout_overlap",
    patterns: [
      /overlap/i,
      /overlapping/i,
      /on top of/i,
      /covers?\s+(the\s+)?button/i,
      /behind\s+(the\s+)?(button|text|label|view)/i,
      /blocks?\s+(the\s+)?(button|text|view)/i,
      /underneath/i,
      /can'?t\s+see/i,
      /hidden\s+behind/i,
    ],
  },
  {
    tag: "tap_targets",
    patterns: [
      /can'?t\s+(click|tap|press|hit)/i,
      /too\s+small/i,
      /hard\s+to\s+(click|tap|press|hit)/i,
      /not\s+(clickable|tappable|pressable)/i,
      /unclickable/i,
      /untappable/i,
      /touch\s+target/i,
      /button\s+(is\s+)?tiny/i,
    ],
  },
  {
    tag: "safe_area",
    patterns: [
      /safe\s*area/i,
      /notch/i,
      /dynamic\s*island/i,
      /status\s*bar/i,
      /too\s+far\s+(up|top)/i,
      /behind\s+(the\s+)?notch/i,
      /top\s*left.*too\s+(far|high)/i,
      /top\s*right.*too\s+(far|high)/i,
      /cuts?\s+off\s+(at\s+)?(the\s+)?top/i,
      /in(to)?\s+the\s+notch/i,
    ],
  },
  {
    tag: "tabbar_overlap",
    patterns: [
      /tab\s*bar.*overlap/i,
      /overlap.*tab\s*bar/i,
      /bottom\s*bar.*overlap/i,
      /menu.*(overlap|cover|block)/i,
      /(overlap|cover|block).*menu/i,
      /tab.*button.*(overlap|cover|block)/i,
    ],
  },
  {
    tag: "zstack_overlay",
    patterns: [
      /zstack/i,
      /z[\s-]?stack/i,
      /stacked\s+on\s+top/i,
      /layers?\s+(are\s+)?wrong/i,
    ],
  },
  {
    tag: "offset_positioning",
    patterns: [
      /\.?offset/i,
      /wrong\s+position/i,
      /positioned?\s+(wrong|incorrectly|badly)/i,
      /misaligned/i,
      /alignment\s+(is\s+)?(off|wrong|broken)/i,
    ],
  },
  {
    tag: "scroll_overflow",
    patterns: [
      /can'?t\s+scroll/i,
      /no\s+scroll/i,
      /overflow/i,
      /content\s+cut\s*(off)?/i,
      /text\s+cut\s*(off)?/i,
      /goes?\s+(off|past)\s+(the\s+)?screen/i,
      /below\s+(the\s+)?fold/i,
      /not\s+scrollable/i,
    ],
  },
  {
    tag: "text_truncation",
    patterns: [
      /truncat/i,
      /text\s+cut/i,
      /ellips/i,
      /\.\.\./,
      /text\s+doesn'?t\s+fit/i,
      /label\s+cut/i,
    ],
  },
  {
    tag: "broken_navigation",
    patterns: [
      /navigation\s+(is\s+)?(broken|doesn'?t\s+work|not\s+working)/i,
      /back\s+button\s+(doesn'?t|not)/i,
      /can'?t\s+(go\s+)?back/i,
      /stuck\s+(on|in)\s+(this\s+)?screen/i,
      /doesn'?t\s+navigate/i,
      /wrong\s+screen/i,
      /blank\s+screen\s+(when|after)/i,
    ],
  },
  {
    tag: "state_not_updating",
    patterns: [
      /state\s+(not|doesn'?t|isn'?t)\s+updat/i,
      /doesn'?t\s+(update|change|refresh|reflect)/i,
      /not\s+updating/i,
      /stale/i,
      /data\s+(not|doesn'?t)\s+show/i,
      /counter\s+(not|doesn'?t)\s+(count|increment|change)/i,
    ],
  },
  {
    tag: "permission_flow",
    patterns: [
      /permission/i,
      /camera\s+access/i,
      /microphone\s+access/i,
      /location\s+access/i,
      /health\s+access/i,
      /denied/i,
      /no\s+access/i,
      /authorize/i,
    ],
  },
  {
    tag: "camera_orientation",
    patterns: [
      /camera\s+(is\s+)?(flipped|mirrored|upside|wrong\s+way|sideways|rotated)/i,
      /orientation\s+(is\s+)?(wrong|broken)/i,
      /landscape/i,
      /portrait\s+lock/i,
    ],
  },
  {
    tag: "crash_on_launch",
    patterns: [
      /crash/i,
      /force\s+quit/i,
      /won'?t\s+(open|start|launch)/i,
      /immediately\s+close/i,
      /black\s+screen/i,
      /white\s+screen/i,
    ],
  },
  {
    tag: "button_not_working",
    patterns: [
      /button\s+(doesn'?t|not|won'?t)\s+(work|do\s+anything|respond)/i,
      /nothing\s+happens/i,
      /no\s+action/i,
      /dead\s+button/i,
      /button\s+(is\s+)?broken/i,
      /tapping\s+(does\s+)?nothing/i,
    ],
  },
  {
    tag: "missing_content",
    patterns: [
      /missing\s+(content|text|image|icon|data)/i,
      /placeholder/i,
      /empty\s+(where|when|but)/i,
      /blank\s+(area|section|card|view)/i,
      /nothing\s+(shows?|display)/i,
      /no\s+data/i,
    ],
  },
  {
    tag: "dark_mode_issue",
    patterns: [
      /dark\s+mode/i,
      /light\s+mode/i,
      /can'?t\s+read\s+(the\s+)?text/i,
      /text\s+(is\s+)?(invisible|same\s+color)/i,
      /white\s+on\s+white/i,
      /black\s+on\s+black/i,
      /contrast/i,
    ],
  },
  {
    tag: "animation_issue",
    patterns: [
      /animation\s+(is\s+)?(broken|janky|laggy|choppy|wrong)/i,
      /flicker/i,
      /jitter/i,
      /jumps?\s+around/i,
      /glitch/i,
    ],
  },
  {
    tag: "keyboard_overlap",
    patterns: [
      /keyboard\s+(overlap|cover|hide|block)/i,
      /(overlap|cover|hide|block).*keyboard/i,
      /can'?t\s+see.*input.*keyboard/i,
      /text\s*field.*behind.*keyboard/i,
    ],
  },
  {
    tag: "empty_state_missing",
    patterns: [
      /empty\s+state/i,
      /no\s+empty\s+(state|message|placeholder)/i,
      /blank\s+screen/i,
      /nothing\s+there\s+(when|if)/i,
      /should\s+show.*empty/i,
    ],
  },
];

/**
 * Classify freeform user notes into a deduplicated list of issue tags.
 * Pure function, no side-effects, no LLM cost.
 */
export function classifyNotes(notes: string): IssueTag[] {
  if (!notes || !notes.trim()) return [];
  const tags = new Set<IssueTag>();
  for (const rule of TAG_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(notes)) {
        tags.add(rule.tag);
        break;
      }
    }
  }
  return [...tags];
}

export const ALL_ISSUE_TAGS: readonly IssueTag[] = TAG_RULES.map((r) => r.tag);

export type IssueSeverity = "critical" | "major" | "minor";

const SEVERITY_MAP: Record<IssueTag, IssueSeverity> = {
  crash_on_launch: "critical",
  broken_navigation: "critical",
  button_not_working: "critical",
  permission_flow: "critical",
  state_not_updating: "major",
  layout_overlap: "major",
  tabbar_overlap: "major",
  tap_targets: "major",
  safe_area: "major",
  zstack_overlay: "major",
  keyboard_overlap: "major",
  scroll_overflow: "minor",
  offset_positioning: "minor",
  text_truncation: "minor",
  missing_content: "minor",
  dark_mode_issue: "minor",
  animation_issue: "minor",
  empty_state_missing: "minor",
  camera_orientation: "minor",
};

export function getIssueSeverity(tag: IssueTag): IssueSeverity {
  return SEVERITY_MAP[tag] ?? "minor";
}
