import type { IngestJobPayload } from "@/types/job";
import type { JobWorkMode } from "@/models/Job";

export function makeHash(value: string): string {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    h = (h << 5) - h + c;
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

export function inferWorkModeFromText(text: string | undefined | null): JobWorkMode | undefined {
  if (!text) return undefined;
  const lower = text.toLowerCase();
  if (lower.includes("remote")) return "Remote";
  if (lower.includes("hybrid")) return "Hybrid";
  if (lower.includes("onsite") || lower.includes("on-site") || lower.includes("office")) {
    return "Onsite";
  }
  return undefined;
}

export function normalizeIngestPayload(input: {
  source: string;
  externalId: string;
  title: string;
  company: string;
  location: string;
  url: string;
  description?: string;
  workModeText?: string;
  skills?: string[];
  postedAt?: Date | string | null;
  foundAt?: Date;
}): IngestJobPayload {
  const workMode = inferWorkModeFromText(input.workModeText ?? `${input.location} ${input.description ?? ""}`);
  const postedAtDate =
    typeof input.postedAt === "string"
      ? new Date(input.postedAt)
      : input.postedAt ?? undefined;

  const foundAt = input.foundAt ?? new Date();

  const hash = makeHash(
    `${input.source}:${input.externalId}:${input.title}:${input.company}:${input.location}`
  );

  return {
    source: input.source,
    externalId: input.externalId,
    title: input.title,
    company: input.company,
    location: input.location,
    workMode,
    url: input.url,
    description: input.description ?? "",
    skillsExtracted: input.skills ?? [],
    postedAt: postedAtDate ?? foundAt,
    foundAt,
    hash
  };
}

