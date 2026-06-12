import type { TicketCandidate, TicketSourceMeta } from "./ticket";

export interface ExtractionInput {
  /** 抽出元の本文 (Docs 本文 / 議事録テキスト) */
  text: string;
  /** チケットに残すソース情報 (kind: "document" | "meeting", ref: URL) */
  sourceMeta: TicketSourceMeta;
  /** FR-002 の発話者・割当先識別用 (利用者名)。任意 */
  selfName?: string;
}

export interface AIProvider {
  extractCandidates(input: ExtractionInput): Promise<TicketCandidate[]>;
}
