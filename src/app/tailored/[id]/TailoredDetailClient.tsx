"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  SectionCard,
  Button
} from "@/components/ui";
import {
  regenerateTailoring,
  approveTailored,
  markTailoredUsed
} from "@/app/tailored/actions";
import type { ITailoredApplication } from "@/models/TailoredApplication";

type TailoredWithPopulated = ITailoredApplication & {
  job?: { _id?: unknown; jobId?: string };
};

type Props = {
  tailoredId: string;
  tailored: TailoredWithPopulated;
  jobId: string;
};

export function TailoredDetailClient({ tailoredId, tailored, jobId }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function runAction(
    label: string,
    fn: () => Promise<unknown>
  ) {
    setLoading(label);
    try {
      await fn();
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  function copyToClipboard(text: string, label: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setLoading(`Copied ${label}`);
    setTimeout(() => setLoading(null), 1500);
  }

  const matchId = (tailored.match as { _id?: unknown })?._id ?? tailored.match;
  const canGenerate = tailored.status === "draft" || tailored.status === "failed";
  const canRegenerate = ["generated", "approved", "used"].includes(tailored.status);
  const canApprove = tailored.status === "generated";
  const canMarkUsed = tailored.status === "approved" || tailored.status === "used";

  return (
    <div className="space-y-6">
      <SectionCard>
        <h2 className="text-ds-title font-semibold text-slate-100">Actions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {canGenerate && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!!loading}
              onClick={() =>
                runAction("Generate", () => regenerateTailoring(tailoredId))
              }
            >
              {loading === "Generate" ? "Generating..." : "Generate"}
            </Button>
          )}
          {canRegenerate && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!!loading}
              onClick={() =>
                runAction("Regenerate", () => regenerateTailoring(tailoredId))
              }
            >
              {loading === "Regenerate" ? "Regenerating..." : "Regenerate"}
            </Button>
          )}
          {canApprove && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={!!loading}
              onClick={() =>
                runAction("Approve", () => approveTailored(tailoredId))
              }
            >
              {loading === "Approve" ? "..." : "Approve"}
            </Button>
          )}
          {canMarkUsed && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!!loading}
              onClick={() =>
                runAction("Mark used", () => markTailoredUsed(tailoredId))
              }
            >
              {loading === "Mark used" ? "..." : "Mark as used"}
            </Button>
          )}
          <Link href={`/jobs/${jobId}`}>
            <Button type="button" variant="secondary" size="sm">
              View job
            </Button>
          </Link>
        </div>
        {loading && loading.startsWith("Copied") && (
          <p className="mt-2 text-ds-caption text-slate-400">{loading}</p>
        )}
      </SectionCard>

      {tailored.failureReason && (
        <SectionCard>
          <h2 className="text-ds-title font-semibold text-amber-400">Failure</h2>
          <p className="mt-1 text-ds-body text-slate-300">{tailored.failureReason}</p>
        </SectionCard>
      )}

      {tailored.resumeSummary && (
        <SectionCard>
          <h2 className="text-ds-title font-semibold text-slate-100">Resume summary</h2>
          <p className="mt-2 whitespace-pre-wrap text-ds-body text-slate-300">
            {tailored.resumeSummary}
          </p>
        </SectionCard>
      )}

      {tailored.suggestedBulletPoints?.length > 0 && (
        <SectionCard>
          <h2 className="text-ds-title font-semibold text-slate-100">Suggested bullet points</h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-ds-body text-slate-300">
            {tailored.suggestedBulletPoints.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </SectionCard>
      )}

      {tailored.strengths?.length > 0 && (
        <SectionCard>
          <h2 className="text-ds-title font-semibold text-slate-100">Strengths</h2>
          <p className="mt-2 text-ds-body text-slate-300">
            {tailored.strengths.join(", ")}
          </p>
        </SectionCard>
      )}

      {tailored.missingSkills?.length > 0 && (
        <SectionCard>
          <h2 className="text-ds-title font-semibold text-amber-400">Missing skills</h2>
          <p className="mt-2 text-ds-body text-slate-300">
            {tailored.missingSkills.join(", ")}
          </p>
        </SectionCard>
      )}

      {tailored.coverLetter && (
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-ds-title font-semibold text-slate-100">Cover letter</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => copyToClipboard(tailored.coverLetter!, "cover letter")}
            >
              {loading === "Copied cover letter" ? "Copied" : "Copy cover letter"}
            </Button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap font-sans text-ds-body text-slate-300">
            {tailored.coverLetter}
          </pre>
        </SectionCard>
      )}

      {tailored.recruiterMessage && (
        <SectionCard>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-ds-title font-semibold text-slate-100">Recruiter message</h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => copyToClipboard(tailored.recruiterMessage!, "recruiter message")}
            >
              {loading === "Copied recruiter message" ? "Copied" : "Copy recruiter message"}
            </Button>
          </div>
          <p className="mt-2 text-ds-body text-slate-300">{tailored.recruiterMessage}</p>
        </SectionCard>
      )}

      {tailored.generatedAt && (
        <p className="text-ds-caption text-slate-500">
          Generated at {new Date(tailored.generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
