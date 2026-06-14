import OpenAI from "openai";

let _client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (_client) return _client;
  const apiKey =
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  if (!apiKey) {
    throw new Error(
      "No OpenAI API key found. Set OPENAI_API_KEY in your Replit Secrets.",
    );
  }
  _client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  return _client;
}

// Default export kept for backward compat — lazily resolved on first use.
export const openai: OpenAI = new Proxy({} as OpenAI, {
  get(_t, prop) {
    return (getOpenAIClient() as any)[prop];
  },
});
