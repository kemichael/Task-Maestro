import "server-only";
import { google } from "googleapis";
import { getOAuth2Client } from "./googleAuth";
import { ExternalApiError } from "../errors";
import { logger } from "../logger";

interface DocElement {
  textRun?: { content?: string | null };
}
interface DocStructural {
  paragraph?: { elements?: DocElement[] };
}
interface DocLike {
  body?: { content?: DocStructural[] };
}

/** Docs API の document レスポンスをプレーンテキストに変換する純粋関数 */
export function flattenDocumentText(doc: DocLike): string {
  const content = doc.body?.content ?? [];
  let out = "";
  for (const block of content) {
    const elements = block.paragraph?.elements ?? [];
    for (const el of elements) {
      out += el.textRun?.content ?? "";
    }
  }
  return out;
}

/** documentId から本文プレーンテキストを取得する */
export async function getDocumentText(documentId: string): Promise<string> {
  try {
    const docs = google.docs({ version: "v1", auth: getOAuth2Client() });
    const res = await docs.documents.get({ documentId });
    return flattenDocumentText(res.data as DocLike);
  } catch (error) {
    const e = error as { code?: number; message?: string };
    logger.warn({ op: "getDocumentText", code: e.code }, "Google Docs API エラー");
    if (e.code === 401 || e.code === 403) {
      throw new ExternalApiError(
        "Google Docs の認証に失敗しました (Docs/Drive スコープ不足の可能性)。マニュアルの追加スコープ手順を確認してください",
        "auth",
        false,
        e.code,
        error,
      );
    }
    if (e.code === 404) {
      throw new ExternalApiError("指定された Google ドキュメントが見つかりません", "notFound", false, 404, error);
    }
    throw new ExternalApiError(`Google Docs API エラー: ${e.message ?? ""}`, "unknown", false, e.code, error);
  }
}
