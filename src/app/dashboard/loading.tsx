/**
 * Shown while dashboard page is loading. If you see this spinner indefinitely,
 * the dashboard page module is failing to load (check terminal for server errors).
 */
export default function DashboardLoading() {
  if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
    console.log("[dashboard:loading] loading.tsx rendered (server or client)");
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background-primary)]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--button-primary-bg)] border-t-transparent" />
    </div>
  );
}
