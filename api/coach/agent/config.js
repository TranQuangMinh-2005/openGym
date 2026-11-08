import path from 'node:path';

export function loadAgentConfig(env = process.env) {
  const number = (key, fallback, min = 1) => {
    const value = Number(env[key]);
    return env[key]?.trim() && Number.isSafeInteger(value) && value >= min ? value : fallback;
  };
  return Object.freeze({
    enabled: env.AGENT_ENABLED === '1',
    baseUrl: env.AGENT_LLM_BASE_URL || 'https://opencode.ai/zen/go/v1',
    model: env.AGENT_LLM_MODEL || 'deepseek-v4.1-flash',
    apiKey: env.AGENT_LLM_API_KEY || '',
    reasoningEffort: ['low', 'high', 'max'].includes(env.AGENT_LLM_EFFORT) ? env.AGENT_LLM_EFFORT : 'low',
    recursionLimit: number('AGENT_RECURSION_LIMIT', 40, 5),
    callTimeoutMs: number('AGENT_CALL_TIMEOUT_MS', 90000),
    runTimeoutMs: number('AGENT_RUN_TIMEOUT_MS', 600000),
    maxModelCalls: number('AGENT_MAX_MODEL_CALLS', 0, 0) || null,
    programLibraryMax: number('AGENT_PROGRAM_LIBRARY_MAX', 120),
    maxHandoffsPerAgent: number('AGENT_MAX_HANDOFFS_PER_AGENT', 3),
    stallRepeat: number('AGENT_STALL_REPEAT', 3),
    dbPath: env.AGENT_DB_PATH || path.join(env.DATA_DIR || '/data', 'agent.db')
  });
}

export function publicAgentConfig({ apiKey, ...cfg }) {
  return cfg;
}
