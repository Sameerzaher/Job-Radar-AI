/**
 * Board registry structure
 * ------------------------
 * Each board has: id, provider, companyName, boardKey, boardUrl, enabled, tags, priority, country, remoteSupport.
 *
 * How to add a new board:
 * 1. Append a new entry to BOARDS below with a unique id (e.g. "company-greenhouse").
 * 2. Set provider to "greenhouse" | "lever" | "workable".
 * 3. Set boardKey to the provider's board/company slug (e.g. Greenhouse board token, Lever company slug).
 * 4. Set boardUrl to the full API URL for that board (used for reference; fetch uses provider + boardKey).
 * 5. Set enabled: true to include in sync by default; users can override via /sources UI.
 *
 * How to add a new provider:
 * 1. Implement IJobProvider in services/providers/{name}Provider.ts (fetchJobs, normalizeJob, validateJob, getSourceName).
 * 2. Add the provider type to BoardConfig in services/providers/types.ts.
 * 3. Register in services/providers/index.ts getProvider().
 * 4. Add boards for the new provider to BOARDS below.
 *
 * Enable/disable can be overridden in DB via BoardSettings; call loadBoardSettingsFromDb() before getEnabledBoards() when in app context.
 */

import type { BoardConfig } from "@/services/providers/types";

/** Default list of boards. Enable/disable is overridden by BoardSettings in DB when present. */
export const BOARDS: BoardConfig[] = [
  // Greenhouse
  { id: "vercel-greenhouse", provider: "greenhouse", companyName: "Vercel", boardKey: "vercel", boardUrl: "https://boards-api.greenhouse.io/v1/boards/vercel/jobs", enabled: true, tags: ["frontend", "backend", "remote"], priority: 1, country: "global", remoteSupport: true },
  { id: "figma-greenhouse", provider: "greenhouse", companyName: "Figma", boardKey: "figma", boardUrl: "https://boards-api.greenhouse.io/v1/boards/figma/jobs", enabled: true, tags: ["design", "product", "remote"], priority: 1, country: "global", remoteSupport: true },
  { id: "notion-greenhouse", provider: "greenhouse", companyName: "Notion", boardKey: "notion", boardUrl: "https://boards-api.greenhouse.io/v1/boards/notion/jobs", enabled: true, tags: ["product", "backend", "remote"], priority: 1, country: "global", remoteSupport: true },
  { id: "lattice-greenhouse", provider: "greenhouse", companyName: "Lattice", boardKey: "lattice", boardUrl: "https://boards-api.greenhouse.io/v1/boards/lattice/jobs", enabled: true, tags: ["hr", "saas", "remote"], priority: 2, country: "US", remoteSupport: true },
  { id: "embed-greenhouse", provider: "greenhouse", companyName: "Embed", boardKey: "embed", boardUrl: "https://boards-api.greenhouse.io/v1/boards/embed/jobs", enabled: true, tags: ["fintech", "remote"], priority: 2, country: "US", remoteSupport: true },
  { id: "stripe-greenhouse", provider: "greenhouse", companyName: "Stripe", boardKey: "stripe", boardUrl: "https://boards-api.greenhouse.io/v1/boards/stripe/jobs", enabled: true, tags: ["fintech", "backend", "remote"], priority: 1, country: "global", remoteSupport: true },
  { id: "discord-greenhouse", provider: "greenhouse", companyName: "Discord", boardKey: "discord", boardUrl: "https://boards-api.greenhouse.io/v1/boards/discord/jobs", enabled: true, tags: ["product", "backend", "remote"], priority: 1, country: "global", remoteSupport: true },
  { id: "datadog-greenhouse", provider: "greenhouse", companyName: "Datadog", boardKey: "datadog", boardUrl: "https://boards-api.greenhouse.io/v1/boards/datadog/jobs", enabled: true, tags: ["observability", "backend", "remote"], priority: 2, country: "global", remoteSupport: true },
  { id: "airbnb-greenhouse", provider: "greenhouse", companyName: "Airbnb", boardKey: "airbnb", boardUrl: "https://boards-api.greenhouse.io/v1/boards/airbnb/jobs", enabled: true, tags: ["product", "data", "remote"], priority: 1, country: "global", remoteSupport: true },
  { id: "dropbox-greenhouse", provider: "greenhouse", companyName: "Dropbox", boardKey: "dropbox", boardUrl: "https://boards-api.greenhouse.io/v1/boards/dropbox/jobs", enabled: true, tags: ["storage", "backend", "remote"], priority: 2, country: "global", remoteSupport: true },
  // Lever
  { id: "lever-demo", provider: "lever", companyName: "Lever (Demo)", boardKey: "leverdemo", boardUrl: "https://api.lever.co/v0/postings/leverdemo?mode=json", enabled: true, tags: ["demo"], priority: 10, country: "global", remoteSupport: true },
  { id: "netlify-lever", provider: "lever", companyName: "Netlify", boardKey: "netlify", boardUrl: "https://api.lever.co/v0/postings/netlify?mode=json", enabled: true, tags: ["frontend", "jamstack", "remote"], priority: 1, country: "global", remoteSupport: true },
  { id: "segment-lever", provider: "lever", companyName: "Segment", boardKey: "segment", boardUrl: "https://api.lever.co/v0/postings/segment?mode=json", enabled: true, tags: ["data", "backend", "remote"], priority: 2, country: "global", remoteSupport: true },
  { id: "squarespace-lever", provider: "lever", companyName: "Squarespace", boardKey: "squarespace", boardUrl: "https://api.lever.co/v0/postings/squarespace?mode=json", enabled: true, tags: ["product", "design", "remote"], priority: 2, country: "US", remoteSupport: true },
  { id: "box-lever", provider: "lever", companyName: "Box", boardKey: "box", boardUrl: "https://api.lever.co/v0/postings/box?mode=json", enabled: true, tags: ["enterprise", "backend", "remote"], priority: 2, country: "global", remoteSupport: true },
  // Workable
  { id: "workable-demo", provider: "workable", companyName: "Workable", boardKey: "workable", boardUrl: "https://apply.workable.com/api/v3/accounts/workable/jobs", enabled: true, tags: ["recruiting", "demo"], priority: 10, country: "global", remoteSupport: true },
  { id: "gitlab-workable", provider: "workable", companyName: "GitLab", boardKey: "gitlab", boardUrl: "https://apply.workable.com/api/v3/accounts/gitlab/jobs", enabled: true, tags: ["devops", "remote", "open-source"], priority: 1, country: "global", remoteSupport: true },
  // LinkedIn (discovery-only; searches built from Default Candidate profile: targetRoles, preferredLocations, workModes, skills)
  {
    id: "linkedin-profile",
    provider: "linkedin",
    companyName: "LinkedIn (candidate profile)",
    boardKey: "profile",
    boardUrl: "",
    searchUrl: "",
    enabled: false,
    tags: ["linkedin", "discovery"],
    priority: 5,
    country: "global",
    remoteSupport: true
  }
];

/** Board id -> enabled override. Loaded from BoardSettings in DB; falls back to board.enabled. */
let boardSettingsCache: Record<string, boolean> | null = null;

export function setBoardSettingsOverride(settings: Record<string, boolean>): void {
  boardSettingsCache = settings;
}

/** Load enabled overrides from DB. Call from sync/sources API so getBoardEnabled uses DB state. */
export async function loadBoardSettingsFromDb(): Promise<void> {
  const { connectToDatabase } = await import("@/lib/db");
  const { BoardSettings } = await import("@/models/BoardSettings");
  await connectToDatabase();
  const docs = await BoardSettings.find().lean();
  const next: Record<string, boolean> = {};
  for (const d of docs) next[(d as { boardId: string }).boardId] = (d as { enabled: boolean }).enabled;
  boardSettingsCache = next;
}

export function getBoardEnabled(board: BoardConfig): boolean {
  if (boardSettingsCache && board.id in boardSettingsCache) return boardSettingsCache[board.id];
  return board.enabled;
}

/** All boards from config. */
export function getAllBoards(): BoardConfig[] {
  return [...BOARDS];
}

/** Boards that are enabled (config or DB override). */
export function getEnabledBoards(): BoardConfig[] {
  return BOARDS.filter((b) => getBoardEnabled(b));
}

/** Get board by id. */
export function getBoardById(id: string): BoardConfig | undefined {
  return BOARDS.find((b) => b.id === id);
}

/** Boards grouped by provider. */
export function getBoardsByProvider(): Map<string, BoardConfig[]> {
  const map = new Map<string, BoardConfig[]>();
  for (const board of BOARDS) {
    const list = map.get(board.provider) ?? [];
    list.push(board);
    map.set(board.provider, list);
  }
  return map;
}

/** Enabled boards grouped by provider. */
export function getEnabledBoardsByProvider(): Map<string, BoardConfig[]> {
  const map = new Map<string, BoardConfig[]>();
  for (const board of getEnabledBoards()) {
    const list = map.get(board.provider) ?? [];
    list.push(board);
    map.set(board.provider, list);
  }
  return map;
}
