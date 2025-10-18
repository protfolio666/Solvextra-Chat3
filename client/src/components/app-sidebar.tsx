import { Link, useLocation } from "wouter";
import {
  Inbox,
  MessageSquare,
  Users,
  TicketIcon,
  Settings,
  BarChart3,
  Radio,
  BookOpen,
  Star,
  Download,
  Activity,
  Circle,
} from "lucide-react";
import logoPath from "@assets/IMG_3463-removebg-preview_1760467422348.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { UserRole, AgentStatus, Agent } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const menuItems = [
  {
    title: "Inbox",
    url: "/",
    icon: Inbox,
    testId: "nav-inbox",
    allowedRoles: ["admin", "agent"] as UserRole[],
  },
  {
    title: "Channels",
    url: "/channels",
    icon: Radio,
    testId: "nav-channels",
    allowedRoles: ["admin"] as UserRole[],
  },
  {
    title: "Agents",
    url: "/agents",
    icon: Users,
    testId: "nav-agents",
    allowedRoles: ["admin"] as UserRole[],
  },
  {
    title: "Agent Monitoring",
    url: "/agent-monitoring",
    icon: Activity,
    testId: "nav-agent-monitoring",
    allowedRoles: ["admin"] as UserRole[],
  },
  {
    title: "Tickets",
    url: "/tickets",
    icon: TicketIcon,
    testId: "nav-tickets",
    allowedRoles: ["admin", "agent"] as UserRole[],
  },
  {
    title: "Knowledge Base",
    url: "/knowledge-base",
    icon: BookOpen,
    testId: "nav-knowledge-base",
    allowedRoles: ["admin"] as UserRole[],
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    testId: "nav-analytics",
    allowedRoles: ["admin"] as UserRole[],
  },
  {
    title: "CSAT Ratings",
    url: "/csat-dashboard",
    icon: Star,
    testId: "nav-csat",
    allowedRoles: ["admin"] as UserRole[],
  },
  {
    title: "Export",
    url: "/export",
    icon: Download,
    testId: "nav-export",
    allowedRoles: ["admin"] as UserRole[],
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    testId: "nav-settings",
    allowedRoles: ["admin"] as UserRole[],
  },
];

const statusConfig: Record<AgentStatus, { label: string; color: string }> = {
  available: { label: "Available", color: "text-green-600 dark:text-green-400" },
  break: { label: "On Break", color: "text-yellow-600 dark:text-yellow-400" },
  training: { label: "In Training", color: "text-blue-600 dark:text-blue-400" },
  floor_support: { label: "Floor Support", color: "text-purple-600 dark:text-purple-400" },
  not_available: { label: "Not Available", color: "text-gray-600 dark:text-gray-400" },
};

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === "admin";

  // Fetch current agent info
  const { data: myAgent } = useQuery<Agent>({
    queryKey: ["/api/agents/me"],
    enabled: !isAdmin && !!user, // Only for non-admin users
  });

  // Mutation for updating agent status
  const updateStatusMutation = useMutation({
    mutationFn: async (status: AgentStatus) => {
      return apiRequest("PATCH", "/api/agents/me/status", { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents/me"] });
      toast({
        title: "Status Updated",
        description: "Your availability status has been updated",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    },
  });

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <img src={logoPath} alt="Solvextra" className="h-10 w-10" />
          <div>
            <h2 className="text-base font-semibold text-sidebar-foreground">Solvextra</h2>
            <p className="text-xs text-muted-foreground">Support Platform</p>
          </div>
        </div>
        
        {/* Agent Status Selector - Only show for agents */}
        {!isAdmin && myAgent && (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Your Status</label>
            <Select
              value={myAgent.status}
              onValueChange={(value) => updateStatusMutation.mutate(value as AgentStatus)}
              disabled={updateStatusMutation.isPending}
            >
              <SelectTrigger className="w-full" data-testid="select-agent-status">
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <Circle className={`w-2 h-2 fill-current ${statusConfig[myAgent.status].color}`} />
                    <span>{statusConfig[myAgent.status].label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusConfig).map(([value, config]) => (
                  <SelectItem key={value} value={value} data-testid={`status-option-${value}`}>
                    <div className="flex items-center gap-2">
                      <Circle className={`w-2 h-2 fill-current ${config.color}`} />
                      <span>{config.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems
                .filter((item) => !user || item.allowedRoles.includes(user.role))
                .map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link href={item.url} data-testid={item.testId}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
