export interface GuidedOption {
  value: string;
  label: string;
  description?: string;
}

export interface GuidedQuestion {
  id: string;
  title: string;
  subtitle: string;
  options: GuidedOption[];
  /** Only shown when project type matches. Omit for always-shown. */
  projectTypeFilter?: "standard" | "pro";
  /** Allow selecting multiple options. Stored as comma-separated values. */
  multiSelect?: boolean;
}

export const GUIDED_QUESTIONS: GuidedQuestion[] = [
  {
    id: "visual-style",
    title: "How should your app look?",
    subtitle: "Pick a visual direction",
    options: [
      { value: "plain", label: "Plain & Simple", description: "Clean, minimal, functional" },
      { value: "modern", label: "Modern & Clean", description: "Polished with subtle depth" },
      { value: "colorful", label: "Bold & Colorful", description: "Vibrant, eye-catching design" },
      { value: "dark", label: "Dark & Sleek", description: "Dark surfaces, refined feel" },
    ],
  },
  {
    id: "complexity",
    title: "How many screens?",
    subtitle: "Choose the scope of your app",
    options: [
      { value: "single", label: "Single screen", description: "One focused view" },
      { value: "few", label: "A few screens (2-4)", description: "Navigation between views" },
      { value: "many", label: "Many screens (5+)", description: "Full multi-screen app" },
    ],
  },
  {
    id: "color-palette",
    title: "What colors?",
    subtitle: "Set the color mood for your app",
    options: [
      { value: "neutral", label: "Neutral / Monochrome" },
      { value: "warm", label: "Warm tones", description: "Reds, oranges, yellows" },
      { value: "cool", label: "Cool tones", description: "Blues, greens, purples" },
      { value: "vibrant", label: "Vibrant / Rainbow", description: "Full spectrum, colorful" },
      { value: "match", label: "Match my description", description: "Let AI decide from context" },
    ],
  },
  {
    id: "data-storage",
    title: "Does your app need to save data?",
    subtitle: "Choose how persistence works",
    options: [
      { value: "none", label: "No, keep it simple", description: "Stateless, no saved data" },
      { value: "local", label: "Save locally on device", description: "Persists between sessions" },
      { value: "later", label: "I'll decide later", description: "Skip for now" },
    ],
  },
  {
    id: "device-capabilities",
    title: "Does your app use device hardware?",
    subtitle: "Select all that apply, or skip if none",
    multiSelect: true,
    options: [
      { value: "none", label: "None of these" },
      { value: "camera", label: "Camera", description: "Photos, video, or AR" },
      { value: "microphone", label: "Microphone", description: "Audio recording or voice" },
      { value: "location", label: "Location", description: "GPS or map features" },
      { value: "photos", label: "Photo Library", description: "Access saved photos" },
      { value: "health", label: "HealthKit", description: "Fitness or health data" },
      { value: "bluetooth", label: "Bluetooth", description: "Connect to devices" },
    ],
  },
  {
    id: "build-attempts",
    title: "How many build attempts?",
    subtitle: "More attempts = better chance of compiling",
    projectTypeFilter: "pro",
    options: [
      { value: "1", label: "1 (fastest)", description: "Single attempt, quickest result" },
      { value: "3", label: "3 (recommended)", description: "Good balance of speed and reliability" },
      { value: "5", label: "5 (most thorough)", description: "Best chance of a working build" },
    ],
  },
];

export function compileGuidedPrompt(
  appDescription: string,
  answers: Record<string, string>,
  projectType: "standard" | "pro"
): string {
  const lines: string[] = [appDescription.trim()];
  const prefs: string[] = [];

  const questions = GUIDED_QUESTIONS.filter(
    (q) => !q.projectTypeFilter || q.projectTypeFilter === projectType
  );

  for (const q of questions) {
    const answer = answers[q.id];
    if (!answer) continue;

    if (q.id === "device-capabilities") {
      const selected = answer.split(",").filter((v) => v && v !== "none");
      if (selected.length > 0) {
        const labels = selected
          .map((v) => q.options.find((o) => o.value === v)?.label)
          .filter(Boolean);
        prefs.push(`Device hardware: ${labels.join(", ")}`);
        prefs.push("The app must request runtime permissions for these and handle denial gracefully.");
      }
      continue;
    }

    const option = q.options.find((o) => o.value === answer);
    if (!option) continue;

    if (q.id === "visual-style") {
      prefs.push(`Visual style: ${option.label}`);
    } else if (q.id === "complexity") {
      prefs.push(`Complexity: ${option.label}`);
    } else if (q.id === "color-palette" && answer !== "match") {
      prefs.push(`Color palette: ${option.label}`);
    } else if (q.id === "data-storage" && answer !== "later") {
      prefs.push(`Data: ${option.label}`);
    } else if (q.id === "build-attempts") {
      prefs.push(`Build attempts: ${option.label}`);
    }
  }

  if (prefs.length > 0) {
    lines.push("");
    lines.push("Style preferences:");
    for (const p of prefs) {
      lines.push(`- ${p}`);
    }
  }

  return lines.join("\n");
}
