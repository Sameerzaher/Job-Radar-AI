import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrCreateDefaultUser } from "@/services/userService";
import { getTailoredApplicationById } from "@/services/tailoredApplicationService";
import { PageHeader, Badge } from "@/components/ui";
import { TailoredDetailClient } from "./TailoredDetailClient";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function TailoredDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getOrCreateDefaultUser();
  const tailored = await getTailoredApplicationById(
    id,
    (user as { _id: { toString(): string } })._id.toString()
  );
  if (!tailored) notFound();

  const job = tailored.job as { _id: unknown; title?: string; company?: string; source?: string; jobId?: string };
  const match = tailored.match as { _id?: unknown; score?: number } | undefined;

  return (
    <div className="space-y-ds-section">
      <div className="flex items-center gap-3 text-sm text-slate-400">
        <Link href="/tailored" className="hover:text-slate-200">
          ← Tailored
        </Link>
      </div>
      <PageHeader
        title={job?.title ?? "Tailored application"}
        description={`${job?.company ?? ""} · ${job?.source ?? ""}`}
      />
      <div className="flex flex-wrap gap-2">
        {match?.score != null && (
          <Badge variant="neutral">Score: {match.score}</Badge>
        )}
        <Badge variant="default">{tailored.status}</Badge>
        {tailored.aiModel && (
          <Badge variant="source">{tailored.aiModel}</Badge>
        )}
      </div>

      <TailoredDetailClient
        tailoredId={id}
        tailored={tailored}
        jobId={String(job?._id ?? job?.jobId ?? "")}
      />
    </div>
  );
}
