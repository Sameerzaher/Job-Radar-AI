import "dotenv/config";
import { connectToDatabase } from "@/lib/db";
import { getOrCreateDefaultUser } from "@/services/userService";
import { Job } from "@/models/Job";
import { createJobForUser } from "@/services/jobService";

async function main() {
  await connectToDatabase();

  const user = await getOrCreateDefaultUser();

  const existingJobs = await Job.countDocuments();
  if (existingJobs > 0) {
    console.log(`Skipping: ${existingJobs} jobs already present.`);
    return;
  }

  const sampleJobs = [
    {
      title: "Junior Full Stack Developer (Node.js / React)",
      company: "Tel Aviv Tech Labs",
      location: "Tel Aviv, Israel · Hybrid",
      source: "Manual seed",
      url: "",
      status: "new",
      tags: ["Node.js", "React", "TypeScript", "Full Stack", "Hybrid"]
    },
    {
      title: "Backend Developer - Node.js / MongoDB",
      company: "Cloud Pipeline",
      location: "Remote",
      source: "Manual seed",
      url: "",
      status: "saved",
      tags: ["Node.js", "MongoDB", "Docker", "Backend", "Remote"]
    },
    {
      title: "Mid-level Next.js Engineer",
      company: "NextWave",
      location: "Remote (Israel friendly)",
      source: "Manual seed",
      url: "",
      status: "interested",
      tags: ["Next.js", "React", "TypeScript", "Full Stack", "Remote"]
    }
  ] as const;

  for (const job of sampleJobs) {
    const { job: created, match } = await createJobForUser(user, job as any);
    console.log(
      `Created job "${created.title}" with score ${match.score.toFixed(0)}`
    );
  }
}

main()
  .then(() => {
    console.log("Seed completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

