import { notFound } from "next/navigation";
import { getCandidate } from "@/lib/store";
import { ReviewWizard } from "./review-wizard";

export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) notFound();

  return <ReviewWizard candidate={candidate} />;
}
