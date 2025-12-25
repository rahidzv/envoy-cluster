import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, Cpu, HardDrive, Activity, Loader2 } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { BotCard, BotStatus, BotPlatform } from "@/components/dashboard/BotCard";
import { ResourceChart } from "@/components/dashboard/ResourceChart";
import { LogViewer } from "@/components/dashboard/LogViewer";
import { DeployForm } from "@/components/deploy/DeployForm";
import { useBots } from "@/hooks/useBots";
import { useProfile } from "@/hooks/useProfile";
import { useResourceMetrics } from "@/hooks/useResourceMetrics";
import { useBotLogs } from "@/hooks/useBotLogs";

export const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  
  const { bots, loading, startBot, stopBot, restartBot, deleteBot } = useBots();
  const { profile } = useProfile();
  const { chartData } = useResourceMetrics();
  const { logs: rawLogs } = useBotLogs();

  // Transform logs to the format LogViewer expects
  const logs = rawLogs.slice(0, 50).map(log => ({
    id: log.id,
    timestamp: new Date(log.created_at).toLocaleTimeString('en-US', { hour12: false }),
    level: log.level as "info" | "debug" | "warn" | "error",
    message: log.message,
  }));

  const handleStart = async (id: string) => {
    await startBot(id);
  };

  const handleStop = async (id: string) => {
    await stopBot(id);
  };

  const handleRestart = async (id: string) => {
    await restartBot(id);
  };

  const handleViewLogs = (id: string) => {
    setActiveTab("logs");
  };

  const handleDelete = async (id: string) => {
    await deleteBot(id);
  };

  const runningBots = bots.filter(b => b.status === "online").length;
  const totalCpu = bots.reduce((sum, b) => sum + (b.cpu_usage || 0), 0);
  const totalMemory = bots.reduce((sum, b) => sum + (b.memory_usage || 0), 0);

  const displayName = profile?.full_name?.split(" ")[0] || profile?.email?.split("@")[0] || "Developer";

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }

    switch (activeTab) {
      case "deploy":
        return <DeployForm onSuccess={() => setActiveTab("bots")} />;
      case "logs":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Live Logs</h1>
              <p className="text-muted-foreground">Real-time container logs from your running bots</p>
            </div>
            <LogViewer logs={logs} botName={bots[0]?.name || "All Bots"} />
          </div>
        );
      case "bots":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">My Bots</h1>
              <p className="text-muted-foreground">Manage and monitor all your deployed bots</p>
            </div>
            {bots.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center card-shadow">
                <Bot className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No bots deployed yet</h3>
                <p className="text-muted-foreground mb-4">Deploy your first bot to get started</p>
                <button
                  onClick={() => setActiveTab("deploy")}
                  className="text-primary hover:underline font-medium"
                >
                  Deploy a bot →
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {bots.map((bot, index) => (
                  <BotCard
                    key={bot.id}
                    id={bot.id}
                    name={bot.name}
                    platform={bot.platform as BotPlatform}
                    status={bot.status as BotStatus}
                    cpuUsage={bot.cpu_usage || 0}
                    memoryUsage={bot.memory_usage || 0}
                    onStart={handleStart}
                    onStop={handleStop}
                    onRestart={handleRestart}
                    onViewLogs={handleViewLogs}
                    onDelete={handleDelete}
                    delay={index * 0.1}
                  />
                ))}
              </div>
            )}
          </div>
        );
      case "metrics":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Resource Metrics</h1>
              <p className="text-muted-foreground">Detailed resource usage across all your bots</p>
            </div>
            <ResourceChart data={mockChartData} title="24-Hour Resource Usage" />
          </div>
        );
      case "settings":
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Settings</h1>
              <p className="text-muted-foreground">Configure your account and platform preferences</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-8 text-center card-shadow">
              <p className="text-muted-foreground">Settings panel coming soon...</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-6">
            {/* Welcome Section */}
            <div>
              <motion.h1 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-2xl font-bold text-foreground mb-2"
              >
                Welcome back, {displayName}
              </motion.h1>
              <p className="text-muted-foreground">
                Here's what's happening with your bots today
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatsCard 
                title="Active Bots" 
                value={runningBots} 
                subtitle={`${bots.length} total deployed`}
                icon={Bot} 
                variant="primary"
                delay={0}
              />
              <StatsCard 
                title="CPU Usage" 
                value={bots.length > 0 ? `${Math.round(totalCpu / bots.length)}%` : "0%"} 
                subtitle="Average across all bots"
                icon={Cpu} 
                delay={0.1}
              />
              <StatsCard 
                title="Memory Usage" 
                value={`${Math.round(totalMemory)}MB`} 
                subtitle={`of ${bots.length * 50}MB allocated`}
                icon={HardDrive} 
                delay={0.2}
              />
              <StatsCard 
                title="Uptime" 
                value="99.8%" 
                subtitle="Last 30 days"
                icon={Activity} 
                variant="success"
                delay={0.3}
              />
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Bots Grid */}
              <div className="xl:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">Recent Bots</h2>
                  <button 
                    onClick={() => setActiveTab("bots")}
                    className="text-sm text-primary hover:underline"
                  >
                    View all
                  </button>
                </div>
                {bots.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-8 text-center card-shadow">
                    <Bot className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground mb-2">No bots deployed yet</p>
                    <button
                      onClick={() => setActiveTab("deploy")}
                      className="text-primary hover:underline text-sm font-medium"
                    >
                      Deploy your first bot →
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {bots.slice(0, 4).map((bot, index) => (
                      <BotCard
                        key={bot.id}
                        id={bot.id}
                        name={bot.name}
                        platform={bot.platform as BotPlatform}
                        status={bot.status as BotStatus}
                        cpuUsage={bot.cpu_usage || 0}
                        memoryUsage={bot.memory_usage || 0}
                        onStart={handleStart}
                        onStop={handleStop}
                        onRestart={handleRestart}
                        onViewLogs={handleViewLogs}
                        onDelete={handleDelete}
                        delay={index * 0.1}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Chart */}
              <div className="xl:col-span-1">
                <ResourceChart data={mockChartData.slice(-8)} title="Resource Usage" />
              </div>
            </div>

            {/* Logs Section */}
            <LogViewer logs={logs.slice(-8)} botName="All Bots" />
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="pl-64 transition-all duration-300">
        <Header />
        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
