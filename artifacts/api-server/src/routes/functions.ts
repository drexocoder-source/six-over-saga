// /functions/v1/:name — AI edge functions powered by Replit OpenAI integration
import { Router, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { generateImageBuffer } from "@workspace/integrations-openai-ai-server/image";

const router = Router();

// ── Chairman AI Chat ──────────────────────────────────────────────────────────
// POST /functions/v1/chairman-chat
// Body: { messages: {role,content}[], context: ChairmanChatContext }
// Streams back SSE in OpenAI delta format (data: {...}\n\n then data: [DONE]\n\n)

router.post("/v1/chairman-chat", async (req: Request, res: Response): Promise<void> => {
  try {
    const { messages = [], context = {} } = req.body as {
      messages: { role: "user" | "assistant"; content: string }[];
      context: Record<string, unknown>;
    };

    const systemPrompt = buildSystemPrompt(context);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.flushHeaders();

    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err: any) {
    if (err?.status === 429) {
      res.status(429).json({ error: "Rate limited" });
    } else if (err?.status === 402) {
      res.status(402).json({ error: "Out of AI credits" });
    } else {
      req.log?.error({ err }, "chairman-chat error");
      if (!res.headersSent) res.status(500).json({ error: "AI chat failed" });
      else res.end();
    }
  }
});

// ── AI Commentary ─────────────────────────────────────────────────────────────
// POST /functions/v1/ai-commentary
// Generates a single vivid commentary line for a match event

router.post("/v1/ai-commentary", async (req: Request, res: Response): Promise<void> => {
  try {
    const { event, batter, bowler, runs, over, wickets, total, target, match } = req.body;
    const prompt = buildCommentaryPrompt({ event, batter, bowler, runs, over, wickets, total, target, match });

    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const line = completion.choices[0]?.message?.content?.trim() ?? "";
    req.log?.info({ line, stop: completion.choices[0]?.finish_reason }, "ai-commentary result");
    res.json({ line });
  } catch (err) {
    req.log?.error({ err }, "ai-commentary error");
    res.status(500).json({ line: "" });
  }
});

// ── Image Generation ──────────────────────────────────────────────────────────
// POST /functions/v1/generate-image
// Body: { kind, prompt, playerName?, teamId?, award? }
// Returns: { image_url: "data:image/png;base64,..." }

router.post("/v1/generate-image", async (req: Request, res: Response): Promise<void> => {
  try {
    const { kind, prompt, playerName, teamId, award } = req.body;
    const fullPrompt = buildImagePrompt({ kind, prompt, playerName, teamId, award });

    const buffer = await generateImageBuffer(fullPrompt, "1024x1024");
    const b64 = buffer.toString("base64");
    res.json({ image_url: `data:image/png;base64,${b64}` });
  } catch (err: any) {
    if (err?.status === 429) {
      res.status(429).json({ error: "Rate limited" });
    } else {
      req.log?.error({ err }, "generate-image error");
      res.status(500).json({ error: "Image generation failed" });
    }
  }
});

// ── Catch-all ─────────────────────────────────────────────────────────────────
router.post("/v1/:name", (_req: Request, res: Response): void => {
  res.status(404).json({ error: `Function '${_req.params.name}' not found` });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildSystemPrompt(ctx: Record<string, unknown>): string {
  const league = ctx.league as any;
  const season = ctx.season as any;
  const standings = ctx.standings as any[];
  const topScorers = ctx.topScorers as any[];
  const topWicketTakers = ctx.topWicketTakers as any[];
  const recentResults = ctx.recentResults as any[];

  let sys = `You are the Chairman AI Assistant for "${league?.name ?? "The Pavilion"}" — an IPL-style T20 cricket league.
You know the league inside-out and speak with the authority of a cricket analyst + team strategist.
Keep answers concise, punchy, and cricket-smart. Use markdown for structure when helpful. Max 300 words.`;

  if (season) sys += `\n\nCurrent season: Season ${season.number} (${season.year}), status: ${season.status}.`;

  if (standings?.length) {
    sys += `\n\nStandings:\n` + standings.map((s: any) =>
      `  ${s.team}: ${s.W}W-${s.L}L, ${s.pts}pts, NRR ${s.nrr?.toFixed(3) ?? "—"}`
    ).join("\n");
  }

  if (topScorers?.length) {
    sys += `\n\nTop Scorers:\n` + topScorers.slice(0, 5).map((s: any) =>
      `  ${s.name} (${s.team}): ${s.runs} runs`
    ).join("\n");
  }

  if (topWicketTakers?.length) {
    sys += `\n\nTop Wicket-takers:\n` + topWicketTakers.slice(0, 5).map((w: any) =>
      `  ${w.name} (${w.team}): ${w.wickets} wkts`
    ).join("\n");
  }

  if (recentResults?.length) {
    sys += `\n\nRecent Results:\n` + recentResults.slice(0, 5).map((r: any) =>
      `  ${r.teamA} vs ${r.teamB} — Winner: ${r.winner ?? "No result"}`
    ).join("\n");
  }

  return sys;
}

function buildCommentaryPrompt(args: {
  event: string; batter: string; bowler: string; runs: number;
  over: string; wickets: number; total: number; target?: number; match?: string;
}): string {
  return `You are an electrifying IPL cricket commentator. Write ONE vivid commentary line (max 20 words) for this ball:
Ball: ${args.event} (${args.runs} runs) | Batter: ${args.batter} | Bowler: ${args.bowler}
Score: ${args.total}/${args.wickets} after ${args.over} overs${args.target ? ` | Target: ${args.target}` : ""}
No intro, no quotes — just the commentary line. Be dramatic for sixes/wickets, calm for dots.`;
}

function buildImagePrompt(args: {
  kind: string; prompt?: string; playerName?: string; teamId?: string; award?: string;
}): string {
  switch (args.kind) {
    case "ceremony":
      return `IPL cricket trophy ceremony, dramatic stadium lighting, confetti, ${args.playerName ?? "champion"} holding the trophy aloft, photorealistic, cinematic, 4K`;
    case "trophy_lift":
      return `IPL cricket player ${args.playerName ?? "cricketer"} lifting the ${args.award ?? "trophy"} at a packed stadium, golden hour lighting, crowd cheering, photorealistic`;
    case "moment":
      return `Epic IPL cricket match moment: ${args.prompt ?? "spectacular six hit"}, stadium atmosphere, colorful jerseys, photorealistic, high-energy`;
    case "pfp":
      return `Professional cricket player portrait, ${args.playerName ?? "cricketer"}, team colors ${args.teamId ?? "blue"}, studio lighting, realistic illustration`;
    default:
      return args.prompt ?? "IPL cricket match, stadium, dramatic lighting, photorealistic";
  }
}

export default router;
