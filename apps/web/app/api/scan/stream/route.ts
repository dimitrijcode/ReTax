import { runFixtureScan } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sse(event, data)));
      };
      try {
        const candidate = await runFixtureScan((progress) => {
          send("progress", progress);
        });
        send("candidate_ready", { id: candidate.id });
        send("done", { id: candidate.id });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Scan failed";
        send("scan_error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
