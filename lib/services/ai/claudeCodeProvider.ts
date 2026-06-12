import "server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AIProvider, ExtractionInput } from "../../types/ai";
import type { TicketCandidate } from "../../types/ticket";
import { getEnv } from "../../env";
import { AiProviderError } from "../../errors";
import { buildExtractionPrompt } from "./buildExtractionPrompt";
import { parseCandidates } from "./parseCandidates";

const execFileAsync = promisify(execFile);

export function createClaudeCodeProvider(): AIProvider {
  return {
    async extractCandidates(input: ExtractionInput): Promise<TicketCandidate[]> {
      const claudePath = getEnv().CLAUDE_CODE_PATH;
      if (!claudePath) {
        throw new AiProviderError("CLAUDE_CODE_PATH が未設定です。設定画面で別プロバイダへ切替えるか CLI パスを設定してください");
      }
      const prompt = buildExtractionPrompt(input);
      try {
        const { stdout } = await execFileAsync(
          claudePath,
          ["-p", prompt],
          { maxBuffer: 10 * 1024 * 1024, timeout: 120_000 },
        );
        return parseCandidates(stdout);
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        throw new AiProviderError("Claude Code CLI の実行に失敗しました", error);
      }
    },
  };
}
