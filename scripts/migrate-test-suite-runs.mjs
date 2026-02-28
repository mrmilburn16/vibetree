#!/usr/bin/env node
/**
 * One-off migration: read every line from data/test-suite-runs.jsonl and write each
 * record to Firestore collection "test_suite_runs". Document ID = run.id (e.g. tsr_xxx).
 * Strips visionTestReport.screenshots in each result before writing to stay under 1MB document limit.
 *
 * Run once manually: node scripts/migrate-test-suite-runs.mjs
 * Requires: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local
 * Does not delete or modify the original JSONL file.
 */

import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const LOG_PATH = join(root, "data", "test-suite-runs.jsonl");

// Load .env.local
const envPath = join(root, ".env.local");
if (existsSync(envPath)) {
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\n/g, "\n");
    }
    if (!(key in process.env) || process.env[key] === "") process.env[key] = value;
  }
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) privateKey = privateKey.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin env. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local");
  process.exit(1);
}

if (!existsSync(LOG_PATH)) {
  console.error("No file at data/test-suite-runs.jsonl");
  process.exit(1);
}

const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});
const db = getFirestore(app);
const COLLECTION = "test_suite_runs";

/** Strip visionTestReport.screenshots in each result of the run. */
function stripScreenshotsInRun(record) {
  if (!record.results || !Array.isArray(record.results)) return record;
  const results = record.results.map((r) => {
    if (!r.visionTestReport || typeof r.visionTestReport !== "object") return r;
    return {
      ...r,
      visionTestReport: {
        ...r.visionTestReport,
        screenshots: [],
      },
    };
  });
  return { ...record, results };
}

const lines = readFileSync(LOG_PATH, "utf8").split("\n").filter(Boolean);
console.log(`Found ${lines.length} records in data/test-suite-runs.jsonl`);

let ok = 0;
let err = 0;
for (let i = 0; i < lines.length; i++) {
  try {
    const record = JSON.parse(lines[i]);
    const id = record.id;
    if (!id || typeof id !== "string") {
      console.warn(`Skip line ${i + 1}: missing or invalid id`);
      err++;
      continue;
    }
    const payload = stripScreenshotsInRun(record);
    await db.collection(COLLECTION).doc(id).set(payload);
    ok++;
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${lines.length}`);
  } catch (e) {
    console.warn(`Line ${i + 1}:`, e.message);
    err++;
  }
}

console.log(`Done. Wrote ${ok} documents to Firestore test_suite_runs. Errors: ${err}.`);
process.exit(err > 0 ? 1 : 0);
