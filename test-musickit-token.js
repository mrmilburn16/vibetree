#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const MUSICKIT_SEARCH_URL =
  "https://api.music.apple.com/v1/catalog/us/search?term=drake&types=songs&limit=5";

async function main() {
  const scriptDir = path.join(__dirname);
  const generatorPath = path.join(scriptDir, "generate-musickit-token.js");
  const generatorSrc = fs.readFileSync(generatorPath, "utf8");
  const keyIdMatch = generatorSrc.match(/const KEY_ID = "([^"]+)"/);
  const keyId = keyIdMatch ? keyIdMatch[1] : "unknown";
  console.log("Using Key ID from generate-musickit-token.js:", keyId);

  let token;
  try {
    const out = execSync(`node "${generatorPath}"`, {
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
    token = out.split("\n")[0].trim();
    if (!token) throw new Error("No token in output");
  } catch (err) {
    console.error("Failed to run generate-musickit-token.js:", err.message);
    process.exit(1);
  }

  const res = await fetch(MUSICKIT_SEARCH_URL, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  console.log("Status:", res.status);

  const body = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }

  if (res.status === 200) {
    console.log("MusicKit token is working!");
    const firstSong =
      parsed?.results?.songs?.data?.[0]?.attributes?.name ??
      parsed?.results?.songs?.data?.[0]?.name;
    if (firstSong) console.log("First song:", firstSong);
    else console.log("(Song list structure:", JSON.stringify(parsed?.results?.songs?.data?.[0] ?? {}, null, 2).slice(0, 200) + "...)");
  } else if (res.status === 401) {
    console.log("Token rejected - MusicKit not authorized on this key");
  } else if (res.status === 403) {
    console.log("Token accepted but MusicKit service not enabled on this identifier");
  }

  console.log("\nFull response body:");
  console.log(typeof parsed === "object" ? JSON.stringify(parsed, null, 2) : body);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
