import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const botId = url.searchParams.get("botId");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const level = url.searchParams.get("level"); // Filter by level: info, debug, warn, error

    // If botId specified, verify ownership
    if (botId) {
      const { data: bot } = await supabase
        .from("bots")
        .select("user_id")
        .eq("id", botId)
        .single();

      if (!bot || bot.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Bot not found or access denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let query = supabase
        .from("bot_logs")
        .select("*")
        .eq("bot_id", botId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (level) {
        query = query.eq("level", level);
      }

      const { data: logs, error: logsError } = await query;

      if (logsError) {
        return new Response(
          JSON.stringify({ error: logsError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, logs }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get logs for all user's bots
    const { data: userBots } = await supabase
      .from("bots")
      .select("id, name")
      .eq("user_id", user.id);

    if (!userBots || userBots.length === 0) {
      return new Response(
        JSON.stringify({ success: true, logs: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botIds = userBots.map(b => b.id);
    const botNameMap = Object.fromEntries(userBots.map(b => [b.id, b.name]));

    let query = supabase
      .from("bot_logs")
      .select("*")
      .in("bot_id", botIds)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (level) {
      query = query.eq("level", level);
    }

    const { data: logs, error: logsError } = await query;

    if (logsError) {
      return new Response(
        JSON.stringify({ error: logsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Add bot names to logs
    const logsWithBotNames = (logs || []).map(log => ({
      ...log,
      bot_name: botNameMap[log.bot_id] || "Unknown",
    }));

    return new Response(
      JSON.stringify({ success: true, logs: logsWithBotNames }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in bot-logs:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
