import { existsSync, readFileSync } from "node:fs";
import { getCandidate } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate?.pdfPath || !existsSync(candidate.pdfPath)) {
    return new Response("PDF not found", { status: 404 });
  }
  const data = readFileSync(candidate.pdfPath);
  return new Response(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=laptop-invoice.pdf",
    },
  });
}
