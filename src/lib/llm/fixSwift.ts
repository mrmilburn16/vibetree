export type SwiftTextFile = { path: string; content: string };

/**
 * Best-effort fixes for common, safe-to-repair SwiftUI compile issues in LLM output.
 *
 * We can't run Xcode builds server-side, so we use small heuristics that reduce
 * obvious “won’t compile” cases without changing intended logic.
 */
export function fixSwiftCommonIssues(files: SwiftTextFile[]): SwiftTextFile[] {
  return files.map((f) => {
    if (!f?.path?.endsWith(".swift") || typeof f.content !== "string") return f;

    let content = f.content;

    // Common mistake: using `$viewModel` as a value (not `$viewModel.someBinding`),
    // which triggers “Cannot find '$viewModel' in scope” unless using `@Bindable`.
    if (!content.includes("@Bindable")) {
      content = content.replace(/\$viewModel(?!\.)/g, "viewModel");
    }

    return { ...f, content };
  });
}

