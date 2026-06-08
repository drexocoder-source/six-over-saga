// Edge function: generate cricket-themed images via Lovable AI Gateway (Nano Banana).
// Returns { image_url } as a data URL. Optionally persists to ceremony_images / match_moments.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Kind =
  | "ceremony" | "moment" | "pfp" | "trophy_lift"
  | "playoffs_poster" | "final_poster" | "leaderboard_poster"
  | "season_recap" | "matchup_poster" | "jersey_concept"
  | "stadium_atmosphere" | "team_huddle" | "custom";

function buildPrompt(kind: Kind, prompt: string, extra: any): string {
  const base = "Photorealistic, cinematic sports photography, dramatic stadium floodlights, 8k, sharp focus, high contrast, IPL-style production design.";
  switch (kind) {
    case "ceremony":
      return `Cinematic cricket awards ceremony photograph on a golden-lit stage with confetti and a glittering trophy. ${prompt}. ${base}`;
    case "moment":
      return `Dynamic cricket action photograph: ${prompt}. Motion blur on bat/ball, intense facial expression, packed stadium under floodlights. ${base}`;
    case "pfp":
      return `Stylized cricket player portrait avatar: ${prompt}. Cricket jersey, clean studio background with subtle team color gradient, semi-realistic illustration, professional headshot framing.`;
    case "trophy_lift":
      return `Triumphant cricket champions lifting an ornate silver T20 league trophy together. ${prompt}. Confetti rain, fireworks above, ecstatic players, dramatic backlight, packed stadium. ${base}`;
    case "playoffs_poster":
      return `Bold IPL-style PLAYOFFS poster artwork. ${prompt}. Four team logos arranged around a glowing bracket (Q1, Eliminator, Q2, Final), neon accents, dark gradient background, cinematic player silhouettes, dramatic typography. Promotional key art, ultra-detailed.`;
    case "final_poster":
      return `Epic GRAND FINAL match poster. ${prompt}. Two captains face-to-face in heroic poses, fire and lightning effects, the trophy floating between them, stadium silhouette below, bold cinematic typography reading FINAL. ${base}`;
    case "leaderboard_poster":
      return `Stylish cricket statistics leaderboard poster. ${prompt}. Top-5 list rendered as glowing player cards stacked vertically with numbers and stats, gold/orange accent palette, dark studio background, modern editorial sports magazine layout.`;
    case "season_recap":
      return `A cinematic season-recap collage poster for a T20 cricket league. ${prompt}. Multiple action moments composited together, film-grain texture, golden-hour color grading, dramatic typography reading SEASON RECAP. ${base}`;
    case "matchup_poster":
      return `Head-to-head matchup poster, two cricket teams clashing. ${prompt}. Split-screen design with each captain on one side glaring across, team colors as background gradient, lightning between them, bold VS text in the middle. ${base}`;
    case "jersey_concept":
      return `Cricket jersey concept art on an invisible mannequin, front view. ${prompt}. Studio lighting, clean grey backdrop, fabric detail visible, sponsor logos as abstract patches, photoreal product shot.`;
    case "stadium_atmosphere":
      return `Wide aerial photograph of a packed cricket stadium at night under floodlights. ${prompt}. Crowd waving flags, light trails, atmospheric haze, dramatic sky. ${base}`;
    case "team_huddle":
      return `Cricket team huddle on the pitch, arms over shoulders, captain giving a pep talk. ${prompt}. Backlit by floodlights, dust kicking up, emotional intensity. ${base}`;
    case "custom":
    default:
      return `${prompt}. ${base}`;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      kind, prompt, leagueId, seasonNumber, matchId, award,
      playerId, playerName, teamId, momentType, description,
    } = body;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    const fullPrompt = buildPrompt((kind ?? "custom") as Kind, prompt ?? "", body);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: fullPrompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Out of credits" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const imageDataUrl: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl) {
      console.error("no image", JSON.stringify(data).slice(0, 500));
      throw new Error("No image returned");
    }

    // Optional persistence
    try {
      if (kind === "ceremony" && leagueId && seasonNumber != null && award) {
        await sb.from("ceremony_images").insert({
          league_id: leagueId, season_number: seasonNumber, award,
          player_id: playerId ?? null, team_id: teamId ?? null, image_url: imageDataUrl,
        });
      } else if (kind === "moment" && leagueId && matchId) {
        await sb.from("match_moments").insert({
          league_id: leagueId, match_id: matchId, season_number: seasonNumber ?? null,
          moment_type: momentType ?? "highlight", description: description ?? null,
          player_id: playerId ?? null, player_name: playerName ?? null, team_id: teamId ?? null,
          image_url: imageDataUrl,
        });
      } else if (kind === "pfp" && playerId) {
        await sb.from("players").update({ pfp_url: imageDataUrl }).eq("id", playerId);
      }
    } catch (persistErr) {
      console.warn("persist warning:", persistErr);
    }

    return new Response(JSON.stringify({ image_url: imageDataUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
