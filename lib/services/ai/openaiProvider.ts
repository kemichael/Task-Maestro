import "server-only";
import type { AIProvider, ExtractionInput } from "../../types/ai";
import type { TicketCandidate } from "../../types/ticket";
import { getEnv } from "../../env";
import { AiProviderError } from "../../errors";
import { logger } from "../../logger";
import { buildExtractionPrompt } from "./buildExtractionPrompt";
import { parseCandidates } from "./parseCandidates";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export function createOpenAiProvider(model: string): AIProvider {
  return {
    async extractCandidates(input: ExtractionInput): Promise<TicketCandidate[]> {
      const apiKey = getEnv().OPENAI_API_KEY;
      if (!apiKey) {
        throw new AiProviderError("OPENAI_API_KEY が未設定です。設定画面で別プロバイダへ切替えるか API キーを設定してください");
      }
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: buildExtractionPrompt(input) }],
          response_format: { type: "json_object" },
          temperature: 0,
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        throw new AiProviderError(`OpenAI API エラー (${res.status}): ${detail.slice(0, 200)}`);
      }
      const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? "";
      try {
        return parseCandidates(content);
      } catch (error) {
        // パース失敗時は生出力を残して原因を追えるようにする
        logger.warn({ op: "openai.extract", raw: content.slice(0, 1000) }, "AI 出力のパースに失敗");
        throw error;
      }
    },
  };
}
