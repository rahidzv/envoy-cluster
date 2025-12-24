import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BotLog = Database["public"]["Tables"]["bot_logs"]["Row"];

export const useBotLogs = (botId?: string) => {
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("bot_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (botId) {
        query = query.eq("bot_id", botId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error("Error fetching logs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [botId]);

  return {
    logs,
    loading,
    fetchLogs,
  };
};
