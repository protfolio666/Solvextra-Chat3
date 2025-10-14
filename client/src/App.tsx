import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import Inbox from "@/pages/inbox";
import Agents from "@/pages/agents";
import Tickets from "@/pages/tickets";
import Settings from "@/pages/settings";
import Analytics from "@/pages/analytics";
import Channels from "@/pages/channels";
import KnowledgeBase from "@/pages/knowledge-base";
import AuthPage from "@/pages/auth";
import ChatWidget from "@/pages/widget";
import NotFound from "@/pages/not-found";

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5" />
      )}
    </Button>
  );
}

function ProtectedRouter() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Inbox} />
      <ProtectedRoute path="/conversations" component={Inbox} />
      <ProtectedRoute path="/channels" component={Channels} />
      <ProtectedRoute path="/agents" component={Agents} allowedRoles={["admin"]} />
      <ProtectedRoute path="/tickets" component={Tickets} />
      <ProtectedRoute path="/knowledge-base" component={KnowledgeBase} />
      <ProtectedRoute path="/analytics" component={Analytics} allowedRoles={["admin"]} />
      <ProtectedRoute path="/settings" component={Settings} allowedRoles={["admin"]} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <Switch>
      {/* Public routes without sidebar */}
      <Route path="/auth" component={AuthPage} />
      <Route path="/widget" component={ChatWidget} />
      
      {/* Protected routes with sidebar */}
      <Route>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between p-3 border-b border-border bg-background">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <ThemeToggle />
              </header>
              <main className="flex-1 overflow-hidden">
                <ProtectedRouter />
              </main>
            </div>
          </div>
        </SidebarProvider>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
