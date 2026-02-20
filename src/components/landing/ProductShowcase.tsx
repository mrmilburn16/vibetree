"use client";

import Link from "next/link";

/**
 * Product mockup: browser window showing a simplified Vibetree editor (chat + preview).
 * Uses design tokens only; no real screenshot.
 */
export function ProductShowcase() {
  return (
    <section id="product" className="landing-section flex min-h-full flex-col justify-center border-t border-[var(--border-default)] px-4 py-16 sm:px-6 sm:py-20">
      <div className="mx-auto w-full max-w-5xl">
        <h2 className="text-heading-section mb-2 text-center">See it in action</h2>
        <p className="text-body-muted mx-auto mb-10 max-w-xl text-center text-sm">
          Describe your app in chat. Watch Swift generate. Preview live in the browser.
        </p>

        {/* Browser mockup */}
        <div className="animate-fade-in mx-auto max-w-4xl">
          <div
            className="overflow-hidden rounded-t-[var(--radius-lg)] border border-b-0 border-[var(--border-default)] bg-[var(--background-secondary)] shadow-2xl"
            style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4)" }}
          >
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-[var(--border-default)] bg-[var(--background-tertiary)] px-4 py-3">
              <div className="flex gap-1.5">
                <span className="h-3 w-3 rounded-full bg-[var(--semantic-error)]/80" aria-hidden />
                <span className="h-3 w-3 rounded-full bg-[var(--semantic-warning)]/80" aria-hidden />
                <span className="h-3 w-3 rounded-full bg-[var(--semantic-success)]/80" aria-hidden />
              </div>
              <div className="ml-4 flex-1 rounded-md bg-[var(--background-primary)] px-3 py-1.5">
                <span className="text-caption text-[var(--text-tertiary)]">vibetree.com/editor</span>
              </div>
            </div>

            {/* Editor layout mockup: chat left, preview right */}
            <div className="flex min-h-[320px] sm:min-h-[380px]">
              {/* Chat panel */}
              <div className="flex w-[45%] min-w-0 flex-col border-r border-[var(--border-default)] bg-[var(--background-primary)]">
                <div className="border-b border-[var(--border-default)] px-3 py-2">
                  <span className="text-caption text-[var(--text-tertiary)]">Chat · Claude Opus</span>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-3">
                  <div className="ml-0 mr-6 self-start rounded-2xl rounded-bl-md bg-[var(--background-tertiary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                    Add a todo list with due dates
                  </div>
                  <div className="ml-6 mr-0 self-end rounded-2xl rounded-br-md bg-[var(--button-primary-bg)] px-3 py-2 text-sm text-white">
                    I&apos;ve added a TodoListView with due dates…
                  </div>
                  <div className="ml-0 mr-6 self-start rounded-2xl rounded-bl-md bg-[var(--background-tertiary)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                    Show a LIVE badge when the build is ready
                  </div>
                </div>
                <div className="border-t border-[var(--border-default)] p-2">
                  <div className="rounded-full border border-[var(--border-default)] bg-[var(--input-bg)] px-4 py-2 text-xs text-[var(--text-tertiary)]">
                    Describe the app you want to build…
                  </div>
                </div>
              </div>

              {/* Preview pane with phone frame */}
              <div className="flex flex-1 items-center justify-center bg-[var(--background-secondary)] p-4">
                <div className="relative">
                  {/* Phone frame (CSS only) */}
                  <div className="h-[240px] w-[120px] rounded-[2rem] border-[6px] border-[var(--border-default)] bg-[var(--background-primary)] shadow-xl sm:h-[280px] sm:w-[140px]">
                    <div className="absolute left-1/2 top-0 h-4 w-12 -translate-x-1/2 rounded-b-lg bg-[var(--border-default)]" />
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 pt-6">
                      <div className="h-2 w-2 rounded-full bg-[var(--badge-live)] animate-pulse" />
                      <span className="text-caption text-[var(--text-tertiary)]">LIVE</span>
                      <div className="mt-2 h-8 w-8 rounded-lg bg-[var(--background-tertiary)]" />
                      <div className="h-2 w-16 rounded bg-[var(--background-tertiary)]" />
                      <div className="h-2 w-12 rounded bg-[var(--background-tertiary)]" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-caption mt-4 text-center text-[var(--text-tertiary)]">
            No install. No Xcode. Just you and the browser.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            href="/dashboard"
            className="rounded-[var(--radius-md)] bg-[var(--button-primary-bg)] px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--button-primary-hover)]"
          >
            Try it free
          </Link>
        </div>
      </div>
    </section>
  );
}
