import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { botApi } from "@/lib/api";
import type { Database } from "@/integrations/supabase/types";

type Bot = Database["public"]["Tables"]["bots"]["Row"];

interface ResourceStats {
  totalBots: number;
  runningBots: number;
  totalCpu: number;
  totalMemory: number;
  maxBots: number;
  maxCpuPerBot: number;
  maxMemoryPerBot: number;
}

interface ChartData {
  time: string;
  cpu: number;
  memory: number;
}

export const useResourceMetrics = (botId?: string, hours = 24) => {
  const [chartData, setChartData] = useState<ChartData[]>([]);
  const [stats, setStats] = useState<ResourceStats>({
    totalBots: 0,
    runningBots: 0,
    totalCpu: 0,
    totalMemory: 0,
    maxBots: 3,
    maxCpuPerBot: 10,
    maxMemoryPerBot: 50,
  });
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchMetrics = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const result = await botApi.getMetrics(botId, hours);
      if (result.success) {
        setChartData(result.chartData);
        setStats(result.stats);
        setBots(result.bots);
      }
    } catch (error) {
      console.error("Error fetching metrics:", error);
    } finally {
      setLoading(false);
    }
  }, [user, botId, hours]);

  useEffect(() => {
    if (user) {
      fetchMetrics();
    }
  }, [user, fetchMetrics]);

  // Refresh metrics periodically (every 30 seconds)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      fetchMetrics();
    }, 30000);

    return () => clearInterval(interval);
  }, [user, fetchMetrics]);

  return {
    chartData,
    stats,
    bots,
    loading,
    fetchMetrics,
  };
};
