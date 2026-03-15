/**
 * GET /api/proxy/stock/daily?symbol=AAPL
 *
 * Proxies Alpha Vantage TIME_SERIES_DAILY endpoint (compact = last 100 days).
 * Returns OHLCV data suitable for sparkline/candlestick charts.
 * The API key is injected server-side and never exposed to the client.
 *
 * Cache: 1-hour in-memory TTL (daily OHLCV data changes only once per trading day).
 * Rate limit: shared 25 req/day server-wide via alphaVantageRateLimit.
 */

import { NextRequest, NextResponse } from "next/server";
import { createProxyCache } from "@/lib/proxyCache";
import { consumeCall, getRemainingCalls } from "@/lib/alphaVantageRateLimit";
import { resolveProxyAuth } from "@/lib/proxyAuth";

const cache = createProxyCache({ ttlSeconds: 3600, maxSize: 50 }); // 1-hour TTL

const SYMBOL_RE = /^[A-Z0-9.]{1,12}$/;

export async function GET(req: NextRequest) {
  const auth = await resolveProxyAuth(req);
  if (!auth.isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const raw = req.nextUrl.searchParams.get("symbol");
  const symbol = raw?.toUpperCase().trim() ?? "";

  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json(
      { error: "Missing or invalid symbol. Example: /api/proxy/stock/daily?symbol=AAPL" },
      { status: 400 }
    );
  }

  // Serve from cache if available
  const cacheKey = `stock:daily:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: { "X-Cache": "HIT" } });
  }

  // Check rate limit before hitting the API
  if (getRemainingCalls() <= 0) {
    return NextResponse.json(
      { error: "Alpha Vantage daily limit reached (25 requests/day). Try again tomorrow." },
      { status: 429 }
    );
  }

  const apiKey = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  if (!apiKey || apiKey === "[PASTE YOUR KEY HERE]") {
    return NextResponse.json(
      { error: "Alpha Vantage API key not configured. Set ALPHA_VANTAGE_API_KEY in .env.local." },
      { status: 500 }
    );
  }

  try {
    const url =
      `https://www.alphavantage.co/query` +
      `?function=TIME_SERIES_DAILY` +
      `&symbol=${encodeURIComponent(symbol)}` +
      `&outputsize=compact` +
      `&apikey=${apiKey}`;

    // Consume one call before fetching (deducted even on upstream error)
    consumeCall();

    const upstream = await fetch(url, { cache: "no-store" });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstream.status} ${upstream.statusText}` },
        { status: upstream.status }
      );
    }

    const data = await upstream.json() as Record<string, unknown>;

    // Alpha Vantage signals rate/key errors in the body
    const note = (data["Note"] ?? data["Information"]) as string | undefined;
    if (note) {
      return NextResponse.json({ error: note }, { status: 429 });
    }

    // Transform from Alpha Vantage format to the flat shape the Swift model decodes.
    const timeSeries = (data["Time Series (Daily)"] ?? {}) as Record<string, Record<string, string>>;
    const bars = Object.entries(timeSeries)
      .sort(([a], [b]) => a.localeCompare(b)) // ascending date order
      .map(([date, v]) => ({
        date,
        close:  parseFloat(v["4. close"]  ?? "0"),
        open:   parseFloat(v["1. open"]   ?? "0") || null,
        high:   parseFloat(v["2. high"]   ?? "0") || null,
        low:    parseFloat(v["3. low"]    ?? "0") || null,
        volume: parseInt(  v["5. volume"] ?? "0", 10) || null,
      }));

    const response = { symbol, bars };
    cache.set(cacheKey, response);
    return NextResponse.json(response, { headers: { "X-Cache": "MISS" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch daily price history." }, { status: 500 });
  }
}
