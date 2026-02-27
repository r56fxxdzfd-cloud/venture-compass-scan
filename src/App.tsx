import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import StartupsPage from "./pages/StartupsPage";
import StartupDetailPage from "./pages/StartupDetailPage";
import QuestionnairePage from "./pages/QuestionnairePage";
import ReportPage from "./pages/ReportPage";
import SimulatorPage from "./pages/SimulatorPage";
import AdminConfigPage from "./pages/AdminConfigPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/app/dashboard" element={<ProtectedRoute><AppLayout><DashboardPage /></AppLayout></ProtectedRoute>} />
      <Route path="/app/startups" element={<ProtectedRoute><AppLayout><StartupsPage /></AppLayout></ProtectedRoute>} />
      <Route path="/app/startups/:id" element={<ProtectedRoute><AppLayout><StartupDetailPage /></AppLayout></ProtectedRoute>} />
      <Route path="/app/assessments/:id/questionnaire" element={<ProtectedRoute requiredRoles={['jv_admin', 'jv_analyst']}><AppLayout><QuestionnairePage /></AppLayout></ProtectedRoute>} />
      <Route path="/app/assessments/:id/report" element={<ProtectedRoute><AppLayout><ReportPage /></AppLayout></ProtectedRoute>} />
      <Route path="/app/simulator" element={<ProtectedRoute><AppLayout><SimulatorPage /></AppLayout></ProtectedRoute>} />
      <Route path="/app/admin/config" element={<ProtectedRoute requiredRoles={['jv_admin']}><AppLayout><AdminConfigPage /></AppLayout></ProtectedRoute>} />
      <Route path="/app/admin/users" element={<ProtectedRoute requiredRoles={['jv_admin']}><AppLayout><AdminUsersPage /></AppLayout></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
