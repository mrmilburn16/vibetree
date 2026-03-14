"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  FlaskConical,
  Zap,
  Hammer,
  TrendingUp,
  ClipboardCheck,
  Activity,
  Menu,
  X,
  DollarSign,
  ShieldAlert,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/moderation", label: "Moderation Queue", icon: ShieldAlert, badgeKey: "moderation" },
  { href: "/admin/test-suite", label: "Test Suite", icon: FlaskConical },
  { href: "/admin/skills", label: "Skills", icon: Zap },
  { href: "/admin/builds", label: "Builds", icon: Hammer },
  { href: "/admin/api-costs", label: "API Costs", icon: DollarSign },
  { href: "/admin/qa", label: "QA Insights", icon: ClipboardCheck },
  { href: "/admin/status", label: "Status", icon: Activity },
  { href: "/admin/dashboard/projections", label: "Projections", icon: TrendingUp },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [moderationCount, setModerationCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchCount = async () => {
      try {
        const res = await fetch("/api/admin/moderation/count");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setModerationCount(data.count ?? 0);
        }
      } catch {
        // ignore
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const badges: Record<string, number> = { moderation: moderationCount };

  const navContent = (
    <nav className="flex flex-col gap-1 px-3 py-4">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        Admin
      </p>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
        const badge = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={`flex items-center gap-3 rounded-[var(--radius-md)] px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--button-primary-bg)]/15 text-[var(--link-default)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--background-tertiary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {badge > 0 && (
              <span className="ml-auto rounded-full bg-[var(--badge-error)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        type="button"
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed left-3 top-3 z-50 cursor-pointer rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-2 text-[var(--text-secondary)] lg:hidden"
        aria-label="Toggle admin menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 cursor-pointer bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-[200px] shrink-0 border-r border-[var(--border-default)] bg-[var(--background-secondary)] transition-transform lg:sticky lg:top-0 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Admin navigation"
      >
        {navContent}
      </aside>
    </>
  );
}
