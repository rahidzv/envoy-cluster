import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  variant?: "default" | "primary" | "success" | "warning";
  delay?: number;
}

export const StatsCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  variant = "default",
  delay = 0 
}: StatsCardProps) => {
  const variants = {
    default: "bg-card border-border",
    primary: "bg-primary/5 border-primary/20",
    success: "bg-success/5 border-success/20",
    warning: "bg-warning/5 border-warning/20",
  };

  const iconVariants = {
    default: "bg-secondary text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={cn(
        "p-5 rounded-xl border card-shadow",
        variants[variant]
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          iconVariants[variant]
        )}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <span className={cn(
            "text-xs font-medium px-2 py-1 rounded-full",
            trend.positive 
              ? "bg-success/10 text-success" 
              : "bg-destructive/10 text-destructive"
          )}>
            {trend.positive ? "+" : ""}{trend.value}%
          </span>
        )}
      </div>
      <h3 className="text-2xl font-bold text-foreground mb-1">{value}</h3>
      <p className="text-sm text-muted-foreground">{title}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>
      )}
    </motion.div>
  );
};
