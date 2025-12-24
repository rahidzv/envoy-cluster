import { motion } from "framer-motion";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";

interface DataPoint {
  time: string;
  cpu: number;
  memory: number;
}

interface ResourceChartProps {
  data: DataPoint[];
  title: string;
}

export const ResourceChart = ({ data, title }: ResourceChartProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.4 }}
      className="bg-card border border-border rounded-xl p-5 card-shadow"
    >
      <h3 className="text-lg font-semibold text-foreground mb-4">{title}</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(174 72% 56%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(174 72% 56%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="memoryGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(263 70% 58%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(263 70% 58%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(222 30% 18%)" 
              vertical={false}
            />
            <XAxis 
              dataKey="time" 
              stroke="hsl(215 20% 55%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis 
              stroke="hsl(215 20% 55%)"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(222 47% 8%)",
                border: "1px solid hsl(222 30% 18%)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "hsl(210 40% 98%)" }}
              itemStyle={{ color: "hsl(210 40% 98%)" }}
            />
            <Area
              type="monotone"
              dataKey="cpu"
              stroke="hsl(174 72% 56%)"
              strokeWidth={2}
              fill="url(#cpuGradient)"
              name="CPU %"
            />
            <Area
              type="monotone"
              dataKey="memory"
              stroke="hsl(263 70% 58%)"
              strokeWidth={2}
              fill="url(#memoryGradient)"
              name="Memory %"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">CPU Usage</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-accent" />
          <span className="text-sm text-muted-foreground">Memory Usage</span>
        </div>
      </div>
    </motion.div>
  );
};
