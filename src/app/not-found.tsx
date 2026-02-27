import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--background-primary)] px-4 text-center">
      <h1 className="text-6xl font-bold text-[var(--text-primary)]">404</h1>
      <p className="mt-4 text-lg text-[var(--text-secondary)]">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link
        href="/"
        className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[var(--button-primary-bg)] px-6 py-3 text-sm font-medium text-[var(--button-primary-text)] transition-colors hover:bg-[var(--button-primary-hover)]"
      >
        Back to home
      </Link>
    </div>
  );
}
