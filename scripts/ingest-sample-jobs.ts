import "dotenv/config";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/services/userService";
import { ingestJobs } from "@/services/ingestionService";
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

const now = new Date();
const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

const sampleJobs: IngestJobPayload[] = [
  {
    source: "LinkedIn",
    externalId: "li-js-1",
    title: "Junior Full Stack Developer (Node.js / React)",
    company: "Tel Aviv Tech Labs",
    location: "Tel Aviv, Israel",
    workMode: "Hybrid",
    url: "https://example.com/jobs/junior-fullstack",
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
    url: "https://example.com/jobs/backend-node",
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
    url: "https://example.com/jobs/nextjs",
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
    url: "https://example.com/jobs/startupxyz",
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
    url: "https://example.com/jobs/dataflow",
    description: "Node.js backend, Docker, MongoDB.",
    skillsExtracted: ["Node.js", "Docker", "MongoDB"],
    postedAt: weekAgo,
    foundAt: now,
    hash: simpleHash("li-js-3-Backend Developer-DataFlow Inc")
  }
];

async function main() {
  await connectToDatabase();
  const user = await getOrCreateDefaultUser();

  const result = await ingestJobs(user, sampleJobs);

  console.log(`Inserted: ${result.inserted}, Skipped (duplicates): ${result.skipped}`);
  if (result.errors.length) {
    console.error("Errors:", result.errors);
  }
  console.log("Ingest completed.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
