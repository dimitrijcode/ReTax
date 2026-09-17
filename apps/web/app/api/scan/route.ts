import { NextResponse } from "next/server";

/** Starts a scan job. Progress is delivered on GET /api/scan/stream. */
export async function POST() {
  return NextResponse.json({
    ok: true,
    mode: process.env.RETAX_MODE ?? "fixture",
  });
}
