import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";

export type { OAuth2Client };

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
] as const;

const DEFAULT_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type GoogleTokens = {
  accessToken: string;
  refreshToken: string;
  expiryDate: Date | null;
  email: string;
};

function readOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set");
  }
  return {
    clientId,
    clientSecret,
    redirectUri: process.env.GOOGLE_REDIRECT_URI ?? DEFAULT_REDIRECT_URI,
  };
}

export function createOAuth2Client(auth?: OAuth2Client): OAuth2Client {
  if (auth) return auth;
  const config = readOAuthConfig();
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

export function getAuthUrl(state?: string, auth?: OAuth2Client): string {
  const client = createOAuth2Client(auth);
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_SCOPES],
    ...(state ? { state } : {}),
  });
}

export async function exchangeCode(code: string, auth?: OAuth2Client): Promise<GoogleTokens> {
  const client = createOAuth2Client(auth);
  const { tokens } = await client.getToken(code);
  if (!tokens.access_token) {
    throw new Error("Google did not return an access token");
  }
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Re-consent with access_type=offline and prompt=consent.",
    );
  }

  client.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: client });
  const profile = await gmail.users.getProfile({ userId: "me" });
  const email = profile.data.emailAddress;
  if (!email) {
    throw new Error("Google did not return the authenticated user email");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiryDate: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    email,
  };
}

export function getAuthenticatedClient(tokens: GoogleTokens, auth?: OAuth2Client): OAuth2Client {
  const client = createOAuth2Client(auth);
  client.setCredentials({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expiry_date: tokens.expiryDate?.getTime(),
  });
  client.forceRefreshOnFailure = true;
  return client;
}
