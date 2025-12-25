import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Bot = Database["public"]["Tables"]["bots"]["Row"];
type BotLog = Database["public"]["Tables"]["bot_logs"]["Row"];

interface ApiResponse<T> {
  success?: boolean;
  error?: string;
  message?: string;
  data?: T;
}

interface DeployParams {
  name: string;
  platform: "telegram" | "discord";
  runtime: "python" | "nodejs" | "php";
  scriptContent?: string;
  envVars?: { key: string; value: string }[];
}

interface BotActionResult {
  success: boolean;
  status?: string;
  containerId?: string;
  resources?: { cpu: number; memory: number };
  error?: string;
  message?: string;
  bot?: Bot;
}

interface LogsResult {
  success: boolean;
  logs: (BotLog & { bot_name?: string })[];
  error?: string;
}

interface MetricsResult {
  success: boolean;
  chartData: { time: string; cpu: number; memory: number }[];
  stats: {
    totalBots: number;
    runningBots: number;
    totalCpu: number;
    totalMemory: number;
    maxBots: number;
    maxCpuPerBot: number;
    maxMemoryPerBot: number;
  };
  bots: Bot[];
  error?: string;
}

async function getAuthHeader(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return `Bearer ${session.access_token}`;
}

export const botApi = {
  async deploy(params: DeployParams): Promise<BotActionResult> {
    const { data, error } = await supabase.functions.invoke("bot-manager", {
      body: {
        action: "deploy",
        ...params,
      },
    });

    if (error) {
      console.error("Deploy error:", error);
      return { success: false, error: error.message };
    }

    return data as BotActionResult;
  },

  async start(botId: string): Promise<BotActionResult> {
    const { data, error } = await supabase.functions.invoke("bot-manager", {
      body: { action: "start", botId },
    });

    if (error) {
      console.error("Start error:", error);
      return { success: false, error: error.message };
    }

    return data as BotActionResult;
  },

  async stop(botId: string): Promise<BotActionResult> {
    const { data, error } = await supabase.functions.invoke("bot-manager", {
      body: { action: "stop", botId },
    });

    if (error) {
      console.error("Stop error:", error);
      return { success: false, error: error.message };
    }

    return data as BotActionResult;
  },

  async restart(botId: string): Promise<BotActionResult> {
    const { data, error } = await supabase.functions.invoke("bot-manager", {
      body: { action: "restart", botId },
    });

    if (error) {
      console.error("Restart error:", error);
      return { success: false, error: error.message };
    }

    return data as BotActionResult;
  },

  async delete(botId: string): Promise<BotActionResult> {
    const { data, error } = await supabase.functions.invoke("bot-manager", {
      body: { action: "delete", botId },
    });

    if (error) {
      console.error("Delete error:", error);
      return { success: false, error: error.message };
    }

    return data as BotActionResult;
  },

  async getStatus(botId: string): Promise<BotActionResult> {
    const { data, error } = await supabase.functions.invoke("bot-manager", {
      body: { action: "status", botId },
    });

    if (error) {
      console.error("Status error:", error);
      return { success: false, error: error.message };
    }

    return data as BotActionResult;
  },

  async getLogs(botId?: string, limit = 50, level?: string): Promise<LogsResult> {
    const params = new URLSearchParams();
    if (botId) params.set("botId", botId);
    if (limit) params.set("limit", limit.toString());
    if (level) params.set("level", level);

    const { data, error } = await supabase.functions.invoke("bot-logs", {
      body: {},
      headers: {},
    });

    // Use query params approach
    const authHeader = await getAuthHeader();
    if (!authHeader) {
      return { success: false, logs: [], error: "Not authenticated" };
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bot-logs?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    if (!response.ok) {
      return { success: false, logs: [], error: result.error };
    }

    return result as LogsResult;
  },

  async getMetrics(botId?: string, hours = 24): Promise<MetricsResult> {
    const params = new URLSearchParams();
    if (botId) params.set("botId", botId);
    params.set("hours", hours.toString());

    const authHeader = await getAuthHeader();
    if (!authHeader) {
      return { 
        success: false, 
        chartData: [], 
        stats: { totalBots: 0, runningBots: 0, totalCpu: 0, totalMemory: 0, maxBots: 3, maxCpuPerBot: 10, maxMemoryPerBot: 50 },
        bots: [],
        error: "Not authenticated" 
      };
    }

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resource-metrics?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    if (!response.ok) {
      return { 
        success: false, 
        chartData: [], 
        stats: { totalBots: 0, runningBots: 0, totalCpu: 0, totalMemory: 0, maxBots: 3, maxCpuPerBot: 10, maxMemoryPerBot: 50 },
        bots: [],
        error: result.error 
      };
    }

    return result as MetricsResult;
  },

  async triggerHeartbeat(): Promise<{ success: boolean; botsUpdated: number }> {
    const { data, error } = await supabase.functions.invoke("bot-heartbeat", {
      body: {},
    });

    if (error) {
      console.error("Heartbeat error:", error);
      return { success: false, botsUpdated: 0 };
    }

    return data;
  },
};
