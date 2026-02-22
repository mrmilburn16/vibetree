import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

type AppIdea = {
  title: string;
  prompt: string;
  category: string;
  tier: "easy" | "medium" | "hard";
};

type CachedPool = { loadedAt: number; ideas: AppIdea[] };

function asTier(value: string | undefined, fallback: AppIdea["tier"]): AppIdea["tier"] {
  const v = (value ?? "").toLowerCase();
  if (v.includes("hard")) return "hard";
  if (v.includes("easy")) return "easy";
  if (v.includes("medium")) return "medium";
  return fallback;
}

function extractPromptFromMarkdown(md: string): string {
  const fence = "```";
  const start = md.indexOf(fence);
  if (start === -1) return md.trim();
  const afterStart = md.indexOf("\n", start + fence.length);
  if (afterStart === -1) return md.slice(start + fence.length).trim();
  const end = md.indexOf(fence, afterStart + 1);
  if (end === -1) return md.slice(afterStart + 1).trim();
  return md.slice(afterStart + 1, end).trim();
}

function cleanTitle(raw: string): string {
  const t = raw.replace(/^#+\s*/, "").trim();
  // Strip a leading "10. " etc.
  return t.replace(/^\d+[\).\s-]+/, "").trim();
}

async function listMarkdownFiles(rootAbs: string): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [rootAbs];
  while (stack.length) {
    const dir = stack.pop()!;
    let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean }>;
    try {
      entries = (await readdir(dir, { withFileTypes: true })) as any;
    } catch {
      continue;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) stack.push(abs);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith(".md")) out.push(abs);
    }
  }
  return out;
}

function sample<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

async function buildIdeaPool(): Promise<AppIdea[]> {
  const repoRoot = process.cwd();
  const sources: Array<{ dir: string; defaultTier: AppIdea["tier"] }> = [
    { dir: path.join(repoRoot, "APP_IDEAS_MEDIUM"), defaultTier: "medium" },
    { dir: path.join(repoRoot, "SWIFTUI_APP_IDEAS"), defaultTier: "medium" },
  ];

  const mdFiles: Array<{ abs: string; sourceDir: string; defaultTier: AppIdea["tier"] }> = [];
  for (const s of sources) {
    const files = await listMarkdownFiles(s.dir);
    for (const abs of files) mdFiles.push({ abs, sourceDir: s.dir, defaultTier: s.defaultTier });
  }

  const ideas: AppIdea[] = [];
  for (const f of mdFiles) {
    let md = "";
    try {
      md = await readFile(f.abs, "utf8");
    } catch {
      continue;
    }
    const firstLine = md.split(/\r?\n/, 1)[0] ?? "";
    const title = cleanTitle(firstLine || path.basename(f.abs, ".md"));
    const prompt = extractPromptFromMarkdown(md);
    if (!prompt) continue;

    const relToSource = path.relative(f.sourceDir, f.abs);
    const category = relToSource.split(path.sep)[0] || "Misc";
    const tier = asTier(title, f.defaultTier);

    ideas.push({ title, prompt, category, tier });
  }

  // Ensure we have some minimum pool; fall back to an empty list if not.
  return ideas;
}

function getCachedPool(): CachedPool | null {
  const g = globalThis as unknown as { __vibetreeIdeaPool?: CachedPool };
  return g.__vibetreeIdeaPool ?? null;
}

function setCachedPool(pool: CachedPool): void {
  const g = globalThis as unknown as { __vibetreeIdeaPool?: CachedPool };
  g.__vibetreeIdeaPool = pool;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const countParam = url.searchParams.get("count") ?? "10";
  const count = Math.max(1, Math.min(20, parseInt(countParam, 10) || 10));

  let pool = getCachedPool();
  // Rebuild cache every 10 minutes in dev.
  if (!pool || Date.now() - pool.loadedAt > 10 * 60 * 1000) {
    const ideas = await buildIdeaPool();
    pool = { loadedAt: Date.now(), ideas };
    setCachedPool(pool);
  }

  const ideas = pool.ideas.length ? sample(pool.ideas, Math.min(count, pool.ideas.length)) : [];
  return Response.json({ ideas, totalPool: pool.ideas.length });
}

