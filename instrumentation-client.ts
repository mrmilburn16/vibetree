/**
 * Next.js client instrumentation. Loads Sentry client config so the SDK runs in the browser.
 */
import * as Sentry from "@sentry/nextjs";
import "./sentry.client.config";

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
