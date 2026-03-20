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
  updateJobStatus,
  updateMatchSelectedApplyProfile
} from "@/services/jobService";
import type { JobStatus } from "@/models/Job";
import { scoreJobForUser } from "@/services/scoring";
import { isOpenAIAvailable } from "@/lib/openai";
import { selectBestApplyProfile } from "@/services/applyProfiles/selectApplyProfile";
import { listApplyProfilesByUser } from "@/services/applyProfiles/applyProfileService";
import { getCompanyMemoryByUserAndCompany } from "@/services/companyMemory/companyMemoryService";
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

async function setSelectedApplyProfileAction(matchId: string, applyProfileId: string | null, jobId: string) {
  "use server";
  const user = await getOrCreateDefaultUser();
  await updateMatchSelectedApplyProfile(matchId, user._id, applyProfileId);
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
  const hasValidJobLink = jobLinkUrl != null;
  const openAIAvailable = isOpenAIAvailable();
  const hasResume = Boolean(user.resumeText && user.resumeText.trim().length > 0);

  const companyMemoryRaw = await getCompanyMemoryByUserAndCompany(user._id, (job as { company?: string }).company ?? "");
  const companyMemory = companyMemoryRaw
    ? {
        displayCompanyName: companyMemoryRaw.displayCompanyName,
        lastAppliedAt: companyMemoryRaw.lastAppliedAt ? companyMemoryRaw.lastAppliedAt.toISOString() : null,
        lastAppliedRole: companyMemoryRaw.lastAppliedRole ?? "",
        lastOutcome: companyMemoryRaw.lastOutcome ?? null,
        totalApplications: companyMemoryRaw.totalApplications ?? 0,
        totalApplied: companyMemoryRaw.totalApplied ?? 0,
        totalFailed: companyMemoryRaw.totalFailed ?? 0,
        totalNeedsReview: companyMemoryRaw.totalNeedsReview ?? 0,
        lastApplyProfileName: companyMemoryRaw.lastApplyProfileName ?? ""
      }
    : null;

  let applyProfileSelection: { selectedProfileName: string; reasons: string[]; useUserFallback: boolean } | null = null;
  let applyProfiles: { _id: string; name: string }[] = [];
  const matchForSelection = match as import("@/models/Match").IMatch | null;
  if (matchForSelection && job) {
    const sel = await selectBestApplyProfile(user, job as import("@/models/Job").IJob, matchForSelection);
    applyProfileSelection = {
      selectedProfileName: sel.selectedProfile?.name ?? "User profile",
      reasons: sel.reasons,
      useUserFallback: sel.useUserFallback
    };
    applyProfiles = (await listApplyProfilesByUser(String(user._id))).map((p) => ({
      _id: String(p._id),
      name: p.name
    }));
  }

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
        hasValidJobLink={hasValidJobLink}
        openAIAvailable={openAIAvailable}
        analyzeAction={analyzeJobAction}
        tailorResumeAction={tailorResumeAction}
        hasResume={hasResume}
        updateStatusAction={updateStatusAction}
        applyProfileSelection={applyProfileSelection}
        applyProfiles={applyProfiles}
        matchId={match ? String((match as { _id: unknown })._id) : null}
        selectedApplyProfileId={match ? (match as { selectedApplyProfileId?: unknown }).selectedApplyProfileId : null}
        setSelectedApplyProfileAction={(matchId, profileId) => setSelectedApplyProfileAction(matchId, profileId, id)}
        companyMemory={companyMemory}
      />
    </div>
  );
}
