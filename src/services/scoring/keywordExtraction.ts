/**
 * Extract skill-like keywords from job description text.
 * Uses a common tech/skills dictionary and also captures "Word.js" style tokens.
 */

const COMMON_SKILL_TOKENS = new Set(
  [
    "node",
    "react",
    "typescript",
    "javascript",
    "mongodb",
    "docker",
    "next",
    "python",
    "java",
    "aws",
    "sql",
    "graphql",
    "redis",
    "kubernetes",
    "postgresql",
    "postgres",
    "tailwind",
    "html",
    "css",
    "redux",
    "jest",
    "git",
    "rest",
    "api",
    "agile",
    "scrum",
    "ci",
    "cd",
    "terraform",
    "gcp",
    "azure",
    "vue",
    "angular",
    "express",
    "nestjs",
    "prisma",
    "django",
    "flask",
    "fastapi",
    "go",
    "golang",
    "rust",
    "kotlin",
    "swift",
    "php",
    "ruby",
    "rails"
  ].map((s) => s.toLowerCase())
);

/** Match "X.js" or "X.js/Y" style tokens */
const DOT_JS_REGEX = /\b([a-z][a-z0-9]*\.(?:js|ts|tsx|jsx))\b/gi;

/**
 * Extract keywords from plain text (e.g. job description).
 * Returns normalized, deduplicated list of skill-like strings.
 */
export function extractKeywordsFromText(text: string | null | undefined): string[] {
  if (!text || typeof text !== "string") return [];
  const lower = text.toLowerCase();
  const found = new Set<string>();

  // Known tokens that appear as whole words
  for (const token of COMMON_SKILL_TOKENS) {
    const wordBoundary = new RegExp(`\\b${escapeRegex(token)}\\b`, "i");
    if (wordBoundary.test(text)) found.add(token);
  }

  // "Something.js" / "Something.ts" style
  let m: RegExpExecArray | null;
  const dotJs = new RegExp(DOT_JS_REGEX.source, "gi");
  while ((m = dotJs.exec(text)) !== null) {
    found.add(m[1].toLowerCase());
  }

  return [...found];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Build full list of job keywords: from skillsExtracted, tags, and description.
 */
export function getJobKeywords(job: {
  description?: string;
  skillsExtracted?: string[];
  tags?: string[];
  title?: string;
}): string[] {
  const fromExtracted = (job.skillsExtracted ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const fromTags = (job.tags ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const fromDesc = extractKeywordsFromText(job.description ?? "");
  const fromTitle = extractKeywordsFromText(job.title ?? "");
  const combined = [...fromExtracted, ...fromTags, ...fromDesc, ...fromTitle];
  return [...new Set(combined)];
}
