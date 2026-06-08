// Helper to call the AI image-gen edge function from the client.
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ImageKind =
  | "ceremony" | "moment" | "pfp" | "trophy_lift"
  | "playoffs_poster" | "final_poster" | "leaderboard_poster"
  | "season_recap" | "matchup_poster" | "jersey_concept"
  | "stadium_atmosphere" | "team_huddle" | "custom";

export interface GenImgArgs {
  kind: ImageKind;
  prompt: string;
  leagueId?: string;
  seasonNumber?: number;
  matchId?: string;
  award?: string;
  playerId?: string;
  playerName?: string;
  teamId?: string;
  momentType?: string;
  description?: string;
}

export async function generateImage(args: GenImgArgs): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("generate-image", { body: args });
    if (error) {
      const status = (error as any)?.context?.status;
      if (status === 429) toast.error("AI rate limit hit. Wait a moment & retry.");
      else if (status === 402) toast.error("Out of AI credits. Add funds in workspace settings.");
      else toast.error("Image generation failed");
      return null;
    }
    return (data as any)?.image_url ?? null;
  } catch (e) {
    console.error("generateImage error:", e);
    return null;
  }
}
