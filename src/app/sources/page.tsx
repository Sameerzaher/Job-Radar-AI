import Link from "next/link";
import { getBoardsWithMeta } from "@/services/discovery/boardService";
import { PageHeader, SectionCard, Badge, Button } from "@/components/ui";
import { SourcesListClient } from "@/components/sources/SourcesListClient";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const boards = await getBoardsWithMeta();

  return (
    <div className="space-y-ds-section">
      <PageHeader
        title="Job sources"
        description="Multi-source job discovery: enable/disable boards, sync by board or provider, view last sync stats."
      />
      <SectionCard>
        <p className="text-ds-caption text-slate-500 mb-4">
          Sync one board: <code className="bg-slate-800 px-1 rounded">POST /api/sync/board/[id]</code> · 
          Sync one provider: <code className="bg-slate-800 px-1 rounded">POST /api/sync/provider/[provider]</code>
        </p>
        <p className="text-ds-caption text-slate-500 mb-4">
          <strong>LinkedIn</strong> uses the Default Candidate profile (see <Link href="/profile" className="text-sky-400 hover:underline">Profile</Link>) to build search queries from target roles, preferred locations, work modes, and skills. Enable the LinkedIn board and sync to run those searches.
        </p>
        <SourcesListClient boards={boards} />
      </SectionCard>
    </div>
  );
}
