import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Agent, Conversation } from "@shared/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Users, Clock, MessageSquare, ArrowRightLeft } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

export default function AgentMonitoring() {
  const { toast } = useToast();
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [targetAgentId, setTargetAgentId] = useState<string>("");

  // Fetch all agents
  const { data: agents = [], isLoading: loadingAgents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Fetch all conversations
  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });


  // Transfer chat mutation
  const transferMutation = useMutation({
    mutationFn: async ({ conversationId, agentId }: { conversationId: string; agentId: string }) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/assign`, { agentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setTransferDialogOpen(false);
      setSelectedConversation(null);
      setTargetAgentId("");
      toast({
        title: "Chat Transferred",
        description: "The chat has been successfully transferred to the selected agent.",
      });
    },
    onError: () => {
      toast({
        title: "Transfer Failed",
        description: "Failed to transfer the chat. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Get active conversations (not resolved)
  const activeConversations = conversations.filter(c => c.status !== "resolved");

  // Group conversations by agent
  const conversationsByAgent = activeConversations.reduce((acc, conv) => {
    const agentId = conv.assignedAgentId || "unassigned";
    if (!acc[agentId]) {
      acc[agentId] = [];
    }
    acc[agentId].push(conv);
    return acc;
  }, {} as Record<string, Conversation[]>);

  // Calculate metrics for each agent
  const agentMetrics = agents.map(agent => {
    const agentConversations = conversationsByAgent[agent.id] || [];
    
    // Calculate total handling time (sum of time differences from escalation timestamp)
    const totalHandlingTime = agentConversations.reduce((total, conv) => {
      if (conv.escalationTimestamp) {
        const handlingTime = Date.now() - new Date(conv.escalationTimestamp).getTime();
        return total + handlingTime;
      }
      return total;
    }, 0);

    return {
      agent,
      activeChats: agentConversations.length,
      totalHandlingTime,
      conversations: agentConversations,
    };
  });

  const handleTransferClick = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setTransferDialogOpen(true);
  };

  const handleTransferConfirm = () => {
    if (selectedConversation && targetAgentId) {
      transferMutation.mutate({ conversationId: selectedConversation, agentId: targetAgentId });
    }
  };

  const getConversation = (convId: string) => {
    return conversations.find(c => c.id === convId);
  };

  const formatHandlingTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  if (loadingAgents || loadingConversations) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Loading agent monitoring data...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Agent Monitoring</h1>
        <p className="text-muted-foreground mt-1">
          Monitor agent activity, chat assignments, and handling times
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card data-testid="card-total-agents">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-agents">{agents.length}</div>
            <p className="text-xs text-muted-foreground">
              {agents.filter(a => a.status === "available").length} available
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-chats">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Chats</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-chats">{activeConversations.length}</div>
            <p className="text-xs text-muted-foreground">
              {conversationsByAgent["unassigned"]?.length || 0} unassigned
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-handling-time">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Handling Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-handling-time">
              {formatHandlingTime(
                agentMetrics.reduce((sum, m) => sum + m.totalHandlingTime, 0) / 
                (agentMetrics.filter(m => m.activeChats > 0).length || 1)
              )}
            </div>
            <p className="text-xs text-muted-foreground">Per agent</p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Activity Table */}
      <Card data-testid="card-agent-activity">
        <CardHeader>
          <CardTitle>Agent Activity</CardTitle>
          <CardDescription>View which agents are handling which chats</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active Chats</TableHead>
                <TableHead>Total Handling Time</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agentMetrics.map(({ agent, activeChats, totalHandlingTime, conversations: agentConvs }) => (
                <TableRow key={agent.id} data-testid={`row-agent-${agent.id}`}>
                  <TableCell className="font-medium" data-testid={`text-agent-name-${agent.id}`}>
                    {agent.name}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={agent.status === "available" ? "default" : "secondary"}
                      data-testid={`badge-agent-status-${agent.id}`}
                    >
                      {agent.status}
                    </Badge>
                  </TableCell>
                  <TableCell data-testid={`text-active-chats-${agent.id}`}>
                    {activeChats}
                  </TableCell>
                  <TableCell data-testid={`text-handling-time-${agent.id}`}>
                    {formatHandlingTime(totalHandlingTime)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Show agent's conversations in expanded view
                      }}
                      data-testid={`button-view-details-${agent.id}`}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Active Conversations Table */}
      <Card data-testid="card-active-conversations">
        <CardHeader>
          <CardTitle>Active Conversations</CardTitle>
          <CardDescription>All ongoing chats with transfer options</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Assigned Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Handling Time</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeConversations.map((conv) => {
                const assignedAgent = agents.find(a => a.id === conv.assignedAgentId);
                const handlingTime = conv.escalationTimestamp 
                  ? Date.now() - new Date(conv.escalationTimestamp).getTime()
                  : 0;

                return (
                  <TableRow key={conv.id} data-testid={`row-conversation-${conv.id}`}>
                    <TableCell className="font-medium" data-testid={`text-customer-${conv.id}`}>
                      {conv.customerName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" data-testid={`badge-channel-${conv.id}`}>
                        {conv.channel}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-assigned-agent-${conv.id}`}>
                      {assignedAgent?.name || (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          conv.status === "assigned" ? "default" :
                          conv.status === "pending_acceptance" ? "secondary" :
                          "outline"
                        }
                        data-testid={`badge-status-${conv.id}`}
                      >
                        {conv.status}
                      </Badge>
                    </TableCell>
                    <TableCell data-testid={`text-conv-handling-time-${conv.id}`}>
                      {handlingTime > 0 ? formatHandlingTime(handlingTime) : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTransferClick(conv.id)}
                        disabled={conv.status === "open" || conv.status === "pending_acceptance"}
                        data-testid={`button-transfer-${conv.id}`}
                      >
                        <ArrowRightLeft className="h-4 w-4 mr-1" />
                        Transfer
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {activeConversations.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No active conversations
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent data-testid="dialog-transfer-chat">
          <DialogHeader>
            <DialogTitle>Transfer Chat</DialogTitle>
            <DialogDescription>
              Select an agent to transfer this chat to. The previous agent will lose access to this conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedConversation && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">Customer:</p>
                <p className="text-sm text-muted-foreground">
                  {getConversation(selectedConversation)?.customerName || "Unknown"}
                </p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Select Agent</label>
              <Select value={targetAgentId} onValueChange={setTargetAgentId}>
                <SelectTrigger className="mt-1" data-testid="select-target-agent">
                  <SelectValue placeholder="Choose an agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents
                    .filter(a => a.status === "available")
                    .map(agent => (
                      <SelectItem
                        key={agent.id}
                        value={agent.id}
                        data-testid={`select-item-agent-${agent.id}`}
                      >
                        {agent.name} ({conversationsByAgent[agent.id]?.length || 0} active chats)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setTransferDialogOpen(false)}
              data-testid="button-cancel-transfer"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransferConfirm}
              disabled={!targetAgentId || transferMutation.isPending}
              data-testid="button-confirm-transfer"
            >
              {transferMutation.isPending ? "Transferring..." : "Transfer Chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
