import { Navigate } from "react-router-dom";
import { useAuth, type AppRole } from "@/contexts/AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: AppRole[];
  fallback?: React.ReactNode;
}

export function ProtectedRoute({ children, requiredRoles, fallback }: ProtectedRouteProps) {
  const { isAuthenticated, mfaPending, user } = useAuth();

  if (!isAuthenticated && !mfaPending) {
    return <Navigate to="/login" replace />;
  }

  if (mfaPending) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && requiredRoles.length > 0 && user) {
    const hasAccess = requiredRoles.some(r => user.roles.includes(r));
    if (!hasAccess) {
      return fallback ? <>{fallback}</> : <AccessDenied />;
    }
  }

  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <span className="text-3xl">🔒</span>
      </div>
      <h2 className="text-xl font-bold text-foreground">Acesso Negado</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Você não possui permissão para acessar este módulo.
        Contate o administrador para solicitar acesso.
      </p>
    </div>
  );
}
