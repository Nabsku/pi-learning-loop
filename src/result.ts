import type { AgentToolResult } from "@earendil-works/pi-coding-agent";

export function textResult<TDetails = Record<string, unknown>>(text: string, details?: TDetails): AgentToolResult<TDetails> {
  return { content: [{ type: "text", text }], details } as AgentToolResult<TDetails>;
}
