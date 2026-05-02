// Edge function: generate cricket ceremony / moment images via Lovable AI Gateway.
// Uses google/gemini-2.5-flash-image (Nano Banana). Caches to Supabase Storage.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { kind, prompt, leagueId, seasonNumber, matchId, award, playerId, teamId, momentType, description, playerName } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Build a refined cricket-themed prompt
    let fullPrompt = prompt;
    if (kind === "ceremony" && award) {
      fullPrompt = `Cinematic cricket awards ceremony photograph, IPL-style stage with golden lights and confetti. ${prompt}. Photorealistic, dramatic stadium lighting, trophy in foreground, crowd silhouette in background. Professional sports photography, 8k, sharp focus.`;
    } else if (kind === "moment") {
      fullPrompt = `Dynamic cricket action photograph: ${prompt}. Stadium under floodlights, motion blur on bat/ball, intense expression. Photojournalism style, high contrast, dramatic.`;
    } else if (kind === "pfp") {
      fullPrompt = `Stylized cricket player portrait avatar, ${prompt}. Cricket jersey, professional headshot, clean studio background with subtle team colors, semi-realistic illustration.`;
    } else if (kind === "trophy_lift") {
      fullPrompt = `Triumphant cricket champions lifting the IPL T2 trophy together, ${prompt}. Confetti raining, fireworks above, ecstatic expressions, dramatic backlight, stadium packed. Sports photography, golden hour.`;
    }

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
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Out of AI credits" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI generation failed" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await aiResp.json();
    const imageDataUrl: string | undefined = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageDataUrl) throw new Error("No image returned");

    // Persist record (URL stored as data URL — small images, simpler than uploading)
    if (kind === "ceremony" && leagueId && seasonNumber != null && award) {
      await supabase.from("ceremony_images").insert({
        league_id: leagueId, season_number: seasonNumber, award,
        player_id: playerId ?? null, team_id: teamId ?? null, image_url: imageDataUrl,
      });
    } else if (kind === "moment" && leagueId && matchId) {
      await supabase.from("match_moments").insert({
        league_id: leagueId, match_id: matchId, season_number: seasonNumber ?? null,
        moment_type: momentType ?? "highlight", description: description ?? null,
        player_id: playerId ?? null, player_name: playerName ?? null, team_id: teamId ?? null,
        image_url: imageDataUrl,
      });
    } else if (kind === "pfp" && playerId) {
      await supabase.from("players").update({ pfp_url: imageDataUrl }).eq("id", playerId);
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
