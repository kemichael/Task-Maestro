import "server-only";
import { google } from "googleapis";
import { getOAuth2Client } from "./googleAuth";
import { ExternalApiError } from "../errors";
import type { DriveFileLite } from "../services/meeting/linkMeetingDoc";

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";

/** 名前に nameContains を含む Google Docs を検索する (Drive readonly スコープ必要) */
export async function searchDocs(nameContains: string): Promise<DriveFileLite[]> {
  try {
    const drive = google.drive({ version: "v3", auth: getOAuth2Client() });
    const safe = nameContains.replace(/'/g, "\\'");
    const res = await drive.files.list({
      q: `mimeType='${GOOGLE_DOC_MIME}' and name contains '${safe}' and trashed=false`,
      fields: "files(id,name,modifiedTime)",
      pageSize: 20,
      orderBy: "modifiedTime desc",
    });
    return (res.data.files ?? []).map((f) => ({
      id: f.id ?? "",
      name: f.name ?? "",
      modifiedTime: f.modifiedTime ?? undefined,
    }));
  } catch (error) {
    const e = error as { code?: number; message?: string };
    if (e.code === 401 || e.code === 403) {
      throw new ExternalApiError(
        "Google Drive の認証に失敗しました (Drive スコープ不足の可能性)。マニュアルの追加スコープ手順を確認してください",
        "auth",
        false,
        e.code,
        error,
      );
    }
    throw new ExternalApiError(`Google Drive API エラー: ${e.message ?? ""}`, "unknown", false, e.code, error);
  }
}
