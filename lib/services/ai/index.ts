import "server-only";
import type { AIProvider } from "../../types/ai";
import type { AIProviderKind } from "../../types/settings";
import { createOpenAiProvider } from "./openaiProvider";
import { createClaudeCodeProvider } from "./claudeCodeProvider";

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

export function getProvider(kind: AIProviderKind, openaiModel?: string): AIProvider {
  if (kind === "claudeCode") return createClaudeCodeProvider();
  return createOpenAiProvider(openaiModel ?? DEFAULT_OPENAI_MODEL);
}
