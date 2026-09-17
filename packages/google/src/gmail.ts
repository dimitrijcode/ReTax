import type { gmail_v1 } from "googleapis";
import { google } from "googleapis";
import type { OAuth2Client } from "./oauth";

export type GmailMessageSummary = {
  id: string;
  threadId: string;
  snippet: string;
};

export type GmailAttachmentInfo = {
  filename: string;
  mimeType: string;
  attachmentId: string;
  size: number;
};

export type GmailMessage = {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  date: string;
  attachments: GmailAttachmentInfo[];
};

export type GmailAttachment = {
  filename: string;
  mimeType: string;
  data: Buffer;
};

function requireAuth(auth?: OAuth2Client): OAuth2Client {
  if (!auth) {
    throw new Error("An authenticated OAuth2 client is required. Call getAuthenticatedClient(tokens) first.");
  }
  return auth;
}

function headerValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  const match = headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return match?.value ?? "";
}

function collectAttachments(payload?: gmail_v1.Schema$MessagePart | null): GmailAttachmentInfo[] {
  if (!payload) return [];
  const attachments: GmailAttachmentInfo[] = [];

  const walk = (part: gmail_v1.Schema$MessagePart) => {
    const filename = part.filename;
    const attachmentId = part.body?.attachmentId;
    if (filename && attachmentId) {
      attachments.push({
        filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        attachmentId,
        size: part.body?.size ?? 0,
      });
    }
    for (const child of part.parts ?? []) {
      walk(child);
    }
  };

  walk(payload);
  return attachments;
}

function findAttachmentInfo(
  payload: gmail_v1.Schema$MessagePart | null | undefined,
  attachmentId: string,
): GmailAttachmentInfo | undefined {
  return collectAttachments(payload).find((item) => item.attachmentId === attachmentId);
}

export async function searchMessages({
  query,
  maxResults,
  auth,
}: {
  query: string;
  maxResults: number;
  auth?: OAuth2Client;
}): Promise<GmailMessageSummary[]> {
  const gmail = google.gmail({ version: "v1", auth: requireAuth(auth) });
  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults,
  });

  const messages = list.data.messages ?? [];
  return Promise.all(
    messages.map(async (message) => {
      const id = message.id;
      if (!id) {
        throw new Error("Gmail message list returned an entry without an id");
      }
      const full = await gmail.users.messages.get({
        userId: "me",
        id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      return {
        id: full.data.id ?? id,
        threadId: full.data.threadId ?? message.threadId ?? "",
        snippet: full.data.snippet ?? "",
      };
    }),
  );
}

export async function getMessage(id: string, auth?: OAuth2Client): Promise<GmailMessage> {
  const gmail = google.gmail({ version: "v1", auth: requireAuth(auth) });
  const res = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });
  const message = res.data;
  const headers = message.payload?.headers;

  return {
    id: message.id ?? id,
    threadId: message.threadId ?? "",
    snippet: message.snippet ?? "",
    from: headerValue(headers, "From"),
    subject: headerValue(headers, "Subject"),
    date: headerValue(headers, "Date"),
    attachments: collectAttachments(message.payload),
  };
}

export async function getAttachment({
  messageId,
  attachmentId,
  auth,
}: {
  messageId: string;
  attachmentId: string;
  auth?: OAuth2Client;
}): Promise<GmailAttachment> {
  const gmail = google.gmail({ version: "v1", auth: requireAuth(auth) });
  const message = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });
  const info = findAttachmentInfo(message.data.payload, attachmentId);
  if (!info) {
    throw new Error(`Attachment ${attachmentId} was not found on message ${messageId}`);
  }

  const res = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  const data = res.data.data;
  if (!data) {
    throw new Error(`Attachment ${attachmentId} on message ${messageId} had no data`);
  }

  return {
    filename: info.filename,
    mimeType: info.mimeType,
    data: Buffer.from(data, "base64url"),
  };
}
