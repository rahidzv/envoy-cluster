import { motion } from "framer-motion";
import { Play, Square, RotateCcw, Terminal, MoreVertical, Cpu, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type BotStatus = "running" | "stopped" | "error" | "deploying";
export type BotPlatform = "telegram" | "discord";

interface BotCardProps {
  id: string;
  name: string;
  platform: BotPlatform;
  status: BotStatus;
  cpuUsage: number;
  memoryUsage: number;
  uptime?: string;
  onStart: (id: string) => void;
  onStop: (id: string) => void;
  onRestart: (id: string) => void;
  onViewLogs: (id: string) => void;
  delay?: number;
}

const platformIcons = {
  telegram: "https://cdn.simpleicons.org/telegram/26A5E4",
  discord: "https://cdn.simpleicons.org/discord/5865F2",
};

const statusConfig = {
  running: { label: "Running", class: "status-online animate-pulse-glow" },
  stopped: { label: "Stopped", class: "status-offline" },
  error: { label: "Error", class: "status-error" },
  deploying: { label: "Deploying", class: "status-warning" },
};

export const BotCard = ({
  id,
  name,
  platform,
  status,
  cpuUsage,
  memoryUsage,
  uptime,
  onStart,
  onStop,
  onRestart,
  onViewLogs,
  delay = 0,
}: BotCardProps) => {
  const isRunning = status === "running";
  const statusInfo = statusConfig[status];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-card border border-border rounded-xl p-5 card-shadow hover:border-primary/30 transition-all duration-300 group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
            <img 
              src={platformIcons[platform]} 
              alt={platform} 
              className="w-5 h-5"
            />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{name}</h3>
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", statusInfo.class)} />
              <span className="text-xs text-muted-foreground capitalize">
                {statusInfo.label}
              </span>
              {uptime && isRunning && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span className="text-xs text-muted-foreground">Up {uptime}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">CPU</span>
          </div>
          <div className="flex items-end gap-1">
            <span className="text-lg font-semibold text-foreground">{cpuUsage}</span>
            <span className="text-xs text-muted-foreground mb-0.5">%</span>
          </div>
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                cpuUsage > 80 ? "bg-destructive" : cpuUsage > 50 ? "bg-warning" : "bg-primary"
              )}
              style={{ width: `${cpuUsage}%` }}
            />
          </div>
        </div>
        <div className="bg-secondary/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Memory</span>
          </div>
          <div className="flex items-end gap-1">
            <span className="text-lg font-semibold text-foreground">{memoryUsage}</span>
            <span className="text-xs text-muted-foreground mb-0.5">MB</span>
          </div>
          <div className="mt-2 h-1 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                memoryUsage > 40 ? "bg-destructive" : memoryUsage > 25 ? "bg-warning" : "bg-primary"
              )}
              style={{ width: `${(memoryUsage / 50) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Button 
            variant="destructive" 
            size="sm" 
            className="flex-1"
            onClick={() => onStop(id)}
          >
            <Square className="w-3.5 h-3.5" />
            Stop
          </Button>
        ) : (
          <Button 
            variant="success" 
            size="sm" 
            className="flex-1"
            onClick={() => onStart(id)}
          >
            <Play className="w-3.5 h-3.5" />
            Start
          </Button>
        )}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onRestart(id)}
          disabled={!isRunning}
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </Button>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => onViewLogs(id)}
        >
          <Terminal className="w-3.5 h-3.5" />
        </Button>
      </div>
    </motion.div>
  );
};
