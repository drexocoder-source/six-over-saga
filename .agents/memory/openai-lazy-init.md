---
name: OpenAI lazy initialization
description: Both OpenAI client files must NOT throw at module load time — lazy init only
---

There are two OpenAI client files:
- `lib/integrations-openai-ai-server/src/client.ts` — main text/chat client
- `lib/integrations-openai-ai-server/src/image/client.ts` — image generation

Both originally threw errors at module-load time if env vars were missing.
This causes the API server to crash immediately on startup.

**Rule:** Use lazy initialization — create the OpenAI client inside a function
that is called on first use, not at module top-level. Fall back to
`OPENAI_API_KEY` if `AI_INTEGRATIONS_OPENAI_API_KEY` is absent.
Use `dall-e-3` model (not `gpt-image-1`) with `response_format: "b64_json"`.

**Why:** Server must start without AI keys; keys may be added later as secrets.
Failing at startup makes the entire app unusable even for non-AI features.
