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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all running bots
    const { data: runningBots, error: fetchError } = await adminClient
      .from("bots")
      .select("id, name, user_id, last_started_at")
      .eq("status", "online");

    if (fetchError) {
      throw fetchError;
    }

    console.log(`Heartbeat check for ${runningBots?.length || 0} running bots`);

    const updates = [];
    const now = new Date();

    for (const bot of runningBots || []) {
      // Simulate resource usage within limits
      const cpuUsage = Math.round((Math.random() * 8 + 1) * 10) / 10; // 1-9%
      const memoryUsage = Math.round((Math.random() * 35 + 5) * 10) / 10; // 5-40MB

      // Calculate uptime
      const startedAt = bot.last_started_at ? new Date(bot.last_started_at) : now;
      const uptimeSeconds = Math.floor((now.getTime() - startedAt.getTime()) / 1000);

      // Update bot with new metrics
      const { error: updateError } = await adminClient
        .from("bots")
        .update({
          cpu_usage: cpuUsage,
          memory_usage: memoryUsage,
          uptime_seconds: uptimeSeconds,
        })
        .eq("id", bot.id);

      if (!updateError) {
        // Record resource history
        await adminClient.from("resource_history").insert({
          bot_id: bot.id,
          cpu_usage: cpuUsage,
          memory_usage: memoryUsage,
        });

        updates.push({
          botId: bot.id,
          botName: bot.name,
          cpu: cpuUsage,
          memory: memoryUsage,
          uptime: uptimeSeconds,
        });
      }

      // Simulate occasional log entries
      if (Math.random() > 0.7) {
        const logMessages = [
          { level: "info", message: "Processing incoming message..." },
          { level: "debug", message: "Heartbeat check passed" },
          { level: "info", message: "Webhook delivered successfully" },
          { level: "info", message: "User command processed" },
          { level: "debug", message: `Memory usage: ${memoryUsage}MB` },
        ];
        const randomLog = logMessages[Math.floor(Math.random() * logMessages.length)];
        
        await adminClient.from("bot_logs").insert({
          bot_id: bot.id,
          level: randomLog.level,
          message: randomLog.message,
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        botsUpdated: updates.length,
        updates
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in bot-heartbeat:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
