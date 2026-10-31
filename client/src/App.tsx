// ============================================================
// APP — Configuración principal
// Tema: dark (Command Center / Tactical Intelligence)
// ============================================================

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import DashboardEjecutivo from "./pages/DashboardEjecutivo";
import Integracion from "./pages/Integracion";
import { AuthGuard } from "./components/AuthGuard";
import { useAuth } from "./_core/hooks/useAuth";

// Gate de "/": sin sesión real (cookie válida vía auth.me) → al login.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/login" });
  if (loading || !user) return null;
  return <>{children}</>;
}

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/"}>
        <RequireAuth><Home /></RequireAuth>
      </Route>
      <Route path={"/dashboard"}>
        <AuthGuard><DashboardEjecutivo /></AuthGuard>
      </Route>
      <Route path={"/integracion"}>
        <AuthGuard><Integracion /></AuthGuard>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <NotificationProvider>
          <TooltipProvider>
            {/* bottom-right: top-right ya lo ocupan el reloj, la campana y el
                usuario del Header — un toast ahí los tapaba por completo. */}
            <Toaster position="bottom-right" />
            <Router />
          </TooltipProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
