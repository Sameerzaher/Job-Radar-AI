import type { IJobSource } from "./types";
import type { IngestJobPayload } from "@/types/job";

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h = (h << 5) - h + c;
    h |= 0;
  }
  return Math.abs(h).toString(36);
}

function buildSamplePayloads(now: Date): IngestJobPayload[] {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return [
    {
      source: "LinkedIn",
      externalId: "li-js-1",
      title: "Junior Full Stack Developer (Node.js / React)",
      company: "Tel Aviv Tech Labs",
      location: "Tel Aviv, Israel",
      workMode: "Hybrid",
      url: "",
      description: "Build web apps with Node.js and React. Junior-friendly role.",
      skillsExtracted: ["Node.js", "React", "TypeScript", "Full Stack"],
      postedAt: weekAgo,
      foundAt: now,
      hash: simpleHash("li-js-1-Junior Full Stack Developer-Tel Aviv Tech Labs")
    },
    {
      source: "LinkedIn",
      externalId: "li-js-2",
      title: "Backend Developer - Node.js / MongoDB",
      company: "Cloud Pipeline",
      location: "Remote",
      workMode: "Remote",
      url: "",
      description: "Backend services with Node.js, MongoDB, and Docker.",
      skillsExtracted: ["Node.js", "MongoDB", "Docker", "Backend"],
      postedAt: weekAgo,
      foundAt: now,
      hash: simpleHash("li-js-2-Backend Developer-Cloud Pipeline")
    },
    {
      source: "Indeed",
      externalId: "ind-1",
      title: "Mid-level Next.js Engineer",
      company: "NextWave",
      location: "Remote",
      workMode: "Remote",
      url: "",
      description: "Next.js, React, TypeScript. Israel timezone friendly.",
      skillsExtracted: ["Next.js", "React", "TypeScript", "Full Stack"],
      postedAt: weekAgo,
      foundAt: now,
      hash: simpleHash("ind-1-Mid-level Next.js Engineer-NextWave")
    },
    {
      source: "Company Site",
      externalId: "direct-1",
      title: "Full Stack Developer",
      company: "StartupXYZ",
      location: "Haifa, Israel",
      workMode: "Hybrid",
      url: "",
      description: "Full stack role: Node, React, MongoDB.",
      skillsExtracted: ["Node.js", "React", "MongoDB", "TypeScript"],
      postedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      foundAt: now,
      hash: simpleHash("direct-1-Full Stack Developer-StartupXYZ")
    },
    {
      source: "LinkedIn",
      externalId: "li-js-3",
      title: "Backend Developer (Node.js)",
      company: "DataFlow Inc",
      location: "Remote",
      workMode: "Remote",
      url: "",
      description: "Node.js backend, Docker, MongoDB.",
      skillsExtracted: ["Node.js", "Docker", "MongoDB"],
      postedAt: weekAgo,
      foundAt: now,
      hash: simpleHash("li-js-3-Backend Developer-DataFlow Inc")
    }
  ];
}

/**
 * Sample job source for development/demo only. Returns static payloads with
 * empty URLs (so they show as "Unavailable" in the UI). Not used in production
 * sync; runSyncAll() uses only real sources from the source registry.
 */
export const sampleJobSource: IJobSource = {
  label: "sample",
  async fetchJobs(): Promise<IngestJobPayload[]> {
    return buildSamplePayloads(new Date());
  }
};
