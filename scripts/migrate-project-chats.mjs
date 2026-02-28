#!/usr/bin/env node
/**
 * One-off migration: read every *.json file from data/project-chats/ and write each
 * to Firestore collection "project_chats". Document ID = filename stem (e.g. proj_xxx from proj_xxx.json).
 *
 * Run once manually: node scripts/migrate-project-chats.mjs
 * Requires: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env.local
 * Does not delete or modify the original files.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const CHAT_DIR = join(root, "data", "project-chats");

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

if (!existsSync(CHAT_DIR)) {
  console.error("No directory at data/project-chats");
  process.exit(1);
}

const { initializeApp, cert } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
});
const db = getFirestore(app);
const COLLECTION = "project_chats";

const files = readdirSync(CHAT_DIR).filter((f) => f.endsWith(".json"));
console.log(`Found ${files.length} files in data/project-chats/`);

let ok = 0;
let err = 0;
for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const docId = file.replace(/\.json$/, "");
  const filePath = join(CHAT_DIR, file);
  try {
    const raw = readFileSync(filePath, "utf8");
    const record = JSON.parse(raw);
    if (!record || !Array.isArray(record.messages)) {
      console.warn(`Skip ${file}: invalid or missing messages`);
      err++;
      continue;
    }
    const payload = {
      projectId: typeof record.projectId === "string" ? record.projectId : docId,
      updatedAt: typeof record.updatedAt === "number" ? record.updatedAt : Date.now(),
      messages: record.messages,
    };
    await db.collection(COLLECTION).doc(docId).set(payload);
    ok++;
    if ((i + 1) % 50 === 0) console.log(`  ${i + 1}/${files.length}`);
  } catch (e) {
    console.warn(`${file}:`, e.message);
    err++;
  }
}

console.log(`Done. Wrote ${ok} documents to Firestore project_chats. Errors: ${err}.`);
process.exit(err > 0 ? 1 : 0);
