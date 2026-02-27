/**
 * Base URL for integration API endpoints.
 * Generated apps call this URL; must be reachable from the client.
 */

export function getIntegrationsBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `http://localhost:${process.env.PORT || 3001}`;
}
