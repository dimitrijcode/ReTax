import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { DepreciationMethod, Invoice, JournalEntry, TaxPlan } from "@retax/tax-engine";
import type { FixtureCalendarEvent, FixtureGmailMessage } from "./fixtures";
import { findRepoRoot } from "./repo-root";

export type CandidateStatus = "needs_review" | "skipped" | "personal" | "booked";

export type Candidate = {
  id: string;
  status: CandidateStatus;
  calendarEvent: FixtureCalendarEvent;
  gmailMessage: FixtureGmailMessage;
  pdfPath: string | null;
  invoice: Invoice;
  createdAt: string;
  updatedAt: string;
};

export type Booking = {
  id: string;
  candidateId: string;
  decision: string;
  businessSharePct: number;
  method: DepreciationMethod;
  plan: TaxPlan;
  journal: JournalEntry[];
  createdAt: string;
};

export type GoogleConnection = {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
  expiryDate: string;
  createdAt: string;
  updatedAt: string;
};

type StoreFile = {
  googleConnections: GoogleConnection[];
  candidates: Candidate[];
  bookings: Booking[];
};

function emptyStore(): StoreFile {
  return { googleConnections: [], candidates: [], bookings: [] };
}

function storePath(): string {
  return join(findRepoRoot(), "data", "store.json");
}

function readStore(): StoreFile {
  const path = storePath();
  if (!existsSync(path)) return emptyStore();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<StoreFile>;
    return {
      googleConnections: parsed.googleConnections ?? [],
      candidates: parsed.candidates ?? [],
      bookings: parsed.bookings ?? [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: StoreFile): void {
  const path = storePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(store, null, 2), "utf8");
}

let queue: Promise<unknown> = Promise.resolve();

function withStore<T>(fn: (store: StoreFile) => T): Promise<T> {
  const run = queue.then(() => {
    const store = readStore();
    const result = fn(store);
    writeStore(store);
    return result;
  });
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createId(): string {
  return randomUUID();
}

export async function createCandidate(
  input: Omit<Candidate, "id" | "status" | "createdAt" | "updatedAt">,
): Promise<Candidate> {
  return withStore((store) => {
    const stamp = nowIso();
    const candidate: Candidate = {
      id: createId(),
      status: "needs_review",
      createdAt: stamp,
      updatedAt: stamp,
      ...input,
    };
    store.candidates.push(candidate);
    return candidate;
  });
}

export async function getCandidate(id: string): Promise<Candidate | null> {
  const store = readStore();
  return store.candidates.find((item) => item.id === id) ?? null;
}

export async function updateCandidateStatus(
  id: string,
  status: CandidateStatus,
): Promise<Candidate | null> {
  return withStore((store) => {
    const candidate = store.candidates.find((item) => item.id === id);
    if (!candidate) return null;
    candidate.status = status;
    candidate.updatedAt = nowIso();
    return candidate;
  });
}

export async function createBooking(
  candidateId: string,
  input: {
    decision: string;
    businessSharePct: number;
    method: DepreciationMethod;
    plan: TaxPlan;
  },
): Promise<{ candidate: Candidate; booking: Booking } | null> {
  return withStore((store) => {
    const candidate = store.candidates.find((item) => item.id === candidateId);
    if (!candidate) return null;
    const booking: Booking = {
      id: createId(),
      candidateId,
      decision: input.decision,
      businessSharePct: input.businessSharePct,
      method: input.method,
      plan: input.plan,
      journal: input.plan.journal,
      createdAt: nowIso(),
    };
    store.bookings = store.bookings.filter((item) => item.candidateId !== candidateId);
    store.bookings.push(booking);
    candidate.status = "booked";
    candidate.updatedAt = nowIso();
    return { candidate, booking };
  });
}

export async function getBookingForCandidate(candidateId: string): Promise<Booking | null> {
  const store = readStore();
  return store.bookings.find((item) => item.candidateId === candidateId) ?? null;
}
