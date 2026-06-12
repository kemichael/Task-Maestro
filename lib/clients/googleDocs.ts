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
interface DocBody {
  content?: DocStructural[];
}
interface DocTab {
  documentTab?: { body?: DocBody };
  childTabs?: DocTab[];
}
interface DocLike {
  body?: DocBody;
  tabs?: DocTab[];
}

/** 1 つの body 配下の textRun を連結する */
function flattenBody(body: DocBody | undefined): string {
  const content = body?.content ?? [];
  let out = "";
  for (const block of content) {
    const elements = block.paragraph?.elements ?? [];
    for (const el of elements) {
      out += el.textRun?.content ?? "";
    }
  }
  return out;
}

/** タブ (子タブ含む) を再帰的に連結する */
function flattenTab(tab: DocTab): string {
  let out = flattenBody(tab.documentTab?.body);
  for (const child of tab.childTabs ?? []) {
    out += flattenTab(child);
  }
  return out;
}

/**
 * Docs API の document レスポンスをプレーンテキストに変換する純粋関数。
 * タブ付きドキュメント (tabs[]) は各タブの本文を連結する。
 */
export function flattenDocumentText(doc: DocLike): string {
  if (doc.tabs && doc.tabs.length > 0) {
    return doc.tabs.map(flattenTab).join("\n");
  }
  return flattenBody(doc.body);
}

/** documentId から本文プレーンテキストを取得する */
export async function getDocumentText(documentId: string): Promise<string> {
  try {
    const docs = google.docs({ version: "v1", auth: getOAuth2Client() });
    // includeTabsContent: タブ付きドキュメントの全タブ本文を取得する
    const res = await docs.documents.get({ documentId, includeTabsContent: true });
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
