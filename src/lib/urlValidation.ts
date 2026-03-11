/**
 * Validates that a string is a real external job URL (http/https) and not a placeholder.
 */

const PLACEHOLDER_HOSTS = new Set([
  "example.com",
  "www.example.com",
  "example.org",
  "test.com",
  "localhost",
  "127.0.0.1",
  "dummy.com",
  "placeholder.com",
  "fake.com",
  "example.net"
]);

const PLACEHOLDER_PATTERNS = [
  /^#$/,
  /^#\s*$/,
  /^about:blank$/i,
  /^javascript:/i,
  /^data:/i
];

/**
 * Returns true only if the URL is a valid http/https URL and not a known placeholder.
 * Rejects: empty, "#", localhost, example.com, dummy/fake domains, non-http(s).
 */
export function isValidJobUrl(url: string | undefined | null): boolean {
  if (url == null || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed === "") return false;
  if (trimmed === "#") return false;
  if (PLACEHOLDER_PATTERNS.some((re) => re.test(trimmed))) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (PLACEHOLDER_HOSTS.has(host)) return false;
  if (host.endsWith(".example.com") || host.endsWith(".example.org")) return false;

  return true;
}

/**
 * Returns the URL to use for opening the job externally, or null if not available.
 * Prefers job.url, then job.externalUrl; validates before returning.
 */
export function getValidJobUrl(job: { url?: string; externalUrl?: string } | null | undefined): string | null {
  if (!job) return null;
  const candidate = job.url ?? job.externalUrl ?? null;
  if (candidate == null) return null;
  return isValidJobUrl(candidate) ? candidate.trim() : null;
}

/**
 * Resolve a possibly relative URL to an absolute URL. Rejects empty/invalid.
 * Use before validation when a source may return relative links.
 */
export function normalizeToAbsoluteUrl(url: string | undefined | null, baseUrl: string): string | null {
  if (url == null || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (trimmed === "" || trimmed === "#") return null;
  try {
    const absolute = new URL(trimmed, baseUrl).href;
    return absolute;
  } catch {
    return null;
  }
}
