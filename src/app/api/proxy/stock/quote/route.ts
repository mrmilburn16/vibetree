/**
 * GET /api/proxy/stock/quote?symbol=AAPL
 *
 * Proxies Alpha Vantage GLOBAL_QUOTE endpoint.
 * The API key is injected server-side and never exposed to the client.
 *
 * Cache: 5-minute in-memory TTL (stock prices change frequently but the
 *        free tier only allows 25 requests/day, so caching is essential).
 * Rate limit: shared 25 req/day server-wide via alphaVantageRateLimit.
 */

import { NextRequest, NextResponse } from "next/server";
import { createProxyCache } from "@/lib/proxyCache";
import { consumeCall, getRemainingCalls } from "@/lib/alphaVantageRateLimit";

const cache = createProxyCache({ ttlSeconds: 300, maxSize: 100 }); // 5-min TTL

const SYMBOL_RE = /^[A-Z0-9.]{1,12}$/;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbol");
  const symbol = raw?.toUpperCase().trim() ?? "";

  if (!symbol || !SYMBOL_RE.test(symbol)) {
    return NextResponse.json(
      { error: "Missing or invalid symbol. Example: /api/proxy/stock/quote?symbol=AAPL" },
      { status: 400 }
    );
  }

  // Serve from cache if available
  const cacheKey = `stock:quote:${symbol}`;
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
      `?function=GLOBAL_QUOTE` +
      `&symbol=${encodeURIComponent(symbol)}` +
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
    const raw = (data["Global Quote"] ?? {}) as Record<string, string>;
    const quote = {
      symbol:        raw["01. symbol"]       ?? symbol,
      price:         parseFloat(raw["05. price"]          ?? "0"),
      change:        parseFloat(raw["09. change"]         ?? "0"),
      changePercent: parseFloat((raw["10. change percent"] ?? "0%").replace("%", "")),
      open:          parseFloat(raw["02. open"]           ?? "0") || null,
      high:          parseFloat(raw["03. high"]           ?? "0") || null,
      low:           parseFloat(raw["04. low"]            ?? "0") || null,
      volume:        parseInt(  raw["06. volume"]         ?? "0", 10) || null,
    };

    cache.set(cacheKey, quote);
    return NextResponse.json(quote, { headers: { "X-Cache": "MISS" } });
  } catch {
    return NextResponse.json({ error: "Failed to fetch stock quote." }, { status: 500 });
  }
}
