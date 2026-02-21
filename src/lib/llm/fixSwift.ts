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

    // Common mistake: escaping quotes inside string interpolation Swift code,
    // e.g. `.currency(code: \"USD\")` which breaks the string literal.
    content = content.replace(
      /\.currency\(code:\s*\\\"([A-Za-z]{3})\\\"\)/g,
      '.currency(code: "$1")'
    );

    // Common mistake: using `.accent` as a ShapeStyle/Color member; SwiftUI uses `.accentColor`.
    // Examples we fix: `.foregroundStyle(.accent)` / `.fill(.accent)` / `Color.accent`
    content = content.replace(/\.accent(?!Color)\b/g, ".accentColor");

    // Common mistake: passing a numeric string literal where a Double is expected.
    // Examples we fix: `ProgressView(value: "0.7", total: 1)` / `Gauge(value: "42", in: 0...100)`
    content = content.replace(
      /\b(ProgressView|Gauge)\(\s*value:\s*"(\d+(?:\.\d+)?)"\s*,/g,
      "$1(value: $2,"
    );

    return { ...f, content };
  });
}

