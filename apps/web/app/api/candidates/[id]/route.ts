import { NextResponse } from "next/server";
import { createBooking, getCandidate, updateCandidateStatus } from "@/lib/store";
import {
  availableMethods,
  buildJournal,
  classifyAsset,
  computePlan,
  type DepreciationMethod,
} from "@retax/tax-engine";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) {
    return NextResponse.json({ ok: false, message: "Candidate not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, candidate });
}

type DecisionBody =
  | { action: "skip" }
  | { action: "personal" }
  | { action: "book"; businessSharePct: number; method: DepreciationMethod };

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const candidate = await getCandidate(id);
  if (!candidate) {
    return NextResponse.json({ ok: false, message: "Candidate not found" }, { status: 404 });
  }

  const body = (await request.json()) as DecisionBody;

  if (body.action === "skip") {
    const updated = await updateCandidateStatus(id, "skipped");
    return NextResponse.json({ ok: true, candidate: updated });
  }

  if (body.action === "personal") {
    const updated = await updateCandidateStatus(id, "personal");
    return NextResponse.json({ ok: true, candidate: updated });
  }

  if (body.action === "book") {
    if (body.businessSharePct < 0 || body.businessSharePct > 100) {
      return NextResponse.json({ ok: false, message: "Invalid share" }, { status: 400 });
    }
    const classification = classifyAsset(candidate.invoice);
    const availability = availableMethods(candidate.invoice, classification.category);
    if (!availability.methods.includes(body.method)) {
      return NextResponse.json({ ok: false, message: "Invalid method" }, { status: 400 });
    }
    const plan = computePlan(candidate.invoice, body.businessSharePct, body.method);
    const { journal: _fromPlan, ...core } = plan;
    const booked = { ...plan, journal: buildJournal(candidate.invoice, core) };
    const result = await createBooking(id, {
      decision: "book",
      businessSharePct: body.businessSharePct,
      method: body.method,
      plan: booked,
    });
    return NextResponse.json({ ok: true, ...result });
  }

  return NextResponse.json({ ok: false, message: "Unknown action" }, { status: 400 });
}
