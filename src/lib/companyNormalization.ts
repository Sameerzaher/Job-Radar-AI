/**
 * Normalize company names for consistent matching and storage.
 * "Figma", "Figma, Inc.", "figma" → same normalized key.
 */

const SUFFIXES = [
  /,?\s*inc\.?$/i,
  /,?\s*incorporated$/i,
  /,?\s*llc\.?$/i,
  /,?\s*l\.l\.c\.?$/i,
  /,?\s*limited$/i,
  /,?\s*ltd\.?$/i,
  /,?\s*corp\.?$/i,
  /,?\s*corporation$/i,
  /,?\s*co\.?$/i,
  /,?\s*company$/i,
  /,?\s*gmbh$/i,
  /,?\s*ag$/i,
  /,?\s*plc$/i,
  /,?\s*sa$/i,
  /,?\s*n\.v\.?$/i,
  /,?\s*s\.a\.?$/i,
  /,?\s*group$/i
];

/**
 * Normalize for storage/key: trim, lowercase, remove common suffixes, collapse spaces.
 * Use this as the unique key per user+company.
 */
export function normalizeCompanyName(displayName: string): string {
  if (!displayName || typeof displayName !== "string") return "";
  let s = displayName.trim().replace(/\s+/g, " ");
  for (const suffix of SUFFIXES) {
    s = s.replace(suffix, "");
  }
  s = s.replace(/,+\s*$/, "").trim().toLowerCase();
  return s || displayName.trim().toLowerCase();
}

/**
 * Display name: keep original casing and punctuation for UI, or fallback to normalized.
 */
export function displayCompanyName(displayName: string): string {
  if (!displayName || typeof displayName !== "string") return "";
  return displayName.trim();
}
