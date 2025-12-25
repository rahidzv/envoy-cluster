import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { botApi } from "@/lib/api";
import type { Database } from "@/integrations/supabase/types";

type Bot = Database["public"]["Tables"]["bots"]["Row"];
type BotEnvVar = Database["public"]["Tables"]["bot_env_vars"]["Row"];

export interface BotWithEnvVars extends Bot {
  envVars?: BotEnvVar[];
}

export const useBots = () => {
  const [bots, setBots] = useState<BotWithEnvVars[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchBots = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bots")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBots(data || []);
    } catch (error: any) {
      console.error("Error fetching bots:", error);
      toast.error("Failed to load bots");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchBots();
    }
  }, [user, fetchBots]);

  // Set up realtime subscription for bot updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("bots-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bots",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setBots((prev) => [payload.new as Bot, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setBots((prev) =>
              prev.map((bot) =>
                bot.id === payload.new.id ? (payload.new as Bot) : bot
              )
            );
          } else if (payload.eventType === "DELETE") {
            setBots((prev) => prev.filter((bot) => bot.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const createBot = async (
    name: string,
    platform: "telegram" | "discord",
    runtime: "python" | "nodejs" | "php",
    scriptContent?: string,
    envVars?: { key: string; value: string }[]
  ) => {
    if (!user) return null;

    try {
      const result = await botApi.deploy({
        name,
        platform,
        runtime,
        scriptContent,
        envVars,
      });

      if (!result.success) {
        toast.error(result.message || result.error || "Failed to create bot");
        return null;
      }

      toast.success("Bot created successfully!");
      return result.bot;
    } catch (error: any) {
      console.error("Error creating bot:", error);
      toast.error(error.message || "Failed to create bot");
      return null;
    }
  };

  const startBot = async (botId: string) => {
    try {
      // Optimistic update
      setBots((prev) =>
        prev.map((bot) =>
          bot.id === botId ? { ...bot, status: "deploying" as const } : bot
        )
      );

      const result = await botApi.start(botId);

      if (!result.success) {
        // Revert on error
        await fetchBots();
        toast.error(result.message || result.error || "Failed to start bot");
        return false;
      }

      toast.success("Bot started successfully");
      return true;
    } catch (error: any) {
      console.error("Error starting bot:", error);
      await fetchBots();
      toast.error("Failed to start bot");
      return false;
    }
  };

  const stopBot = async (botId: string) => {
    try {
      const result = await botApi.stop(botId);

      if (!result.success) {
        toast.error(result.message || result.error || "Failed to stop bot");
        return false;
      }

      toast.success("Bot stopped");
      return true;
    } catch (error: any) {
      console.error("Error stopping bot:", error);
      toast.error("Failed to stop bot");
      return false;
    }
  };

  const restartBot = async (botId: string) => {
    try {
      // Optimistic update
      setBots((prev) =>
        prev.map((bot) =>
          bot.id === botId ? { ...bot, status: "deploying" as const } : bot
        )
      );

      const result = await botApi.restart(botId);

      if (!result.success) {
        await fetchBots();
        toast.error(result.message || result.error || "Failed to restart bot");
        return false;
      }

      toast.success("Bot restarted successfully");
      return true;
    } catch (error: any) {
      console.error("Error restarting bot:", error);
      await fetchBots();
      toast.error("Failed to restart bot");
      return false;
    }
  };

  const deleteBot = async (botId: string) => {
    try {
      const result = await botApi.delete(botId);

      if (!result.success) {
        toast.error(result.message || result.error || "Failed to delete bot");
        return false;
      }

      toast.success("Bot deleted");
      return true;
    } catch (error: any) {
      console.error("Error deleting bot:", error);
      toast.error("Failed to delete bot");
      return false;
    }
  };

  // Legacy method for compatibility
  const updateBotStatus = async (botId: string, status: Bot["status"]) => {
    if (status === "online") {
      return startBot(botId);
    } else if (status === "stopped" || status === "offline") {
      return stopBot(botId);
    } else if (status === "deploying") {
      // This is usually an intermediate state, handled by start/restart
      setBots((prev) =>
        prev.map((bot) =>
          bot.id === botId ? { ...bot, status: "deploying" as const } : bot
        )
      );
    }
  };

  return {
    bots,
    loading,
    fetchBots,
    createBot,
    startBot,
    stopBot,
    restartBot,
    deleteBot,
    updateBotStatus,
  };
};
