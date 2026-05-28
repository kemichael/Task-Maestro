export interface SlackMention {
  id: number;
  workspaceId: string;
  channelId: string;
  ts: string;
  authorId: string;
  body: string;
  permalink: string;
  ticketId?: number;
  processedAt?: string;
  fetchedAt: string;
}
