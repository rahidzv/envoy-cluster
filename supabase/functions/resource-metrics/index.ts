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
    const hours = parseInt(url.searchParams.get("hours") || "24");

    // Get user's bots
    const { data: userBots } = await supabase
      .from("bots")
      .select("id, name")
      .eq("user_id", user.id);

    if (!userBots || userBots.length === 0) {
      return new Response(
        JSON.stringify({ success: true, metrics: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botIds = botId ? [botId] : userBots.map(b => b.id);
    
    // Verify ownership if specific botId requested
    if (botId && !userBots.some(b => b.id === botId)) {
      return new Response(
        JSON.stringify({ error: "Bot not found or access denied" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    const { data: history, error: historyError } = await supabase
      .from("resource_history")
      .select("*")
      .in("bot_id", botIds)
      .gte("recorded_at", cutoffTime)
      .order("recorded_at", { ascending: true });

    if (historyError) {
      return new Response(
        JSON.stringify({ error: historyError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Aggregate metrics by hour
    const hourlyMetrics: Record<string, { cpu: number[]; memory: number[]; count: number }> = {};
    
    for (const record of history || []) {
      const hour = new Date(record.recorded_at).toISOString().slice(0, 13);
      if (!hourlyMetrics[hour]) {
        hourlyMetrics[hour] = { cpu: [], memory: [], count: 0 };
      }
      hourlyMetrics[hour].cpu.push(record.cpu_usage);
      hourlyMetrics[hour].memory.push(record.memory_usage);
      hourlyMetrics[hour].count++;
    }

    const chartData = Object.entries(hourlyMetrics).map(([hour, data]) => ({
      time: new Date(hour + ":00:00Z").toLocaleTimeString("en-US", { 
        hour: "2-digit", 
        minute: "2-digit",
        hour12: false 
      }),
      cpu: Math.round(data.cpu.reduce((a, b) => a + b, 0) / data.count * 10) / 10,
      memory: Math.round(data.memory.reduce((a, b) => a + b, 0) / data.count * 10) / 10,
    }));

    // Current stats
    const { data: currentBots } = await supabase
      .from("bots")
      .select("*")
      .in("id", botIds);

    const stats = {
      totalBots: currentBots?.length || 0,
      runningBots: currentBots?.filter(b => b.status === "online").length || 0,
      totalCpu: currentBots?.reduce((sum, b) => sum + (b.cpu_usage || 0), 0) || 0,
      totalMemory: currentBots?.reduce((sum, b) => sum + (b.memory_usage || 0), 0) || 0,
      maxBots: 3,
      maxCpuPerBot: 10,
      maxMemoryPerBot: 50,
    };

    return new Response(
      JSON.stringify({ 
        success: true, 
        chartData,
        stats,
        bots: currentBots
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in resource-metrics:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
