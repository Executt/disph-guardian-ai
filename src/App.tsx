import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import Index from "@/pages/Index";
import IncidentsPage from "@/pages/IncidentsPage";
import SettingsPage from "@/pages/SettingsPage";
import DevSecOpsPage from "@/pages/DevSecOpsPage";
import InfrastructurePage from "@/pages/InfrastructurePage";
import AuditPage from "@/pages/AuditPage";
import AdminPage from "@/pages/AdminPage";
import ARPage from "@/pages/ARPage";
import AgentsPage from "@/pages/AgentsPage";
import AgentDetailPage from "@/pages/AgentDetailPage";
import SkillsCatalogPage from "@/pages/SkillsCatalogPage";
import SystemAuditPage from "@/pages/SystemAuditPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
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
              <Route path="/" element={<Index />} />
              <Route path="/incidents" element={<IncidentsPage />} />
              <Route path="/ar" element={<ARPage />} />
              <Route
                path="/agents"
                element={
                  <ProtectedRoute requiredRoles={["admin", "operator"]}>
                    <AgentsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agents/:id"
                element={
                  <ProtectedRoute requiredRoles={["admin", "operator"]}>
                    <AgentDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/skills-catalog"
                element={
                  <ProtectedRoute requiredRoles={["admin", "operator"]}>
                    <SkillsCatalogPage />
                  </ProtectedRoute>
                }
              />
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
                  <ProtectedRoute requiredRoles={["admin", "auditor"]}>
                    <AuditPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute requiredRoles={["admin"]}>
                    <AdminPage />
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
