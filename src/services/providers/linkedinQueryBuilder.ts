/**
 * Builds LinkedIn job search URLs from the Default Candidate user profile.
 * No hardcoded search terms; uses targetRoles, preferredLocations, workModes, skills.
 */

import type { IUser } from "@/models/User";

const LINKEDIN_JOBS_BASE = "https://www.linkedin.com/jobs/search/";

export interface LinkedInSearchConfig {
  role: string;
  location: string;
  searchUrl: string;
  keywords: string;
}

/**
 * Builds an array of LinkedIn search configs from the candidate profile.
 * Strategy: one query per (targetRole × location), plus optional skill-enhanced variants per role.
 * Locations come from preferredLocations; "Remote" is added if workModes includes Remote.
 * If profile has no targetRoles, returns [] and no hardcoded fallback is used.
 */
export function buildLinkedInSearchQueriesFromUser(user: IUser): LinkedInSearchConfig[] {
  const rawRoles = user.targetRoles ?? [];
  const skills = user.skills ?? [];
  const preferredLocations = user.preferredLocations ?? [];
  const workModes = user.workModes ?? [];

  // Build location list: preferredLocations + Remote if user wants remote
  const locations = [...new Set(preferredLocations)];
  if (workModes.some((m) => String(m).toLowerCase() === "remote") && !locations.some((l) => /remote/i.test(l))) {
    locations.push("Remote");
  }
  if (locations.length === 0) {
    locations.push("Remote");
  }

  // Prioritize specific roles for relevance
  const preferredRoleOrder = ["Full Stack Developer", "Backend Developer"];
  const prioritizedRoles: string[] = [];
  for (const name of preferredRoleOrder) {
    const matched = rawRoles.find((r) => r.trim().toLowerCase() === name.toLowerCase());
    if (matched) prioritizedRoles.push(matched.trim());
  }
  // Fallback: include any other roles, but de-duplicate
  for (const r of rawRoles) {
    const roleTrim = r.trim();
    if (!roleTrim) continue;
    if (!prioritizedRoles.some((x) => x.toLowerCase() === roleTrim.toLowerCase())) {
      prioritizedRoles.push(roleTrim);
    }
  }

  if (prioritizedRoles.length === 0) {
    return [];
  }

  const configs: LinkedInSearchConfig[] = [];

  // Skill boosting: prefer these skills when present
  const BOOSTED_SKILLS_ORDER = ["Node.js", "React", "Next.js", "TypeScript", "MongoDB", "Docker"];
  const boostedSkills: string[] = [];
  for (const s of BOOSTED_SKILLS_ORDER) {
    const matched = skills.find((sk) => sk.trim().toLowerCase() === s.toLowerCase());
    if (matched) boostedSkills.push(matched.trim());
  }

  for (const role of prioritizedRoles) {
    const roleTrim = role.trim();
    if (!roleTrim) continue;

    for (const location of locations) {
      const locTrim = location.trim();
      if (!locTrim) continue;

      // Base query: role only
      const keywords = roleTrim;
      const searchUrl = buildLinkedInSearchUrl(keywords, locTrim);
      configs.push({
        role: roleTrim,
        location: locTrim,
        searchUrl,
        keywords: roleTrim
      });
    }

    // Skill-focused queries for this role: use boosted skills list (up to 2 to avoid explosion)
    const topSkills = boostedSkills.slice(0, 2);
    for (const skill of topSkills) {
      const skillTrim = skill.trim();
      if (!skillTrim) continue;
      for (const location of locations) {
        const locTrim = location.trim();
        if (!locTrim) continue;
        const keywords = `${roleTrim} ${skillTrim}`;
        const searchUrl = buildLinkedInSearchUrl(keywords, locTrim);
        configs.push({
          role: roleTrim,
          location: locTrim,
          searchUrl,
          keywords
        });
      }
    }
  }

  // Limit to a small high-quality set (4–8 max)
  // Keep first 8 to avoid too many LinkedIn requests.
  return configs.slice(0, 8);
}

function buildLinkedInSearchUrl(keywords: string, location: string): string {
  const params = new URLSearchParams();
  params.set("keywords", keywords);
  params.set("location", location);
  return `${LINKEDIN_JOBS_BASE}?${params.toString()}`;
}
