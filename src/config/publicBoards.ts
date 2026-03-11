/**
 * Registry of supported public job boards for sync.
 * Used by /api/sync/greenhouse, /api/sync/lever, and /api/sync/all.
 */

export type PublicBoardProvider = "greenhouse" | "lever" | "workable";

export interface PublicBoardConfig {
  provider: PublicBoardProvider;
  /** API company/board key (boardToken for Greenhouse, company slug for Lever, account for Workable) */
  companyKey: string;
  /** Display name for the Job model and UI */
  companyName: string;
  /** Human-readable API URL for reference (optional) */
  apiUrl?: string;
}

const GREENHOUSE_BASE = "https://boards-api.greenhouse.io/v1/boards";
const LEVER_BASE = "https://api.lever.co/v0/postings";
const WORKABLE_BASE = "https://apply.workable.com/api/v3/accounts";

export const PUBLIC_BOARDS: PublicBoardConfig[] = [
  // Greenhouse
  { provider: "greenhouse", companyKey: "vercel", companyName: "Vercel", apiUrl: `${GREENHOUSE_BASE}/vercel/jobs?content=true` },
  { provider: "greenhouse", companyKey: "lattice", companyName: "Lattice", apiUrl: `${GREENHOUSE_BASE}/lattice/jobs?content=true` },
  { provider: "greenhouse", companyKey: "embed", companyName: "Embed", apiUrl: `${GREENHOUSE_BASE}/embed/jobs?content=true` },
  { provider: "greenhouse", companyKey: "figma", companyName: "Figma", apiUrl: `${GREENHOUSE_BASE}/figma/jobs?content=true` },
  { provider: "greenhouse", companyKey: "notion", companyName: "Notion", apiUrl: `${GREENHOUSE_BASE}/notion/jobs?content=true` },
  // Lever: slug must match https://jobs.lever.co/{slug}.
  { provider: "lever", companyKey: "leverdemo", companyName: "Lever (Demo)", apiUrl: `${LEVER_BASE}/leverdemo?mode=json` },
  // Workable: account slug from apply.workable.com/{account}. Add boards that return 200.
  { provider: "workable", companyKey: "workable", companyName: "Workable", apiUrl: `${WORKABLE_BASE}/workable/jobs?state=published` }
];

export function getGreenhouseBoards(): PublicBoardConfig[] {
  return PUBLIC_BOARDS.filter((b) => b.provider === "greenhouse");
}

export function getLeverBoards(): PublicBoardConfig[] {
  return PUBLIC_BOARDS.filter((b) => b.provider === "lever");
}

export function getWorkableBoards(): PublicBoardConfig[] {
  return PUBLIC_BOARDS.filter((b) => b.provider === "workable");
}
