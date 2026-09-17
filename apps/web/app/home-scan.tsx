"use client";

import { useRef, useState } from "react";

const STEPS = [
  { step: "calendar_read", label: "Kalender gelesen" },
  { step: "mail_found", label: "Mail gefunden" },
  { step: "invoice_extracted", label: "Rechnung ausgelesen" },
] as const;

type StepKey = (typeof STEPS)[number]["step"];

export function HomeScan() {
  const [scanning, setScanning] = useState(false);
  const [doneSteps, setDoneSteps] = useState<StepKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);
  const completedRef = useRef(false);

  function startScan() {
    sourceRef.current?.close();
    completedRef.current = false;
    setScanning(true);
    setDoneSteps([]);
    setError(null);
    setOpened(false);

    void fetch("/api/scan", { method: "POST" });

    const es = new EventSource("/api/scan/stream");
    sourceRef.current = es;

    const stop = () => {
      es.close();
      sourceRef.current = null;
    };

    es.addEventListener("progress", (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { step: StepKey };
      setDoneSteps((prev) => (prev.includes(data.step) ? prev : [...prev, data.step]));
    });

    es.addEventListener("candidate_ready", (event) => {
      if (completedRef.current) return;
      completedRef.current = true;
      const data = JSON.parse((event as MessageEvent).data) as { id: string };
      stop();
      setScanning(false);
      setOpened(true);
      const popup = window.open(`/review/${data.id}`, "_blank", "noopener,noreferrer");
      if (!popup) {
        window.location.href = `/review/${data.id}`;
      }
    });

    es.addEventListener("scan_error", (event) => {
      completedRef.current = true;
      const data = JSON.parse((event as MessageEvent).data) as { message?: string };
      setError(data.message ?? "Scan failed");
      stop();
      setScanning(false);
    });

    es.addEventListener("done", () => {
      stop();
    });

    es.onerror = () => {
      stop();
      if (!completedRef.current) {
        setScanning(false);
      }
    };
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <div className="retax-watermark" aria-hidden="true">
        %
      </div>
      <div className="relative z-10">
        <p className="text-sm font-medium tracking-wide text-retax-text/60">ReTax</p>
        <h1 className="mt-4 text-5xl font-bold tracking-tight text-retax-text">
          We look through calendar and mail.
        </h1>
        <p className="mt-5 max-w-md text-lg leading-relaxed text-retax-text/80">
          Then we ask before anything is booked.
        </p>
        <button
          type="button"
          onClick={startScan}
          disabled={scanning}
          className="mt-10 rounded-button bg-retax-accent px-7 py-3.5 text-base font-semibold text-retax-text disabled:opacity-60"
        >
          {scanning ? "Scanning…" : "Scan starten"}
        </button>
        <div className="mt-4">
          <a href="/connect" className="text-sm font-medium text-retax-text/70 underline-offset-4 hover:underline">
            Connect Google
          </a>
        </div>

        {(scanning || doneSteps.length > 0) && (
          <ol className="mt-12 space-y-3">
            {STEPS.map((item) => {
              const done = doneSteps.includes(item.step);
              return (
                <li key={item.step} className="flex items-center gap-3 text-base">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-sm ${
                      done ? "bg-retax-success" : "bg-white"
                    }`}
                    aria-hidden="true"
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span className={done ? "text-retax-text" : "text-retax-text/50"}>{item.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        {opened && (
          <p className="mt-8 text-retax-text/80">Opening the review in a new window.</p>
        )}
        {error && <p className="mt-8 text-retax-text">{error}</p>}
      </div>
    </main>
  );
}
