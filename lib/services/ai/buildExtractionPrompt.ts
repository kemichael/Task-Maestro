import type { ExtractionInput } from "../../types/ai";

/**
 * AI に渡す抽出プロンプトを組み立てる純粋関数。
 * OpenAI の JSON モード (response_format: json_object) は必ずオブジェクトを返すため、
 * 出力は candidates 配列を持つ JSON オブジェクトとして要求する。
 */
export function buildExtractionPrompt(input: ExtractionInput): string {
  const selfLine = input.selfName
    ? `この議事録における発話者「${input.selfName}」本人のネクストアクションのみを対象にすること。\n`
    : "";
  return [
    "あなたはタスク抽出アシスタントです。以下の文章から実行すべきタスクを抽出してください。",
    selfLine,
    "出力は次の形の JSON オブジェクトのみとし、前後に説明文やコードフェンスを付けないこと:",
    '{"candidates": [{"title": "タスク名", "body": "補足(任意)", "suggested_due": "YYYY-MM-DD(任意)"}]}',
    'タスクが無ければ {"candidates": []} を返すこと。title は簡潔な日本語にすること。',
    "--- 本文ここから ---",
    input.text,
    "--- 本文ここまで ---",
  ].join("\n");
}
