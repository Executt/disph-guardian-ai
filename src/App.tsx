import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import IncidentsPage from "@/pages/IncidentsPage";
import SettingsPage from "@/pages/SettingsPage";
import DevSecOpsPage from "@/pages/DevSecOpsPage";
import InfrastructurePage from "@/pages/InfrastructurePage";
import AuditPage from "@/pages/AuditPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<IncidentsPage />} />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute requiredRoles={["admin"]}>
                    <SettingsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/devsecops"
                element={
                  <ProtectedRoute requiredRoles={["admin", "operator"]}>
                    <DevSecOpsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/infrastructure"
                element={
                  <ProtectedRoute requiredRoles={["admin", "operator"]}>
                    <InfrastructurePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit"
                element={
                  <ProtectedRoute requiredRoles={["admin"]}>
                    <AuditPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
