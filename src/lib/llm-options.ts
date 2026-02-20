import type { SelectOption } from "@/components/ui/Select";

export const LLM_OPTIONS: SelectOption[] = [
  { value: "opus-4.6", label: "Claude Opus 4.6" },
  { value: "sonnet-4.6", label: "Claude Sonnet 4.6" },
  { value: "gpt-5.2", label: "GPT 5.2" },
];

export const DEFAULT_LLM = "opus-4.6";
