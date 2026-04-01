import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Cloud, Server, Database } from "lucide-react";

export type Environment = "all" | "AWS" | "OCI" | "On-Premise";

const envConfig: Record<Exclude<Environment, "all">, { label: string; icon: React.ElementType; color: string }> = {
  AWS: { label: "AWS", icon: Cloud, color: "text-[hsl(38,92%,50%)]" },
  OCI: { label: "OCI", icon: Database, color: "text-[hsl(199,80%,50%)]" },
  "On-Premise": { label: "On-Premise", icon: Server, color: "text-[hsl(142,60%,45%)]" },
};

interface EnvironmentFilterProps {
  selected: Environment;
  onChange: (env: Environment) => void;
}

export function EnvironmentFilter({ selected, onChange }: EnvironmentFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mr-1">Ambiente:</span>
      <Badge
        variant={selected === "all" ? "default" : "outline"}
        className={cn("cursor-pointer font-mono text-[10px] transition-all hover:bg-primary/20", selected === "all" && "bg-primary text-primary-foreground")}
        onClick={() => onChange("all")}
      >
        Todos
      </Badge>
      {(Object.keys(envConfig) as Exclude<Environment, "all">[]).map((env) => {
        const cfg = envConfig[env];
        const Icon = cfg.icon;
        const isActive = selected === env;
        return (
          <Badge
            key={env}
            variant={isActive ? "default" : "outline"}
            className={cn(
              "cursor-pointer font-mono text-[10px] transition-all hover:bg-primary/20 gap-1",
              isActive && "bg-primary text-primary-foreground"
            )}
            onClick={() => onChange(env)}
          >
            <Icon className="h-3 w-3" />
            {cfg.label}
          </Badge>
        );
      })}
    </div>
  );
}
