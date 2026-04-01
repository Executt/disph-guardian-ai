import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
  sparklineData?: number[];
  drilldownItems?: { label: string; value: string | number; env?: string }[];
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, className, sparklineData, drilldownItems }: MetricCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDrilldown = drilldownItems && drilldownItems.length > 0;

  const chartData = sparklineData?.map((v, i) => ({ i, v }));

  return (
    <Card
      className={cn("bg-card border-border transition-all", hasDrilldown && "cursor-pointer hover:border-primary/40", className)}
      onClick={() => hasDrilldown && setExpanded(!expanded)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground">{value}</p>
            {subtitle && (
              <p className={cn(
                "text-xs font-mono",
                trend === "up" && "text-success",
                trend === "down" && "text-destructive",
                (!trend || trend === "neutral") && "text-muted-foreground"
              )}>
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            {hasDrilldown && (
              expanded
                ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                : <ChevronDown className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>

        {chartData && chartData.length > 0 && (
          <div className="mt-2 h-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={trend === "up" ? "hsl(142, 60%, 45%)" : trend === "down" ? "hsl(0, 72%, 51%)" : "hsl(199, 80%, 50%)"}
                  strokeWidth={1.5}
                  dot={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(220, 18%, 10%)", border: "1px solid hsl(220, 14%, 18%)", borderRadius: "4px", fontSize: "10px", padding: "4px 8px" }}
                  formatter={(val: number) => [val.toFixed(1), ""]}
                  labelFormatter={() => ""}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {expanded && drilldownItems && (
          <div className="mt-3 pt-3 border-t border-border space-y-1.5 animate-in slide-in-from-top-2 duration-200">
            {drilldownItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="font-mono text-muted-foreground truncate">{item.label}</span>
                <div className="flex items-center gap-2">
                  {item.env && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{item.env}</span>
                  )}
                  <span className="font-mono font-semibold text-foreground">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
