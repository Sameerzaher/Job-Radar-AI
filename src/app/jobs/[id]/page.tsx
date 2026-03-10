import { notFound } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { getOrCreateDefaultUser } from "@/services/userService";
import {
  getJobById,
  getMatchForJobAndUser,
  getJobLink,
  runAIAnalysisAndSave,
  runResumeTailoringAndSave,
  updateJobStatus
} from "@/services/jobService";
import type { JobStatus } from "@/models/Job";
import { scoreJobForUser } from "@/services/scoring";
import { isOpenAIAvailable } from "@/lib/openai";
import { JobDetailsView } from "./JobDetailsView";

export const dynamic = "force-dynamic";

async function analyzeJobAction(jobId: string) {
  "use server";
  const user = await getOrCreateDefaultUser();
  await runAIAnalysisAndSave(jobId, user);
  revalidatePath(`/jobs/${jobId}`);
}

async function tailorResumeAction(jobId: string) {
  "use server";
  const user = await getOrCreateDefaultUser();
  await runResumeTailoringAndSave(jobId, user);
  revalidatePath(`/jobs/${jobId}`);
}

async function updateStatusAction(jobId: string, status: JobStatus) {
  "use server";
  await updateJobStatus(jobId, status);
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${jobId}`);
}

type Props = { params: Promise<{ id: string }> };

export default async function JobDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getOrCreateDefaultUser();
  const job = await getJobById(id);
  if (!job) notFound();

  const match = await getMatchForJobAndUser(id, user._id);
  const scoreResult = scoreJobForUser(job as import("@/models/Job").IJob, user);
  const jobLinkUrl = getJobLink(job as import("@/models/Job").IJob & { url?: string; externalUrl?: string });
  const openAIAvailable = isOpenAIAvailable();
  const hasResume = Boolean(user.resumeText && user.resumeText.trim().length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Link href="/jobs" className="hover:text-slate-200">
          ← Jobs
        </Link>
      </div>

      <JobDetailsView
        jobId={id}
        job={job}
        match={match}
        scoreResult={scoreResult}
        jobLinkUrl={jobLinkUrl}
        openAIAvailable={openAIAvailable}
        analyzeAction={analyzeJobAction}
        tailorResumeAction={tailorResumeAction}
        hasResume={hasResume}
        updateStatusAction={updateStatusAction}
      />
    </div>
  );
}
