#!/usr/bin/env node
/**
 * One-off debug: run first M6 app (Apple Music Playlist Creator), consume stream,
 * log the full shape of the "done" payload so we can fix generationSummary parsing.
 * Usage: BASE_URL=http://localhost:3001 node scripts/debug-m6-stream-done.mjs
 */

const BASE = process.env.BASE_URL || "http://localhost:3001";
const M6_FIRST_PROMPT =
  "Build an app where I type a mood or artist name and it creates a 30 minute Apple Music playlist. Show the songs before adding to my library. Handle the case where Apple Music is not available or permission is denied.";

async function main() {
  console.log("Creating project and streaming (first M6 app)...");
  const projectRes = await fetch(`${BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "[M6 Debug] Apple Music Playlist Creator" }),
  });
  if (!projectRes.ok) throw new Error(`Create project failed: ${projectRes.status}`);
  const data = await projectRes.json();
  const projectId = data.project?.id ?? data.id;
  if (!projectId) throw new Error("No project id");

  const streamRes = await fetch(`${BASE}/api/projects/${projectId}/message/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: M6_FIRST_PROMPT,
      projectType: "pro",
      model: "sonnet-4.6",
    }),
  });
  if (!streamRes.ok) throw new Error(`Stream failed: ${streamRes.status}`);

  let done = null;
  const reader = streamRes.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done: streamDone } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === "done") done = obj;
      } catch (_) {}
    }
  }

  if (!done) {
    console.error("No 'done' event in stream.");
    process.exit(1);
  }

  const doneKeys = Object.keys(done);
  const am = done.assistantMessage;
  const amKeys = am && typeof am === "object" ? Object.keys(am) : [];
  const content = am?.content;
  const contentType = typeof content;

  console.log("\n--- done payload shape ---");
  console.log("done keys:", doneKeys);
  console.log("assistantMessage keys:", amKeys);
  console.log("assistantMessage.content type:", contentType);
  if (contentType === "string") {
    console.log("assistantMessage.content length:", content.length);
    console.log("assistantMessage.content (first 500 chars):", content.slice(0, 500));
  } else {
    console.log("assistantMessage.content (JSON):", JSON.stringify(content).slice(0, 500));
  }

  const contentRaw = am?.content;
  let generationSummary;
  if (typeof contentRaw === "string") {
    const trimmed = contentRaw.trim();
    try {
      const parsed = JSON.parse(contentRaw);
      if (parsed.summary != null && String(parsed.summary).trim()) {
        generationSummary = String(parsed.summary).trim();
      } else if (trimmed) {
        generationSummary = trimmed;
      }
    } catch (_) {
      if (trimmed) generationSummary = trimmed;
    }
  }
  const appName = "Apple Music Playlist Creator";
  if (generationSummary != null && generationSummary.length > 0) {
    const preview = generationSummary.slice(0, 200) + (generationSummary.length > 200 ? "..." : "");
    console.log("M6 Summary captured for", appName + ":", preview);
  } else {
    console.log("M6 Summary NOT captured for", appName);
  }

  const filesRes = await fetch(`${BASE}/api/projects/${projectId}/files`);
  if (filesRes.ok) {
    const { files } = await filesRes.json();
    const swiftFiles = (files || []).filter((f) => f.path && f.path.endsWith(".swift"));
    const combined = swiftFiles.map((f) => f.content || "").join("\n");
    const hasMusicAuth = /\bMusicAuthorization\b|\bApplicationMusicPlayer\b/.test(combined);
    const hasPlistComment = /NSAppleMusicUsageDescription/.test(combined) && /REQUIRES PLIST/i.test(combined);
    console.log("PLIST check: MusicKit in code:", hasMusicAuth, "| REQUIRES PLIST NSAppleMusicUsageDescription:", hasPlistComment, "| Pass:", hasMusicAuth ? hasPlistComment : "n/a");
  }
  console.log("--- end ---\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
