import { readFile, mkdir, writeFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const REPO_ROOT = process.cwd();
const CAP_DIR = path.join(REPO_ROOT, "CAPABILITY_IDEAS");
const SEED_PATH = path.join(CAP_DIR, "seed.json");

const FORCE = process.argv.includes("--force") || process.argv.includes("-f");

function titleCase(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(" ");
}

function safeSegment(s) {
  return String(s || "")
    .trim()
    .replace(/[\/\\:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function safeFilenameSlug(s) {
  return String(s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "idea";
}

function mdForIdea({ title, tier, prompt }, cap) {
  const tierLabel = titleCase(tier || "medium");
  const frameworks =
    Array.isArray(cap.frameworks) && cap.frameworks.length
      ? cap.frameworks.join(", ")
      : "";
  const headerBits = [
    `# ${title} (${tierLabel})`,
    "",
    frameworks ? `**Frameworks**: ${frameworks}` : null,
    cap.notes ? `**Notes**: ${cap.notes}` : null,
    "",
    "**Prompt (copy-paste into Vibetree Pro)**",
    "",
    "```",
    String(prompt || "").trim(),
    "```",
    "",
  ].filter(Boolean);
  return headerBits.join("\n");
}

async function pathExists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!existsSync(SEED_PATH)) {
    console.error(`Missing seed file: ${SEED_PATH}`);
    process.exit(1);
  }
  const raw = await readFile(SEED_PATH, "utf8");
  const seed = JSON.parse(raw);
  const caps = Array.isArray(seed?.capabilities) ? seed.capabilities : [];
  if (!caps.length) {
    console.error("No capabilities found in seed.json");
    process.exit(1);
  }

  let foldersCreated = 0;
  let filesWritten = 0;
  let filesSkipped = 0;

  for (const cap of caps) {
    const folderName = safeSegment(cap.folder);
    if (!folderName) continue;
    const folderPath = path.join(CAP_DIR, folderName);
    if (!(await pathExists(folderPath))) {
      await mkdir(folderPath, { recursive: true });
      foldersCreated += 1;
    }

    const ideas = Array.isArray(cap.ideas) ? cap.ideas : [];
    for (let i = 0; i < ideas.length; i++) {
      const idea = ideas[i];
      const idx = String(i + 1).padStart(2, "0");
      const slug = safeFilenameSlug(idea.slug || idea.title || `${idx}`);
      const fileName = `${idx}-${slug}.md`;
      const filePath = path.join(folderPath, fileName);
      if (!FORCE && existsSync(filePath)) {
        filesSkipped += 1;
        continue;
      }
      const md = mdForIdea(idea, cap);
      await writeFile(filePath, md, "utf8");
      filesWritten += 1;
    }
  }

  console.log(
    `Done. foldersCreated=${foldersCreated} filesWritten=${filesWritten} filesSkipped=${filesSkipped} (force=${FORCE})`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

