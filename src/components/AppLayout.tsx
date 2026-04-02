import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/20 text-destructive border-destructive/30",
  operator: "bg-primary/20 text-primary border-primary/30",
  viewer: "bg-accent/20 text-accent border-accent/30",
  auditor: "bg-warning/20 text-warning border-warning/30",
};

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 bg-card/50 backdrop-blur-sm shrink-0">
            <SidebarTrigger className="mr-4" />

            <div className="flex items-center gap-3 ml-auto">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-xs font-mono text-muted-foreground">v1.0.0-alpha</span>

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
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col gap-1.5">
                        <p className="text-sm font-medium">{user.displayName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
                        <div className="flex gap-1 flex-wrap mt-1">
                          {user.roles.map((role) => (
                            <Badge
                              key={role}
                              variant="outline"
                              className={`text-[10px] font-mono uppercase ${ROLE_COLORS[role] || ""}`}
                            >
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
            </div>
          </header>
          <main className="flex-1 overflow-auto p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
