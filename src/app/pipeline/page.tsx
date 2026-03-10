import { revalidatePath } from "next/cache";
import { getOrCreateDefaultUser } from "@/services/userService";
import { getBoardForUser, updateMatchStatus } from "@/services/atsService";
import type { MatchStatus } from "@/models/Match";
import { PipelineBoard } from "@/components/pipeline/PipelineBoard";

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
    <div className="space-y-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Application pipeline
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Drag jobs across columns as you move from discovery to offers.
          </p>
        </div>
      </div>

      <PipelineBoard initialColumns={board} updateStatusAction={updateMatchStatusAction} />
    </div>
  );
}

