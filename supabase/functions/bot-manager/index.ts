import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BotAction {
  action: "deploy" | "start" | "stop" | "restart" | "delete" | "status";
  botId?: string;
  // For deploy action
  name?: string;
  platform?: "telegram" | "discord";
  runtime?: "python" | "nodejs" | "php";
  scriptContent?: string;
  envVars?: { key: string; value: string }[];
}

// Simulated container state (in production, this would interface with Docker/Kubernetes)
const containerStates = new Map<string, {
  containerId: string;
  status: "running" | "stopped" | "error";
  startedAt: Date;
  cpuUsage: number;
  memoryUsage: number;
}>();

function generateContainerId(): string {
  return `nexus-${crypto.randomUUID().slice(0, 12)}`;
}

function simulateResourceUsage(): { cpu: number; memory: number } {
  // Simulate realistic resource usage within limits (max 10% CPU, 50MB RAM)
  return {
    cpu: Math.round((Math.random() * 8 + 1) * 10) / 10, // 1-9%
    memory: Math.round((Math.random() * 35 + 5) * 10) / 10, // 5-40MB
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create client with user's token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user email is verified
    if (!user.email_confirmed_at) {
      return new Response(
        JSON.stringify({ 
          error: "Email not verified",
          message: "Please verify your email before deploying or managing bots."
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: BotAction = await req.json();
    const { action, botId } = body;

    // Service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Helper to verify bot ownership
    async function verifyBotOwnership(id: string): Promise<boolean> {
      if (!user) return false;
      const { data: bot } = await supabase
        .from("bots")
        .select("user_id")
        .eq("id", id)
        .single();
      
      return bot?.user_id === user.id;
    }

    // Helper to add log entry
    async function addLog(id: string, level: string, message: string) {
      await adminClient.from("bot_logs").insert({
        bot_id: id,
        level,
        message,
      });
    }

    // Helper to record resource history
    async function recordResources(id: string, cpu: number, memory: number) {
      await adminClient.from("resource_history").insert({
        bot_id: id,
        cpu_usage: cpu,
        memory_usage: memory,
      });
    }

    switch (action) {
      case "deploy": {
        const { name, platform, runtime, scriptContent, envVars } = body;
        
        if (!name || !platform || !runtime) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: name, platform, runtime" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check bot limit (enforced by database trigger, but double-check here)
        const { count } = await supabase
          .from("bots")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);

        if (count !== null && count >= 3) {
          return new Response(
            JSON.stringify({ 
              error: "Bot limit reached",
              message: "Maximum 3 bots allowed per user."
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Create bot record
        const containerId = generateContainerId();
        const { data: bot, error: createError } = await supabase
          .from("bots")
          .insert({
            user_id: user.id,
            name,
            platform,
            runtime,
            script_content: scriptContent,
            status: "offline",
            container_id: containerId,
            cpu_usage: 0,
            memory_usage: 0,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating bot:", createError);
          return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Store env vars if provided
        if (envVars && envVars.length > 0) {
          const envVarsToInsert = envVars
            .filter(ev => ev.key && ev.value)
            .map(ev => ({
              bot_id: bot.id,
              key: ev.key,
              value: ev.value, // In production, encrypt this
            }));

          if (envVarsToInsert.length > 0) {
            await adminClient.from("bot_env_vars").insert(envVarsToInsert);
          }
        }

        await addLog(bot.id, "info", `Bot "${name}" created with container ${containerId}`);
        await addLog(bot.id, "info", `Runtime: ${runtime}, Platform: ${platform}`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            bot,
            message: `Bot "${name}" deployed successfully`
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "start": {
        if (!botId) {
          return new Response(
            JSON.stringify({ error: "Missing botId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!(await verifyBotOwnership(botId))) {
          return new Response(
            JSON.stringify({ error: "Bot not found or access denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Simulate container start
        const resources = simulateResourceUsage();
        const containerId = generateContainerId();

        containerStates.set(botId, {
          containerId,
          status: "running",
          startedAt: new Date(),
          cpuUsage: resources.cpu,
          memoryUsage: resources.memory,
        });

        // Update bot status
        const { error: updateError } = await supabase
          .from("bots")
          .update({
            status: "online",
            container_id: containerId,
            last_started_at: new Date().toISOString(),
            cpu_usage: resources.cpu,
            memory_usage: resources.memory,
          })
          .eq("id", botId);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await addLog(botId, "info", "Bot started successfully");
        await addLog(botId, "info", `Container ${containerId} is running`);
        await addLog(botId, "debug", `Resources allocated: ${resources.cpu}% CPU, ${resources.memory}MB RAM`);
        await recordResources(botId, resources.cpu, resources.memory);

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "online",
            containerId,
            resources
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "stop": {
        if (!botId) {
          return new Response(
            JSON.stringify({ error: "Missing botId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!(await verifyBotOwnership(botId))) {
          return new Response(
            JSON.stringify({ error: "Bot not found or access denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Remove from container states
        containerStates.delete(botId);

        // Update bot status
        const { error: updateError } = await supabase
          .from("bots")
          .update({
            status: "stopped",
            cpu_usage: 0,
            memory_usage: 0,
          })
          .eq("id", botId);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await addLog(botId, "info", "Bot stopped");
        await addLog(botId, "info", "Container terminated gracefully");

        return new Response(
          JSON.stringify({ success: true, status: "stopped" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "restart": {
        if (!botId) {
          return new Response(
            JSON.stringify({ error: "Missing botId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!(await verifyBotOwnership(botId))) {
          return new Response(
            JSON.stringify({ error: "Bot not found or access denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await addLog(botId, "info", "Restarting bot...");

        // Simulate restart
        const resources = simulateResourceUsage();
        const newContainerId = generateContainerId();

        const { error: updateError } = await supabase
          .from("bots")
          .update({
            status: "online",
            container_id: newContainerId,
            last_started_at: new Date().toISOString(),
            cpu_usage: resources.cpu,
            memory_usage: resources.memory,
          })
          .eq("id", botId);

        if (updateError) {
          return new Response(
            JSON.stringify({ error: updateError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await addLog(botId, "info", "Bot restarted successfully");
        await addLog(botId, "info", `New container ${newContainerId} is running`);
        await recordResources(botId, resources.cpu, resources.memory);

        return new Response(
          JSON.stringify({ 
            success: true, 
            status: "online",
            containerId: newContainerId,
            resources
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        if (!botId) {
          return new Response(
            JSON.stringify({ error: "Missing botId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!(await verifyBotOwnership(botId))) {
          return new Response(
            JSON.stringify({ error: "Bot not found or access denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Remove from container states
        containerStates.delete(botId);

        // Delete bot (cascades to env_vars, logs, resource_history via FK)
        const { error: deleteError } = await supabase
          .from("bots")
          .delete()
          .eq("id", botId);

        if (deleteError) {
          return new Response(
            JSON.stringify({ error: deleteError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Bot deleted successfully" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "status": {
        if (!botId) {
          return new Response(
            JSON.stringify({ error: "Missing botId" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!(await verifyBotOwnership(botId))) {
          return new Response(
            JSON.stringify({ error: "Bot not found or access denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: bot } = await supabase
          .from("bots")
          .select("*")
          .eq("id", botId)
          .single();

        // Simulate live resource updates for running bots
        if (bot?.status === "online") {
          const resources = simulateResourceUsage();
          await supabase
            .from("bots")
            .update({
              cpu_usage: resources.cpu,
              memory_usage: resources.memory,
            })
            .eq("id", botId);
          
          await recordResources(botId, resources.cpu, resources.memory);
          
          return new Response(
            JSON.stringify({ 
              success: true, 
              bot: { ...bot, cpu_usage: resources.cpu, memory_usage: resources.memory }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, bot }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Error in bot-manager:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
