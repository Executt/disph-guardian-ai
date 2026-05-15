import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, AlertTriangle, Server, Shield, ShieldCheck,
  Settings, LogOut, User, ChevronDown, Menu, X, Brain, Users, ShieldAlert, Bot
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navItems = [
  { label: "Dashboard", path: "/", icon: LayoutDashboard },
  { label: "Incidentes", path: "/incidents", icon: AlertTriangle },
  { label: "AR", path: "/ar", icon: ShieldAlert },
  { label: "Infraestrutura", path: "/infrastructure", icon: Server },
  { label: "DevSecOps", path: "/devsecops", icon: Shield },
  { label: "Auditoria", path: "/audit", icon: ShieldCheck },
  { label: "Admin", path: "/admin", icon: Users },
  { label: "Configurações", path: "/settings", icon: Settings },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/20 text-destructive border-destructive/30",
  operator: "bg-primary/20 text-primary border-primary/30",
  viewer: "bg-accent/20 text-accent border-accent/30",
  auditor: "bg-warning/20 text-warning border-warning/30",
};

export default function TopNav() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="h-14 border-b border-border glass sticky top-0 z-50">
      <div className="h-full max-w-[1600px] mx-auto px-4 flex items-center gap-2">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-6 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Brain className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="hidden sm:flex flex-col leading-none">
            <span className="text-sm font-bold tracking-wide text-foreground heading">DISPH</span>
            <span className="text-[9px] font-mono tracking-[0.2em] text-primary/70">GUARDIAN AI</span>
          </div>
        </div>

        {/* Desktop Nav Items */}
        <div className="hidden lg:flex items-center gap-0.5 flex-1">
          {navItems.map((item) => {
            const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="hidden md:flex items-center gap-2 mr-2">
            <div className="h-1.5 w-1.5 rounded-full bg-accent status-pulse" />
            <span className="text-[10px] font-mono text-muted-foreground">OPERACIONAL</span>
          </div>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 h-8 px-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-medium text-foreground hidden sm:inline">
                    {user.displayName}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-sm font-medium">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {user.roles.map((role) => (
                        <Badge key={role} variant="outline" className={`text-[10px] font-mono uppercase ${ROLE_COLORS[role] || ""}`}>
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-xs text-muted-foreground gap-2" disabled>
                  <Shield className="h-3.5 w-3.5" />
                  Realm: {user.realm} · MFA ativo
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-3.5 w-3.5" />
                  Encerrar Sessão
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile toggle */}
          <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-card/95 backdrop-blur-lg absolute left-0 right-0 z-50">
          <div className="p-3 space-y-1">
            {navItems.map((item) => {
              const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2.5 rounded-md text-sm transition-all",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary/60"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
