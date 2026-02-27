import { NextResponse } from "next/server";

/**
 * Standardised API helpers for consistent JSON responses.
 *
 * Success: { ok: true, ...data }
 * Error:   { error: "<message>" }
 */

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function apiOk(data?: Record<string, JsonValue>, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function apiNotFound(message = "Not found") {
  return apiError(message, 404);
}

export function apiUnauthorized(message = "Unauthorized") {
  return apiError(message, 401);
}

export function apiForbidden(message = "Forbidden") {
  return apiError(message, 403);
}

export function apiServerError(message = "Internal server error") {
  return apiError(message, 500);
}
