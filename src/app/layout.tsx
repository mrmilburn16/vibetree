import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CreditsProvider } from "@/contexts/CreditsContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { DevActivityWidget } from "@/components/dev/DevActivityWidget";
import { Analytics } from "@/components/Analytics";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fontVariableClasses = [geistSans.variable, geistMono.variable].join(" ");

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vibetree.com";

export const metadata: Metadata = {
  title: {
    default: "Vibetree — Build Real iOS Apps in Your Browser",
    template: "%s | Vibetree",
  },
  description:
    "Describe your app in plain language. AI writes Swift, you preview live, and ship to your iPhone or the App Store.",
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    siteName: "Vibetree",
    title: "Vibetree — Build Real iOS Apps in Your Browser",
    description:
      "Describe your app in plain language. AI writes Swift, you preview live, and ship to your iPhone or the App Store.",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Vibetree — Build Real iOS Apps in Your Browser",
    description:
      "Describe your app in plain language. AI writes Swift, you preview live, and ship to your iPhone or the App Store.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariableClasses} data-theme="emerald" suppressHydrationWarning>
      <body className="antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=document.documentElement;var th=localStorage.getItem('vibetree-theme')||'emerald';t.setAttribute('data-theme',th);})();`,
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-[var(--button-primary-bg)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none"
        >
          Skip to main content
        </a>
        <CreditsProvider>
          <ToastProvider>
            {children}
            {process.env.NODE_ENV === "development" && <DevActivityWidget />}
          </ToastProvider>
        </CreditsProvider>
        <Analytics />
      </body>
    </html>
  );
}
