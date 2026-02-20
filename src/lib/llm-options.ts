import type { SelectOption } from "@/components/ui/Select";

export const LLM_OPTIONS: SelectOption[] = [
  { value: "opus-4.6", label: "Claude Opus 4.6" },
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
  { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
  { value: "claude-3.5-haiku", label: "Claude 3.5 Haiku" },
];

export const DEFAULT_LLM = "opus-4.6";
