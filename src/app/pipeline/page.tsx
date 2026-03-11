import { revalidatePath } from "next/cache";
import { getOrCreateDefaultUser } from "@/services/userService";
import { getBoardForUser, updateMatchStatus } from "@/services/atsService";
import type { MatchStatus } from "@/models/Match";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

async function updateMatchStatusAction(matchId: string, status: MatchStatus) {
  "use server";
  await updateMatchStatus(matchId, status);
  revalidatePath("/pipeline");
}

export default async function PipelinePage() {
  const user = await getOrCreateDefaultUser();
  const board = await getBoardForUser(user);

  return (
    <div className="space-y-ds-section">
      <PageHeader
        title="Pipeline"
        description="Drag jobs across columns as you move from discovery to offers."
      />

      <PipelineBoard initialColumns={board} updateStatusAction={updateMatchStatusAction} />
    </div>
  );
}
