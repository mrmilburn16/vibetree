/**
 * Fetch wrapper that adds Firebase ID token when available.
 * Use for API calls that need auth (e.g. projects persistence).
 */

export type GetToken = () => Promise<string | null>;

export async function authFetch(
  url: string,
  options: RequestInit & { getToken?: GetToken } = {}
): Promise<Response> {
  const { getToken, ...init } = options;
  const headers = new Headers(init.headers);

  if (getToken) {
    const token = await getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...init, headers });
}
