/**
 * Generate a short hash from a string (for deduplication).
 */
export function stringHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = (h << 5) - h + c;
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

/**
 * Generate externalId from URL path or fallback to hash of title+company.
 */
export function externalIdFromUrl(url: string): string {
  try {
    const path = new URL(url, "http://localhost").pathname;
    const slug = path.replace(/^\/+|\/+$/g, "").replace(/\//g, "-");
    if (slug) return slug;
  } catch {
    // ignore
  }
  return stringHash(url);
}

/**
 * Parse a loose date string (YYYY-MM-DD or similar) to Date.
 */
export function parsePostedDate(value: string | null | undefined): Date {
  if (!value || typeof value !== "string") return new Date();
  const trimmed = value.replace(/^Posted:\s*/i, "").trim();
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}
