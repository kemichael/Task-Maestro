import "server-only";
import { google } from "googleapis";
import { getEnv } from "../env";

let cachedClient: ReturnType<typeof google.auth.OAuth2.prototype.constructor> | null = null;

export function getOAuth2Client() {
  const env = getEnv();
  if (
    !env.GOOGLE_OAUTH_CLIENT_ID ||
    !env.GOOGLE_OAUTH_CLIENT_SECRET ||
    !env.GOOGLE_REFRESH_TOKEN
  ) {
    throw new Error(
      "Google OAuth の認証情報が未設定です (GOOGLE_OAUTH_CLIENT_ID / SECRET / REFRESH_TOKEN)",
    );
  }
  if (cachedClient) return cachedClient as InstanceType<typeof google.auth.OAuth2>;
  const oauth2 = new google.auth.OAuth2(
    env.GOOGLE_OAUTH_CLIENT_ID,
    env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: env.GOOGLE_REFRESH_TOKEN });
  cachedClient = oauth2 as unknown as ReturnType<
    typeof google.auth.OAuth2.prototype.constructor
  >;
  return oauth2;
}
