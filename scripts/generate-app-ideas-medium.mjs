#!/usr/bin/env node
/**
 * Generates APP_IDEAS_MEDIUM/<Category>/NN-title-slug.md and README.md from
 * APP_IDEAS_MEDIUM_BY_CATEGORY in src/lib/appIdeaPromptsMedium.ts.
 * Run: node scripts/generate-app-ideas-medium.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const root = join(process.cwd());
const tsPath = join(root, "src/lib/appIdeaPromptsMedium.ts");
const outDir = join(root, "APP_IDEAS_MEDIUM");

const content = readFileSync(tsPath, "utf8");

const categoryBlockRe = /"([^"]+)":\s*\[\s*([\s\S]*?)\n\s*\],?/g;
const entryRe = /\{\s*title:\s*"((?:[^"\\]|\\.)*)"\s*,\s*prompt:\s*"((?:[^"\\]|\\.)*)"\s*\}/g;

function unescape(s) {
  return s.replace(/\\"/g, '"');
}

const byCategory = [];
let block;
while ((block = categoryBlockRe.exec(content)) !== null) {
  const categoryName = block[1];
  const blockContent = block[2];
  const entries = [];
  let entry;
  entryRe.lastIndex = 0;
  while ((entry = entryRe.exec(blockContent)) !== null) {
    entries.push({ title: unescape(entry[1]), prompt: unescape(entry[2]) });
  }
  byCategory.push({ category: categoryName, ideas: entries });
}

const total = byCategory.reduce((n, c) => n + c.ideas.length, 0);
if (total !== 100) {
  console.error("Expected 100 ideas, got", total);
  process.exit(1);
}

function slug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const readmeSections = [];

for (const { category, ideas } of byCategory) {
  const safeDir = category.replace(/[\\/:*?"<>|]/g, "-").trim();
  const categoryDir = join(outDir, safeDir);
  mkdirSync(categoryDir, { recursive: true });

  const sectionLinks = [];
  ideas.forEach((idea, i) => {
    const num = String(i + 1).padStart(2, "0");
    const fileSlug = slug(idea.title);
    const filename = `${num}-${fileSlug}.md`;
    const md = `# ${idea.title} (Medium)

**Prompt (copy-paste into Vibetree Pro)**

\`\`\`
${idea.prompt}
\`\`\`
`;
    writeFileSync(join(categoryDir, filename), md);
    sectionLinks.push({ title: idea.title, file: `${safeDir}/${filename}` });
  });

  readmeSections.push({ category, links: sectionLinks });
}

const readmeLines = [
  "# 100 App Ideas — Medium Complexity (by technology)",
  "",
  "Leveled-up versions of the basic 100 ideas. Each prompt adds multi-screen navigation, richer data models, CRUD, search/filter, and polished UI.",
  "",
  "Generated from `src/lib/appIdeaPromptsMedium.ts`. Each file has a **Prompt** block to copy into Vibetree Pro.",
  "",
];

for (const { category, links } of readmeSections) {
  readmeLines.push(`## ${category}`);
  readmeLines.push("");
  for (const { title, file } of links) {
    readmeLines.push(`- [${title}](${file})`);
  }
  readmeLines.push("");
}

writeFileSync(join(outDir, "README.md"), readmeLines.join("\n"));

console.log("Wrote APP_IDEAS_MEDIUM: " + byCategory.length + " category folders + README.md (" + total + " ideas).");
