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
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";

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
    title: "Settings",
    url: "/settings",
    icon: Settings,
    testId: "nav-settings",
    allowedRoles: ["admin"] as UserRole[],
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <img src={logoPath} alt="Solvextra" className="h-10 w-10" />
          <div>
            <h2 className="text-base font-semibold text-sidebar-foreground">Solvextra</h2>
            <p className="text-xs text-muted-foreground">Support Platform</p>
          </div>
        </div>
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
