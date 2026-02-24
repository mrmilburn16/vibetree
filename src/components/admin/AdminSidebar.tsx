"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  CalendarDays,
  FlaskConical,
  Zap,
  Hammer,
  TrendingUp,
  ClipboardCheck,
  Menu,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/test-suite", label: "Test Suite", icon: FlaskConical },
  { href: "/admin/skills", label: "Skills", icon: Zap },
  { href: "/admin/builds", label: "Builds", icon: Hammer },
  { href: "/admin/qa", label: "QA Insights", icon: ClipboardCheck },
  { href: "/admin/dashboard/projections", label: "Projections", icon: TrendingUp },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <nav className="flex flex-col gap-1 px-3 py-4">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
        Admin
      </p>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || (item.href !== "/admin/dashboard" && pathname.startsWith(item.href));
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
            {item.label}
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
        className="fixed left-3 top-3 z-50 rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--background-secondary)] p-2 text-[var(--text-secondary)] lg:hidden"
        aria-label="Toggle admin menu"
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
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
