import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { AnimatedPage } from "@/components/AnimatedPage";
import { AnimatePresence } from "framer-motion";

import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import StartupsPage from "./pages/StartupsPage";
import StartupDetailPage from "./pages/StartupDetailPage";
import QuestionnairePage from "./pages/QuestionnairePage";
import ReportPage from "./pages/ReportPage";
import SimulatorPage from "./pages/SimulatorPage";
import MethodologyPage from "./pages/MethodologyPage";
import AdminConfigPage from "./pages/AdminConfigPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/login" element={<AnimatedPage><LoginPage /></AnimatedPage>} />

        <Route path="/app/dashboard" element={<ProtectedRoute><AppLayout><AnimatedPage><DashboardPage /></AnimatedPage></AppLayout></ProtectedRoute>} />
        <Route path="/app/startups" element={<ProtectedRoute><AppLayout><AnimatedPage><StartupsPage /></AnimatedPage></AppLayout></ProtectedRoute>} />
        <Route path="/app/startups/:id" element={<ProtectedRoute><AppLayout><AnimatedPage><StartupDetailPage /></AnimatedPage></AppLayout></ProtectedRoute>} />
        <Route path="/app/assessments/:id/questionnaire" element={<ProtectedRoute requiredRoles={['jv_admin', 'jv_analyst']}><AppLayout><AnimatedPage><QuestionnairePage /></AnimatedPage></AppLayout></ProtectedRoute>} />
        <Route path="/app/assessments/:id/report" element={<ProtectedRoute><AppLayout><AnimatedPage><ReportPage /></AnimatedPage></AppLayout></ProtectedRoute>} />
        <Route path="/app/simulator" element={<ProtectedRoute><AppLayout><AnimatedPage><SimulatorPage /></AnimatedPage></AppLayout></ProtectedRoute>} />
        <Route path="/app/methodology" element={<ProtectedRoute><AppLayout><AnimatedPage><MethodologyPage /></AnimatedPage></AppLayout></ProtectedRoute>} />
        <Route path="/app/admin/config" element={<ProtectedRoute requiredRoles={['jv_admin']}><AppLayout><AnimatedPage><AdminConfigPage /></AnimatedPage></AppLayout></ProtectedRoute>} />
        <Route path="/app/admin/users" element={<ProtectedRoute requiredRoles={['jv_admin']}><AppLayout><AnimatedPage><AdminUsersPage /></AnimatedPage></AppLayout></ProtectedRoute>} />

        <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AnimatedRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
