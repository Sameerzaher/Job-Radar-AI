import { redirect } from "next/navigation";
import { getOrCreateDefaultUser } from "@/services/userService";
import { ensureTailoredApplication } from "@/services/tailoredApplicationService";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<Record<string, string>>;
  searchParams: Promise<{ matchId?: string }>;
};

export default async function TailoredCreatePage({ searchParams }: Props) {
  const { matchId } = await searchParams;
  if (!matchId) {
    redirect("/tailored");
  }
  const user = await getOrCreateDefaultUser();
  const userId = (user as { _id: { toString(): string } })._id.toString();
  const { tailored } = await ensureTailoredApplication(matchId, userId, {
    generateIfMissing: true
  });
  const id = (tailored as { _id: { toString(): string } })._id.toString();
  redirect(`/tailored/${id}`);
}
