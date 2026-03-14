/**
 * Classifies a job's URL for auto-apply: only official apply URLs are supported.
 * Custom career pages (e.g. jobs.company.com) are unsupported and get skipped_unsupported.
 */

export type UrlClassification =
  | "supported_apply_url"
  | "unsupported_custom_careers_page"
  | "invalid_url"
  | "unknown_provider";

/** Ingestion-specific: includes generic_careers_page for company careers landings. */
export type UrlQualityClassification =
  | "supported_apply_url"
  | "generic_careers_page"
  | "unsupported_custom_careers_page"
  | "invalid_url";

export interface ClassifyResult {
  classification: UrlClassification;
  hostname: string | null;
  provider: string | null;
  /** Suggested handler method when classification is supported_apply_url */
  method?: "greenhouse" | "lever" | "workable";
}

const GREENHOUSE_HOSTS = new Set(["boards.greenhouse.io", "grnh.se"]);
const LEVER_HOSTS = new Set(["jobs.lever.co"]);
const WORKABLE_HOSTS = new Set(["apply.workable.com"]);

/**
 * Classify job URL by source and hostname.
 * Returns supported_apply_url only when source matches an official apply host.
 */
export function classifyProviderUrl(
  source: string,
  url: string | undefined | null
): ClassifyResult {
  const trimmed = (url ?? "").trim();
  if (!trimmed) {
    return { classification: "invalid_url", hostname: null, provider: null };
  }

  let hostname: string;
  try {
    const u = new URL(trimmed);
    hostname = u.hostname.toLowerCase();
  } catch {
    return { classification: "invalid_url", hostname: null, provider: null };
  }

  if (source === "Greenhouse") {
    if (GREENHOUSE_HOSTS.has(hostname)) {
      return {
        classification: "supported_apply_url",
        hostname,
        provider: "Greenhouse",
        method: "greenhouse"
      };
    }
    return {
      classification: "unsupported_custom_careers_page",
      hostname,
      provider: "Greenhouse"
    };
  }

  if (source === "Lever") {
    if (LEVER_HOSTS.has(hostname)) {
      return {
        classification: "supported_apply_url",
        hostname,
        provider: "Lever",
        method: "lever"
      };
    }
    return {
      classification: "unsupported_custom_careers_page",
      hostname,
      provider: "Lever"
    };
  }

  if (source === "Workable") {
    if (WORKABLE_HOSTS.has(hostname)) {
      return {
        classification: "supported_apply_url",
        hostname,
        provider: "Workable",
        method: "workable"
      };
    }
    return {
      classification: "unsupported_custom_careers_page",
      hostname,
      provider: "Workable"
    };
  }

  return {
    classification: "unknown_provider",
    hostname,
    provider: source || null
  };
}

/**
 * Hostname or path patterns that indicate a generic careers landing page
 * (not a direct apply URL). Excludes our official apply hosts.
 */
function isGenericCareersPage(hostname: string, pathname: string): boolean {
  const path = pathname.toLowerCase().replace(/\/+$/, "");
  const pathSegments = path.split("/").filter(Boolean);
  if (hostname.startsWith("jobs.") || hostname.startsWith("careers.")) {
    if (
      GREENHOUSE_HOSTS.has(hostname) ||
      LEVER_HOSTS.has(hostname) ||
      WORKABLE_HOSTS.has(hostname)
    ) {
      return false;
    }
    return true;
  }
  if (pathSegments[0] === "careers" || pathSegments[0] === "jobs") {
    const hasJobId =
      pathSegments.length > 1 &&
      /^[a-z0-9-]+$/i.test(pathSegments[1]) &&
      pathSegments[1].length > 3;
    if (!hasJobId) return true;
  }
  return false;
}

export interface UrlQualityResult {
  classification: UrlQualityClassification;
  autoApplySupported: boolean;
  hostname: string | null;
}

/**
 * Classify URL quality for ingestion. Prefer direct apply URLs; detect generic careers pages.
 */
export function classifyUrlQualityForIngestion(
  source: string,
  url: string | undefined | null
): UrlQualityResult {
  const base = classifyProviderUrl(source, url);
  if (base.classification === "invalid_url") {
    return {
      classification: "invalid_url",
      autoApplySupported: false,
      hostname: null
    };
  }
  if (base.classification === "supported_apply_url") {
    return {
      classification: "supported_apply_url",
      autoApplySupported: true,
      hostname: base.hostname
    };
  }
  if (base.classification === "unknown_provider") {
    return {
      classification: "unsupported_custom_careers_page",
      autoApplySupported: false,
      hostname: base.hostname
    };
  }
  const trimmed = (url ?? "").trim();
  let pathname = "/";
  if (base.hostname && trimmed) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      pathname = "/";
    }
  }
  if (base.hostname && isGenericCareersPage(base.hostname, pathname)) {
    return {
      classification: "generic_careers_page",
      autoApplySupported: false,
      hostname: base.hostname
    };
  }
  return {
    classification: "unsupported_custom_careers_page",
    autoApplySupported: false,
    hostname: base.hostname
  };
}

export const SUPPORTED_PROVIDERS = ["Greenhouse", "Lever", "Workable"] as const;
