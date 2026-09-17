export {
  GOOGLE_SCOPES,
  createOAuth2Client,
  getAuthUrl,
  exchangeCode,
  getAuthenticatedClient,
  type GoogleOAuthConfig,
  type GoogleTokens,
  type OAuth2Client,
} from "./oauth";

export { listEvents, type CalendarEvent, type ListEventsParams } from "./calendar";

export {
  searchMessages,
  getMessage,
  getAttachment,
  type GmailMessageSummary,
  type GmailAttachmentInfo,
  type GmailMessage,
  type GmailAttachment,
} from "./gmail";
