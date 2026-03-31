import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({ title, value, subtitle, icon: Icon, trend, className }: MetricCardProps) {
  return (
    <Card className={cn("bg-card border-border", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
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
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
