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

const menuItems = [
  {
    title: "Inbox",
    url: "/",
    icon: Inbox,
    testId: "nav-inbox",
  },
  {
    title: "Conversations",
    url: "/conversations",
    icon: MessageSquare,
    testId: "nav-conversations",
  },
  {
    title: "Channels",
    url: "/channels",
    icon: Radio,
    testId: "nav-channels",
  },
  {
    title: "Agents",
    url: "/agents",
    icon: Users,
    testId: "nav-agents",
  },
  {
    title: "Tickets",
    url: "/tickets",
    icon: TicketIcon,
    testId: "nav-tickets",
  },
  {
    title: "Knowledge Base",
    url: "/knowledge-base",
    icon: BookOpen,
    testId: "nav-knowledge-base",
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
    testId: "nav-analytics",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    testId: "nav-settings",
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-sidebar-foreground">SupportHub</h2>
            <p className="text-xs text-muted-foreground">Omnichannel Platform</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
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
