import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Bot = Database["public"]["Tables"]["bots"]["Row"];
type BotInsert = Database["public"]["Tables"]["bots"]["Insert"];
type BotEnvVar = Database["public"]["Tables"]["bot_env_vars"]["Row"];

export interface BotWithEnvVars extends Bot {
  envVars?: BotEnvVar[];
}

export const useBots = () => {
  const [bots, setBots] = useState<BotWithEnvVars[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchBots = async () => {
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
  };

  useEffect(() => {
    if (user) {
      fetchBots();
    }
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
      const { data: bot, error: botError } = await supabase
        .from("bots")
        .insert({
          user_id: user.id,
          name,
          platform,
          runtime,
          script_content: scriptContent,
          status: "offline",
        })
        .select()
        .single();

      if (botError) throw botError;

      // Insert env vars if provided
      if (envVars && envVars.length > 0 && bot) {
        const envVarsToInsert = envVars
          .filter(ev => ev.key && ev.value)
          .map(ev => ({
            bot_id: bot.id,
            key: ev.key,
            value: ev.value,
          }));

        if (envVarsToInsert.length > 0) {
          const { error: envError } = await supabase
            .from("bot_env_vars")
            .insert(envVarsToInsert);

          if (envError) throw envError;
        }
      }

      toast.success("Bot created successfully!");
      await fetchBots();
      return bot;
    } catch (error: any) {
      console.error("Error creating bot:", error);
      toast.error("Failed to create bot");
      return null;
    }
  };

  const updateBotStatus = async (botId: string, status: Bot["status"]) => {
    try {
      const updateData: any = { status };
      
      if (status === "online") {
        updateData.last_started_at = new Date().toISOString();
      }
      
      if (status === "offline" || status === "stopped") {
        updateData.cpu_usage = 0;
        updateData.memory_usage = 0;
      }

      const { error } = await supabase
        .from("bots")
        .update(updateData)
        .eq("id", botId);

      if (error) throw error;
      
      setBots(prev => prev.map(bot => 
        bot.id === botId ? { ...bot, ...updateData } : bot
      ));
    } catch (error: any) {
      console.error("Error updating bot status:", error);
      toast.error("Failed to update bot status");
    }
  };

  const deleteBot = async (botId: string) => {
    try {
      const { error } = await supabase
        .from("bots")
        .delete()
        .eq("id", botId);

      if (error) throw error;
      
      setBots(prev => prev.filter(bot => bot.id !== botId));
      toast.success("Bot deleted");
    } catch (error: any) {
      console.error("Error deleting bot:", error);
      toast.error("Failed to delete bot");
    }
  };

  const addLog = async (botId: string, level: string, message: string) => {
    try {
      const { error } = await supabase
        .from("bot_logs")
        .insert({
          bot_id: botId,
          level,
          message,
        });

      if (error) throw error;
    } catch (error: any) {
      console.error("Error adding log:", error);
    }
  };

  return {
    bots,
    loading,
    fetchBots,
    createBot,
    updateBotStatus,
    deleteBot,
    addLog,
  };
};
