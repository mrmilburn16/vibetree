import Link from "next/link";
import { SocialIcons } from "./SocialIcons";

export function Footer() {
  return (
    <footer className="landing-section border-t border-[var(--border-default)] px-4 py-12 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 sm:flex-row sm:justify-between">
        <span className="text-caption text-[var(--text-tertiary)]">
          © {new Date().getFullYear()} Vibetree. All rights reserved.
        </span>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
          <div className="flex gap-6">
            <Link
              href="/docs"
              className="text-sm text-[var(--link-default)] hover:text-[var(--link-hover)]"
            >
              Docs
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-[var(--link-default)] hover:text-[var(--link-hover)]"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-[var(--link-default)] hover:text-[var(--link-hover)]"
            >
              Terms
            </Link>
            <Link
              href="/contact"
              className="text-sm text-[var(--link-default)] hover:text-[var(--link-hover)]"
            >
              Contact
            </Link>
          </div>
          <SocialIcons />
        </div>
      </div>
    </footer>
  );
}
