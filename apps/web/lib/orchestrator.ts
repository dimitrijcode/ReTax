import {
  FIXTURE_CALENDAR_EVENT,
  FIXTURE_GMAIL_MESSAGE,
  FIXTURE_INVOICE,
  fixturePdfIfPresent,
} from "./fixtures";
import { createCandidate, type Candidate } from "./store";

export type ScanStep = "calendar_read" | "mail_found" | "invoice_extracted";

export type ScanProgress = {
  step: ScanStep;
  message: string;
};

const PAUSE_MS = 650;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Fixture-mode scan: hardcoded calendar, mail, and invoice. No Google/Anthropic. */
export async function runFixtureScan(
  onProgress: (progress: ScanProgress) => void,
): Promise<Candidate> {
  await sleep(PAUSE_MS);
  onProgress({ step: "calendar_read", message: "Kalender gelesen" });

  await sleep(PAUSE_MS);
  onProgress({ step: "mail_found", message: "Mail gefunden" });

  await sleep(PAUSE_MS);
  onProgress({ step: "invoice_extracted", message: "Rechnung ausgelesen" });

  return createCandidate({
    calendarEvent: FIXTURE_CALENDAR_EVENT,
    gmailMessage: FIXTURE_GMAIL_MESSAGE,
    pdfPath: fixturePdfIfPresent(),
    invoice: FIXTURE_INVOICE,
  });
}
