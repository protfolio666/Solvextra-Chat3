import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/stats-card";
import { MessageSquare, Users, Clock, CheckCircle, TrendingUp, TicketIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Analytics() {
  const { data: stats } = useQuery({
    queryKey: ["/api/analytics/stats"],
  });

  return (
    <div className="h-full overflow-auto">
      <div className="border-b border-border p-6 bg-background">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor your support performance
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Conversations"
            value={stats?.totalConversations || 247}
            icon={MessageSquare}
            description="This month"
            trend={{ value: 12, isPositive: true }}
          />
          <StatsCard
            title="Active Agents"
            value={stats?.activeAgents || 8}
            icon={Users}
            description="Currently online"
          />
          <StatsCard
            title="Avg Response Time"
            value={stats?.avgResponseTime || "2.5m"}
            icon={Clock}
            description="Last 7 days"
            trend={{ value: 15, isPositive: true }}
          />
          <StatsCard
            title="Resolution Rate"
            value={stats?.resolutionRate || "94%"}
            icon={CheckCircle}
            description="This week"
            trend={{ value: 3, isPositive: true }}
          />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="agents">Agent Performance</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Conversation Volume</CardTitle>
                  <CardDescription>Messages over the last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Chart placeholder - Line graph showing conversation trends
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Channel Distribution</CardTitle>
                  <CardDescription>Conversations by channel</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Chart placeholder - Donut chart showing channel breakdown
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest support interactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-success rounded-full" />
                        <div>
                          <p className="text-sm font-medium">Conversation resolved</p>
                          <p className="text-xs text-muted-foreground">Customer #{1234 + i} via WhatsApp</p>
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">{i}m ago</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="agents">
            <Card>
              <CardHeader>
                <CardTitle>Agent Performance</CardTitle>
                <CardDescription>Individual agent metrics and statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Agent performance metrics will be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channels">
            <Card>
              <CardHeader>
                <CardTitle>Channel Analytics</CardTitle>
                <CardDescription>Performance metrics by communication channel</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  Channel-specific analytics will be displayed here
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
