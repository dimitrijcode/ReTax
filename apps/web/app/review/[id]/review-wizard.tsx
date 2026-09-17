"use client";

import { useMemo, useState } from "react";
import type { Candidate } from "@/lib/store";
import { formatDate, formatEuro, METHOD_LABELS } from "@/lib/format";
import {
  availableMethods,
  buildJournal,
  classifyAsset,
  computePlan,
  type DepreciationMethod,
} from "@retax/tax-engine";

type Step = "found" | "kind" | "share" | "result" | "success" | "personal" | "skipped";

function initialStep(status: Candidate["status"]): Step {
  if (status === "booked") return "success";
  if (status === "personal") return "personal";
  if (status === "skipped") return "skipped";
  return "found";
}

export function ReviewWizard({ candidate }: { candidate: Candidate }) {
  const { invoice, calendarEvent } = candidate;
  const [step, setStep] = useState<Step>(() => initialStep(candidate.status));
  const [share, setShare] = useState(50);
  const [method, setMethod] = useState<DepreciationMethod | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classification = useMemo(() => classifyAsset(invoice), [invoice]);
  const availability = useMemo(
    () => availableMethods(invoice, classification.category),
    [invoice, classification.category],
  );
  const selectedMethod = method ?? availability.recommended;
  const selectedPlan = useMemo(
    () => computePlan(invoice, share, selectedMethod),
    [invoice, share, selectedMethod],
  );
  const journal = useMemo(() => {
    const { journal: _fromPlan, ...core } = selectedPlan;
    return buildJournal(invoice, core);
  }, [invoice, selectedPlan]);
  const livePreview = selectedPlan;

  async function decide(body: Record<string, unknown>, next: Step) {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/candidates/${candidate.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as { ok: boolean; message?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.message ?? "Could not save");
      }
      setStep(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <div className="retax-watermark" aria-hidden="true">
        €
      </div>
      <div className="relative z-10">
        {step === "found" && (
          <section>
            <h1 className="text-4xl font-bold tracking-tight">
              We found this laptop in your calendar and mail.
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-retax-text/80">
              “{calendarEvent.summary}” on {formatDate(calendarEvent.start)}, and a bill from{" "}
              {invoice.vendor} for {formatEuro(invoice.gross)}.
            </p>
            <article className="mt-8 rounded-card bg-white p-6">
              <p className="text-sm text-retax-text/60">Invoice {invoice.invoiceNumber}</p>
              <p className="mt-2 text-xl font-semibold">{invoice.vendor}</p>
              <p className="mt-1 text-retax-text/80">{formatDate(invoice.date)}</p>
              <ul className="mt-4 space-y-1 text-retax-text/90">
                {invoice.items.map((item) => (
                  <li key={item.description}>{item.description}</li>
                ))}
              </ul>
              <dl className="mt-5 grid grid-cols-2 gap-y-1 text-sm">
                <dt className="text-retax-text/60">Net</dt>
                <dd className="text-right">{formatEuro(invoice.net)}</dd>
                <dt className="text-retax-text/60">VAT</dt>
                <dd className="text-right">{formatEuro(invoice.vat)}</dd>
                <dt className="font-semibold">Gross</dt>
                <dd className="text-right font-semibold">{formatEuro(invoice.gross)}</dd>
              </dl>
            </article>
            {candidate.pdfPath && (
              <iframe
                title="Invoice PDF"
                src={`/api/candidates/${candidate.id}/pdf`}
                className="mt-6 h-64 w-full rounded-card bg-white"
              />
            )}
            <div className="mt-10 flex flex-col gap-3">
              <button
                type="button"
                className="rounded-button bg-retax-accent px-7 py-3.5 text-base font-semibold"
                onClick={() => setStep("kind")}
              >
                Ja, buchen
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-button px-7 py-3 text-base font-medium text-retax-text/70"
                onClick={() => void decide({ action: "skip" }, "skipped")}
              >
                Nein, überspringen
              </button>
            </div>
          </section>
        )}

        {step === "kind" && (
          <section>
            <h1 className="text-4xl font-bold tracking-tight">Was this for work?</h1>
            <p className="mt-4 text-lg text-retax-text/80">
              Personal stays off the books. Company goes to the next question.
            </p>
            <div className="mt-10 flex flex-col gap-3">
              <button
                type="button"
                className="rounded-button bg-retax-accent px-7 py-3.5 text-base font-semibold"
                onClick={() => setStep("share")}
              >
                Company expense
              </button>
              <button
                type="button"
                disabled={pending}
                className="rounded-button bg-white px-7 py-3.5 text-base font-semibold"
                onClick={() => void decide({ action: "personal" }, "personal")}
              >
                Personal expense
              </button>
            </div>
          </section>
        )}

        {step === "share" && (
          <section>
            <h1 className="text-4xl font-bold tracking-tight">How much was for work?</h1>
            <p className="mt-8 text-6xl font-bold tabular-nums">{share}%</p>
            <label className="mt-8 block">
              <span className="sr-only">Business use percent</span>
              <input
                type="range"
                min={0}
                max={100}
                value={share}
                onChange={(event) => setShare(Number(event.target.value))}
              />
            </label>
            <p className="mt-8 rounded-card bg-retax-success/80 px-6 py-5 text-lg">
              {formatEuro(livePreview.deductibleNow)} deductible this year
            </p>
            {share < 10 && (
              <p className="mt-4 text-retax-text/80">
                Under 10% we treat this as personal — nothing to deduct.
              </p>
            )}
            <button
              type="button"
              className="mt-10 rounded-button bg-retax-accent px-7 py-3.5 text-base font-semibold"
              onClick={() => {
                setMethod(availability.recommended);
                setStep("result");
              }}
            >
              Continue
            </button>
          </section>
        )}

        {step === "result" && (
          <section>
            <h1 className="text-4xl font-bold tracking-tight">Here is the plan.</h1>
            <p className="mt-4 text-lg text-retax-text/80">
              {formatEuro(selectedPlan.deductibleNow)} deductible this year at {share}% work use.
            </p>
            <div className="mt-8 space-y-3">
              {availability.methods.map((option) => {
                const optionPlan =
                  option === selectedMethod ? selectedPlan : computePlan(invoice, share, option);
                const recommended = option === availability.recommended;
                const active = option === selectedMethod;
                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMethod(option)}
                    className={`w-full rounded-card p-5 text-left ${
                      active ? "bg-retax-success" : "bg-white"
                    }`}
                  >
                    <p className="font-semibold">
                      {METHOD_LABELS[option] ?? option}
                      {recommended ? " · recommended" : ""}
                    </p>
                    <p className="mt-1 text-sm text-retax-text/70">
                      {formatEuro(optionPlan.deductibleNow)} this year
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 overflow-hidden rounded-card bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-retax-text/60">
                    <th className="px-5 py-3 font-medium">Year</th>
                    <th className="px-5 py-3 font-medium">AfA</th>
                    <th className="px-5 py-3 font-medium">Deductible</th>
                    <th className="px-5 py-3 font-medium">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPlan.years.map((year) => (
                    <tr key={year.year} className="border-t border-retax-bg">
                      <td className="px-5 py-3">{year.year}</td>
                      <td className="px-5 py-3">{formatEuro(year.afa)}</td>
                      <td className="px-5 py-3">{formatEuro(year.businessDeductible)}</td>
                      <td className="px-5 py-3">{formatEuro(year.remainingBookValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-4">
              {journal.map((entry) => (
                <article key={`${entry.date}-${entry.memo}`} className="rounded-card bg-white p-5">
                  <p className="text-sm text-retax-text/60">
                    {entry.date} · {entry.memo}
                  </p>
                  <ul className="mt-3 space-y-1 text-sm">
                    {entry.lines.map((line) => (
                      <li key={`${line.account}-${line.debit}-${line.credit}`} className="flex justify-between gap-4">
                        <span>
                          {line.account} {line.name}
                        </span>
                        <span className="tabular-nums">
                          {line.debit > 0 ? formatEuro(line.debit) : `an ${formatEuro(line.credit)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              {journal.length === 0 && (
                <p className="text-retax-text/80">No journal — this stays private.</p>
              )}
            </div>

            <button
              type="button"
              disabled={pending || share < 10}
              className="mt-10 rounded-button bg-retax-accent px-7 py-3.5 text-base font-semibold disabled:opacity-50"
              onClick={() =>
                void decide(
                  { action: "book", businessSharePct: share, method: selectedMethod },
                  "success",
                )
              }
            >
              Buchen
            </button>
            {share < 10 && (
              <p className="mt-3 text-sm text-retax-text/70">Mark it as personal instead.</p>
            )}
          </section>
        )}

        {step === "success" && (
          <section className="rounded-card bg-retax-success p-8">
            <h1 className="text-4xl font-bold tracking-tight">Done. We added it to your year.</h1>
            <p className="mt-4 text-lg text-retax-text/80">
              {invoice.vendor} · {formatEuro(invoice.gross)} · {share}% work use.
            </p>
          </section>
        )}

        {step === "personal" && (
          <section className="rounded-card bg-white p-8">
            <h1 className="text-4xl font-bold tracking-tight">Kept as personal.</h1>
            <p className="mt-4 text-lg text-retax-text/80">We did not book it.</p>
          </section>
        )}

        {step === "skipped" && (
          <section className="rounded-card bg-white p-8">
            <h1 className="text-4xl font-bold tracking-tight">Skipped.</h1>
            <p className="mt-4 text-lg text-retax-text/80">Nothing was added to your year.</p>
          </section>
        )}

        {error && <p className="mt-6 text-retax-text">{error}</p>}
      </div>
    </main>
  );
}
