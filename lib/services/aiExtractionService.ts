import "server-only";
import type { ExtractionInput } from "../types/ai";
import type { TicketCandidate } from "../types/ticket";
import { getAppSettings } from "../db/settingsRepository";
import { getProvider } from "./ai/index";

/** 設定で選択された AI プロバイダを用いて本文からチケット候補を抽出する */
export async function extractCandidatesFromText(input: ExtractionInput): Promise<TicketCandidate[]> {
  const { provider, openaiModel } = getAppSettings().ai;
  return getProvider(provider, openaiModel).extractCandidates(input);
}
