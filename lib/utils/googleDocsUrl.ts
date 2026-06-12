/**
 * Google Docs の URL または素の ID から documentId を抽出する純粋関数。
 * 抽出できない場合は null を返す。
 */
export function extractDocumentId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  // 素の ID (英数・_- のみで構成) はそのまま受理
  if (/^[a-zA-Z0-9_-]+$/.test(trimmed)) return trimmed;
  return null;
}
