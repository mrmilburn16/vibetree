#!/usr/bin/env node
/**
 * Test POST /api/proxy/plant-identify locally.
 * Usage: node scripts/test-plant-identify.mjs [image-url-or-path]
 * - URL: fetches image and uses its base64.
 * - Local path (e.g. ./photo.jpg): reads file and uses its base64.
 * - No arg: uses minimal 1x1 JPEG.
 * Requires: dev server on port 3001, PLANTID_API_KEY in .env.local
 */

import fs from "fs";
import path from "path";
const BASE = "http://localhost:3001";
// Minimal valid 1x1 pixel JPEG (base64)
const MINIMAL_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBEQACEQADAPwA/9k=";

async function fetchImageAsBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.toString("base64");
}

function readFileAsBase64(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  const buf = fs.readFileSync(abs);
  return Buffer.from(buf).toString("base64");
}

async function post(body) {
  const res = await fetch(`${BASE}/api/proxy/plant-identify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function main() {
  const input = process.argv[2];
  let base64 = MINIMAL_JPEG_BASE64;
  if (input) {
    if (input.startsWith("http://") || input.startsWith("https://")) {
      console.log("Fetching image from", input, "...");
      base64 = await fetchImageAsBase64(input);
    } else {
      console.log("Reading image from", input, "...");
      base64 = readFileAsBase64(input);
    }
    console.log("Image size:", base64.length, "base64 chars\n");
  }

  console.log("Testing POST /api/proxy/plant-identify (base:", BASE, ")\n");

  // Raw base64 (no prefix)
  console.log("--- Request (raw base64) ---");
  const raw = await post({ image: base64 });
  console.log("Status:", raw.status);
  console.log("Full response:", JSON.stringify(raw.data, null, 2));
  console.log("");

  if (raw.status === 200) {
    const d = raw.data;
    const suggestion = d?.result?.classification?.suggestions?.[0] ?? d?.suggestions?.[0];
    const name = suggestion?.name ?? suggestion?.details?.common_names?.[0] ?? d?.common_name ?? "(see response)";
    console.log("Plant name in response:", name);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
