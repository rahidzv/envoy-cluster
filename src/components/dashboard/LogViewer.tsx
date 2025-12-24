import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Terminal, Download, Trash2, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "debug";
  message: string;
}

interface LogViewerProps {
  logs: LogEntry[];
  botName?: string;
}

const levelColors = {
  info: "text-primary",
  warn: "text-warning",
  error: "text-destructive",
  debug: "text-muted-foreground",
};

const levelBadges = {
  info: "bg-primary/10 text-primary border-primary/20",
  warn: "bg-warning/10 text-warning border-warning/20",
  error: "bg-destructive/10 text-destructive border-destructive/20",
  debug: "bg-muted text-muted-foreground border-border",
};

export const LogViewer = ({ logs, botName }: LogViewerProps) => {
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, paused]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.4 }}
      className="bg-card border border-border rounded-xl card-shadow overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Terminal className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Live Logs</h3>
            {botName && (
              <p className="text-xs text-muted-foreground">{botName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon-sm"
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon-sm">
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon-sm">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Log Content */}
      <div 
        ref={scrollRef}
        className="h-80 overflow-auto font-mono text-sm p-4 scrollbar-thin bg-background/50"
      >
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <span>No logs available</span>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-1 hover:bg-secondary/30 px-2 -mx-2 rounded">
                <span className="text-muted-foreground/60 shrink-0 text-xs pt-0.5">
                  {log.timestamp}
                </span>
                <span className={cn(
                  "text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded border shrink-0",
                  levelBadges[log.level]
                )}>
                  {log.level}
                </span>
                <span className={cn("break-all", levelColors[log.level])}>
                  {log.message}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};
