import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url)));
let factory;
export function setChatModelFactoryForTests(fn) { factory = fn; }
export function resetChatModelFactoryForTests() { factory = undefined; }

export async function createChatModel({ cfg, threadId, signal, onUsage, onCost }) {
  if (factory) return factory({ cfg, threadId, signal, onUsage, onCost });
  const { ChatOpenAI } = await import('@langchain/openai');
  const starts = new Map();
  const model = new ChatOpenAI({
    model: cfg.model,
    apiKey: cfg.apiKey,
    configuration: {
      fetch: async (...args) => {
        const response = await globalThis.fetch(...args);
        try {
          if (response.headers.get('content-type')?.includes('application/json')) {
            const body = await response.clone().json();
            const cost = body?.usage?.opencode?.list_cost;
            if (typeof cost === 'number') await onCost?.(cost);
          }
        } catch { /* Cost reporting must never affect the response. */ }
        return response;
      },
      baseURL: cfg.baseUrl,
      defaultHeaders: {
        'x-opencode-session': `gymbuddy-${threadId}`,
        'User-Agent': `gymbuddy-agent/${version}`
      }
    },
    timeout: cfg.callTimeoutMs,
    maxRetries: 2,
    modelKwargs: { reasoning_effort: cfg.reasoningEffort },
    callbacks: [{
      handleLLMStart(llm, prompts, runId) { starts.set(runId, Date.now()); },
      handleLLMEnd(output, runId) {
        const raw = output.llmOutput || {};
        const usage = raw.usage || raw.tokenUsage || {};
        const message = output.generations?.[0]?.[0]?.message;
        const tokens = message?.usage_metadata || {};
        onUsage?.({
          model: cfg.model,
          promptTokens: usage.prompt_tokens ?? usage.promptTokens ?? tokens.input_tokens ?? 0,
          completionTokens: usage.completion_tokens ?? usage.completionTokens ?? tokens.output_tokens ?? 0,
          reasoningTokens: usage.completion_tokens_details?.reasoning_tokens ?? tokens.output_token_details?.reasoning ?? 0,
          totalTokens: usage.total_tokens ?? usage.totalTokens ?? tokens.total_tokens ?? 0,
          ms: Date.now() - (starts.get(runId) ?? Date.now())
        });
        starts.delete(runId);
      },
      handleLLMError(error, runId) { starts.delete(runId); }
    }]
  });
  // Callers pass { signal } in invoke/stream config; LangGraph propagates it.
  return model;
}
