import Link from "next/link";
import { getOrCreateDefaultUser } from "@/services/userService";
import { listTailoredApplicationsForUser } from "@/services/tailoredApplicationService";
import { PageHeader, SectionCard, Badge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function TailoredListPage() {
  const user = await getOrCreateDefaultUser();
  const list = await listTailoredApplicationsForUser(
    (user as { _id: { toString(): string } })._id.toString()
  );

  return (
    <div className="space-y-ds-section">
      <PageHeader
        title="Tailored applications"
        description="Job-specific resume suggestions and cover letters. Generate from Review queue or job details, then approve before applying."
      />
      {list.length === 0 ? (
        <SectionCard>
          <p className="text-ds-body text-slate-400">No tailored applications yet.</p>
          <p className="mt-1 text-ds-caption text-slate-500">
            Go to <Link href="/review" className="text-sky-400 hover:underline">Review</Link> and
            use &quot;Tailor&quot; on a job to generate a tailored resume summary, bullet points,
            cover letter, and recruiter message.
          </p>
        </SectionCard>
      ) : (
        <SectionCard>
          <ul className="space-y-4">
            {list.map((t) => {
              const job = t.job as { _id: unknown; title?: string; company?: string; source?: string };
              const match = t.match as { score?: number } | undefined;
              const score = match?.score ?? null;
              return (
                <li
                  key={String(t._id)}
                  className="rounded-ds-lg border border-slate-700/60 bg-slate-800/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/tailored/${t._id}`}
                        className="text-ds-body font-semibold text-slate-100 hover:text-sky-300"
                      >
                        {job?.title ?? "Job"}
                      </Link>
                      <p className="text-ds-caption text-slate-500">
                        {job?.company ?? ""} · {job?.source ?? ""}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {score != null && (
                          <Badge variant="neutral">Score: {score}</Badge>
                        )}
                        <Badge variant="default">{t.status}</Badge>
                      </div>
                    </div>
                    <Link
                      href={`/tailored/${t._id}`}
                      className="inline-flex items-center justify-center rounded-ds-lg border border-slate-600 bg-transparent px-3 py-1.5 text-ds-caption font-medium text-slate-300 hover:bg-slate-800"
                    >
                      View
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
