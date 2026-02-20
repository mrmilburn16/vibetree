"use client";

/**
 * Social and app-store links. X and Discord use icon links; App Store uses the official badge.
 * Replace hrefs with real URLs when available.
 */

const ICONS = {
  x: (className?: string) => (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  discord: (className?: string) => (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  ),
};

export type SocialIconKey = keyof typeof ICONS | "appStore";

export interface SocialLink {
  key: SocialIconKey;
  href: string;
  label: string;
}

const DEFAULT_LINKS: SocialLink[] = [
  { key: "x", href: "https://x.com/vibetree", label: "X (Twitter)" },
  { key: "discord", href: "https://discord.gg/vibetree", label: "Discord" },
  { key: "appStore", href: "https://apps.apple.com/app/vibetree", label: "Download on the App Store" },
];

/** "Download on the App Store" badge — black outline style (Apple official style) */
function AppStoreBadge() {
  return (
    <svg
      width="135"
      height="40"
      viewBox="0 0 135 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-10 w-auto block"
      aria-hidden
    >
      <rect width="135" height="40" rx="6" fill="#fff" stroke="#000" strokeWidth="1.5" />
      {/* Apple logo (bitten apple) */}
      <path
        fill="#000"
        transform="translate(6, 8) scale(0.85)"
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
      />
      <text x="34" y="15" fill="#000" fontFamily="-apple-system, BlinkMacSystemFont, sans-serif" fontSize="9" fontWeight="600">
        Download on the
      </text>
      <text x="34" y="28" fill="#000" fontFamily="-apple-system, BlinkMacSystemFont, sans-serif" fontSize="13" fontWeight="700">
        App Store
      </text>
    </svg>
  );
}

export interface SocialIconsProps {
  links?: SocialLink[];
  className?: string;
}

export function SocialIcons({ links = DEFAULT_LINKS, className = "" }: SocialIconsProps) {
  return (
    <nav className={`flex flex-wrap items-center gap-4 ${className}`} aria-label="Social and app links">
      {links.map(({ key, href, label }) => {
        if (key === "appStore") {
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg bg-white p-0.5 opacity-95 transition-opacity hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--button-primary-bg)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background-primary)]"
              aria-label={label}
            >
              <AppStoreBadge />
            </a>
          );
        }
        const Icon = ICONS[key as keyof typeof ICONS];
        if (!Icon) return null;
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-secondary)] opacity-80 transition-colors hover:opacity-100 hover:text-[var(--link-default)] focus:outline-none focus-visible:opacity-100 focus-visible:text-[var(--link-default)]"
            aria-label={label}
          >
            {Icon()}
          </a>
        );
      })}
    </nav>
  );
}
