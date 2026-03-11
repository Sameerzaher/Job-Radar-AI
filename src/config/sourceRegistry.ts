/**
 * Registry of real job sources. Used by sync to fetch only from providers
 * that expose real job posting URLs (Greenhouse, Lever, Workable, Ashby, etc.).
 * Demo/sample source is not included; use only for development.
 */

import type { IJobSource } from "@/services/sources/types";
import { createGreenhouseSource } from "@/services/sources/greenhouseSource";
import { createLeverSource } from "@/services/sources/leverSource";
import { createWorkableSource } from "@/services/sources/workableSource";
import { createAshbySource } from "@/services/sources/ashbySource";
import { createPlaywrightJobSource } from "@/services/sources/playwrightJobSource";

export type SourceProviderType = "greenhouse" | "lever" | "workable" | "ashby" | "playwright";

export interface SourceConfig {
  name: string;
  provider: SourceProviderType;
  /** For playwright: careers page URL. For API sources: not used. */
  baseUrl?: string;
  /** Greenhouse: boardToken + companyName. Lever: company slug. Workable: account + companyName. Ashby: orgSlug + companyName. */
  config: Record<string, string>;
}

/**
 * Primary sources: Greenhouse + Lever. Feeds the main jobs table with real jobs
 * and real external URLs. Boards aligned with publicBoards.ts.
 */
const PRIMARY_SOURCE_CONFIGS: SourceConfig[] = [
  { name: "Vercel", provider: "greenhouse", config: { boardToken: "vercel", companyName: "Vercel" } },
  { name: "Lattice", provider: "greenhouse", config: { boardToken: "lattice", companyName: "Lattice" } },
  { name: "Embed", provider: "greenhouse", config: { boardToken: "embed", companyName: "Embed" } },
  { name: "Figma", provider: "greenhouse", config: { boardToken: "figma", companyName: "Figma" } },
  { name: "Notion", provider: "greenhouse", config: { boardToken: "notion", companyName: "Notion" } },
  { name: "Lever (Demo)", provider: "lever", config: { company: "leverdemo", companyName: "Lever (Demo)" } },
  { name: "Workable", provider: "workable", config: { account: "workable", companyName: "Workable" } }
];

/**
 * All real sources (primary + workable/ashby). Use for extended sync if needed.
 */
const REAL_SOURCE_CONFIGS: SourceConfig[] = [...PRIMARY_SOURCE_CONFIGS];

function buildSourceFromConfig(sc: SourceConfig): IJobSource {
  switch (sc.provider) {
    case "greenhouse":
      return createGreenhouseSource({
        boardToken: sc.config.boardToken!,
        companyName: sc.config.companyName!
      });
    case "lever":
      return createLeverSource({
        company: sc.config.company!,
        companyName: sc.config.companyName ?? sc.config.company
      });
    case "workable":
      return createWorkableSource({
        account: sc.config.account!,
        companyName: sc.config.companyName!
      });
    case "ashby":
      return createAshbySource({
        orgSlug: sc.config.orgSlug!,
        companyName: sc.config.companyName!
      });
    case "playwright":
      return createPlaywrightJobSource({
        careersUrl: sc.baseUrl ?? sc.config.careersUrl,
        headless: true
      });
    default:
      throw new Error(`Unknown provider: ${(sc as SourceConfig).provider}`);
  }
}

/**
 * Primary sources: Greenhouse and Lever only. Use for the main jobs table sync.
 */
export function getPrimaryJobSources(): IJobSource[] {
  return PRIMARY_SOURCE_CONFIGS.map((sc) => buildSourceFromConfig(sc));
}

/**
 * Returns all registered real job sources (primary + any extra). Demo/sample never included.
 */
export function getRealJobSources(): IJobSource[] {
  return REAL_SOURCE_CONFIGS.map((sc) => buildSourceFromConfig(sc));
}

/**
 * Optional: include a custom Playwright careers page from env (e.g. SCRAPER_CAREERS_URL).
 * Only included if the URL is set and valid (not a sample/demo page).
 */
export function getOptionalPlaywrightSource(): IJobSource | null {
  const url = process.env.SCRAPER_CAREERS_URL;
  if (!url || url.includes("localhost") || url.includes("careers-sample")) {
    return null;
  }
  return createPlaywrightJobSource({ careersUrl: url, headless: true });
}
