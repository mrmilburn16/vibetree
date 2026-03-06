import type { SelectOption } from "@/components/ui/Select";

export const LLM_OPTIONS: SelectOption[] = [
  { value: "auto", label: "Auto", disabled: true },
  { value: "opus-4.6", label: "Claude Opus 4.6" },
  { value: "sonnet-4.6", label: "Claude Sonnet 4.6" },
  { value: "gpt-5.2", label: "GPT 5.2", disabled: true },
  { value: "codex-5.3", label: "Codex 5.3", disabled: true },
];

export const DEFAULT_LLM = "sonnet-4.6";
