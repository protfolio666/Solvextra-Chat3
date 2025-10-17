import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Conversation, Message, Agent, User } from "@shared/schema";
import { ConversationCard } from "@/components/conversation-card";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { EscalationBanner } from "@/components/escalation-banner";
import { AgentAssignmentCard } from "@/components/agent-assignment-card";
import { TypingIndicator } from "@/components/typing-indicator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Bell, Search, Filter, MessageSquarePlus, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useWebSocket } from "@/hooks/use-websocket";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useSoundNotifications } from "@/hooks/use-sound-notifications";
import { useAuth } from "@/hooks/use-auth";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Inbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [typingUsers, setTypingUsers] = useState<Map<string, { sender: string; senderName: string }>>(new Map());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { playNewChatSound, playMessageSound } = useSoundNotifications();
  
  const { send } = useWebSocket({
    onNewChat: () => {
      playNewChatSound();
      toast({
        title: "New Chat Arrived",
        description: "A customer needs assistance. Accept to handle this chat.",
      });
    },
    onMessage: () => {
      playMessageSound();
    },
    onChatAccepted: (data) => {
      if (data.conversationId === selectedConversation) {
        toast({
          title: "Chat Accepted",
          description: `${data.agentName} accepted this chat`,
        });
      }
    },
    onTyping: (data: any) => {
      const { conversationId, sender, senderName, isTyping } = data;
      
      setTypingUsers((prev) => {
        const next = new Map(prev);
        const key = `${conversationId}-${sender}`;
        
        if (isTyping) {
          next.set(key, { sender, senderName });
        } else {
          next.delete(key);
        }
        
        return next;
      });
    },
  });

  const { user } = useAuth();

  const { data: allAgents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  // Get current agent by matching user email to agent email
  const currentAgent = allAgents.find(a => a.email === user?.username);

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/conversations", selectedConversation, "messages"],
    enabled: !!selectedConversation,
  });

  const { data: assignedAgent } = useQuery<Agent>({
    queryKey: ["/api/conversations", selectedConversation, "agent"],
    enabled: !!selectedConversation,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        sender: "agent",
        senderName: user?.name || "Agent",
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversation, "messages"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/escalate`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      if (data.agent) {
        toast({
          title: "Escalated to Agent",
          description: `Conversation assigned to ${data.agent.name}`,
        });
      } else if (data.ticket) {
        toast({
          title: "Ticket Created",
          description: "No agents available. A ticket has been created.",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to escalate conversation",
        variant: "destructive",
      });
    },
  });

  const manualAssignMutation = useMutation({
    mutationFn: async ({ conversationId, agentId }: { conversationId: string; agentId: string }) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/assign`, { agentId });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversation, "agent"] });
      setShowAssignDialog(false);
      setSelectedAgentId("");
      toast({
        title: "Assigned Successfully",
        description: `Conversation assigned to ${data.agent?.name || "agent"}`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to assign conversation",
        variant: "destructive",
      });
    },
  });

  const acceptChatMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/accept`, {});
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", selectedConversation, "agent"] });
      toast({
        title: "Chat Accepted",
        description: "You've successfully accepted this chat",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to accept chat",
        variant: "destructive",
      });
    },
  });

  const activeConversation = conversations.find(c => c.id === selectedConversation);
  const needsEscalation = activeConversation?.status === "open";
  const isAssigned = activeConversation?.status === "assigned";
  const isResolved = activeConversation?.status === "resolved";
  const isPendingAcceptance = activeConversation?.status === "pending_acceptance";

  // Tab state for filtering
  const [selectedTab, setSelectedTab] = useState<string>("all");

  // Force re-render every 3 seconds to update pending chat visibility based on 30-second timer
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 3000); // Check every 3 seconds
    
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom when messages load or new messages arrive
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, selectedConversation]);

  // Filter conversations: hide resolved chats from agents (show only to admin)
  const filteredConversations = conversations.filter(c => {
    const matchesSearch = c.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Tab filtering for admin (admin sees all tabs)
    if (isAdmin) {
      const matchesTab = selectedTab === "all" || c.status === selectedTab;
      return matchesSearch && matchesTab;
    }
    
    // Agents filtering logic - CRITICAL: Agents never see resolved chats
    // 1. Cannot see resolved chats (enforced before tab filter)
    if (c.status === "resolved") {
      return false;
    }
    
    // 2. Can see pending_acceptance chats only within 30 seconds
    if (c.status === "pending_acceptance") {
      if (c.escalationTimestamp) {
        const elapsed = Date.now() - new Date(c.escalationTimestamp).getTime();
        if (elapsed > 30000) {
          return false; // Hide from agent after 30 seconds
        }
      } else {
        return false; // Hide if no timestamp
      }
      // Pending chats show in "all" tab only
      const matchesTab = selectedTab === "all";
      return matchesSearch && matchesTab;
    }
    
    // 3. Can see open chats (AI handling)
    if (c.status === "open") {
      const matchesTab = selectedTab === "all" || selectedTab === "open";
      return matchesSearch && matchesTab;
    }
    
    // 4. Can only see assigned chats if assigned to them
    if (c.status === "assigned") {
      if (currentAgent && c.assignedAgentId === currentAgent.id) {
        const matchesTab = selectedTab === "all" || selectedTab === "assigned";
        return matchesSearch && matchesTab;
      }
      return false; // Hide if assigned to another agent
    }
    
    // Default: hide
    return false;
  });

  const handleSendMessage = (content: string) => {
    // Prevent agents from messaging resolved chats
    if (selectedConversation && !isResolved) {
      sendMessageMutation.mutate({ conversationId: selectedConversation, content });
    } else if (isResolved) {
      toast({
        title: "Cannot Send Message",
        description: "This conversation has been resolved and cannot be modified.",
        variant: "destructive",
      });
    }
  };

  const handleEscalate = () => {
    if (selectedConversation) {
      escalateMutation.mutate(selectedConversation);
    }
  };

  const handleManualAssign = () => {
    if (selectedConversation && selectedAgentId) {
      manualAssignMutation.mutate({ 
        conversationId: selectedConversation, 
        agentId: selectedAgentId 
      });
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (selectedConversation && currentAgent) {
      send({
        type: "typing",
        data: {
          conversationId: selectedConversation,
          sender: "agent",
          senderName: currentAgent.name,
          isTyping,
        },
      });
    }
  };

  const isAdmin = user?.role === "admin";
  const availableAgents = allAgents.filter(a => a.status === "available");

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <div className="w-[360px] border-r border-border flex flex-col bg-card">
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <Button variant="ghost" size="icon" data-testid="button-new-conversation">
              <MessageSquarePlus className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="pl-9"
              data-testid="input-search-conversations"
            />
          </div>

          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="w-full grid grid-cols-4 gap-1">
              <TabsTrigger value="all" className="text-xs" data-testid="tab-all">All</TabsTrigger>
              <TabsTrigger value="open" className="text-xs" data-testid="tab-open">Open</TabsTrigger>
              <TabsTrigger value="assigned" className="text-xs" data-testid="tab-assigned">Assigned</TabsTrigger>
              {isAdmin && <TabsTrigger value="resolved" className="text-xs" data-testid="tab-resolved">Resolved</TabsTrigger>}
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="flex-1">
          {loadingConversations ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">Loading conversations...</p>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-sm">No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const lastMessage = messages
                .filter(m => m.conversationId === conversation.id)
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
              
              return (
                <ConversationCard
                  key={conversation.id}
                  conversation={conversation}
                  isActive={selectedConversation === conversation.id}
                  onClick={() => setSelectedConversation(conversation.id)}
                  preview={lastMessage?.content}
                  unread={Math.random() > 0.5}
                />
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversation && activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-border p-4 bg-background">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base" data-testid="text-conversation-customer">
                    {activeConversation.customerName}
                  </h3>
                  <p className="text-sm text-muted-foreground capitalize">
                    {activeConversation.channel} • {activeConversation.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          data-testid="button-manual-assign"
                        >
                          <UserPlus className="w-4 h-4 mr-2" />
                          Assign Agent
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Assign to Agent</DialogTitle>
                          <DialogDescription>
                            Manually assign this conversation to a specific agent
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <Select 
                            value={selectedAgentId} 
                            onValueChange={setSelectedAgentId}
                          >
                            <SelectTrigger data-testid="select-agent">
                              <SelectValue placeholder="Select an agent" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableAgents.length === 0 ? (
                                <div className="p-2 text-sm text-muted-foreground text-center">
                                  No available agents
                                </div>
                              ) : (
                                availableAgents.map((agent) => (
                                  <SelectItem 
                                    key={agent.id} 
                                    value={agent.id}
                                    data-testid={`option-agent-${agent.id}`}
                                  >
                                    {agent.name} ({agent.email})
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={handleManualAssign}
                            disabled={!selectedAgentId || manualAssignMutation.isPending}
                            className="w-full"
                            data-testid="button-confirm-assign"
                          >
                            {manualAssignMutation.isPending ? "Assigning..." : "Assign"}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                  <Button variant="ghost" size="icon">
                    <Bell className="w-5 h-5" />
                  </Button>
                  <Button variant="ghost" size="icon" data-testid="button-filter">
                    <Filter className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Escalation Banner */}
            {needsEscalation && (
              <EscalationBanner
                onEscalate={handleEscalate}
                isEscalating={escalateMutation.isPending}
              />
            )}

            {/* Accept Chat Banner (Pending Acceptance) */}
            {isPendingAcceptance && activeConversation?.escalationTimestamp && (
              <div className="p-4 bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
                    <div>
                      <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                        Chat Awaiting Acceptance
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        First agent to accept will handle this conversation
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => selectedConversation && acceptChatMutation.mutate(selectedConversation)}
                    disabled={acceptChatMutation.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                    data-testid="button-accept-chat"
                  >
                    {acceptChatMutation.isPending ? "Accepting..." : "Accept Chat"}
                  </Button>
                </div>
              </div>
            )}

            {/* Agent Assignment */}
            {isAssigned && assignedAgent && (
              <div className="p-4 border-b border-border">
                <AgentAssignmentCard agent={assignedAgent} />
              </div>
            )}

            {/* Messages */}
            <ScrollArea className="flex-1 bg-background">
              <div className="space-y-1 py-4">
                {loadingMessages ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p className="text-sm">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <p className="text-sm">Start a conversation</p>
                  </div>
                ) : (
                  <>
                    {messages.map((message) => (
                      <div 
                        key={message.id}
                        className="animate-in fade-in slide-in-from-bottom-2 duration-300"
                      >
                        <MessageBubble
                          message={message}
                          agentAvatar={assignedAgent?.avatar || undefined}
                        />
                      </div>
                    ))}
                    
                    {/* Typing Indicators */}
                    {selectedConversation && Array.from(typingUsers.entries()).map(([key, { sender, senderName }]) => {
                      if (key.startsWith(selectedConversation)) {
                        return (
                          <TypingIndicator
                            key={key}
                            sender={sender as "customer" | "agent" | "ai"}
                            senderName={senderName}
                          />
                        );
                      }
                      return null;
                    })}
                    
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </ScrollArea>

            {/* Chat Input */}
            {isResolved ? (
              <div className="p-4 bg-muted border-t border-border text-center">
                <p className="text-sm text-muted-foreground">
                  This conversation is resolved. Agents cannot send messages.
                </p>
              </div>
            ) : (
              <ChatInput
                onSend={handleSendMessage}
                onTyping={handleTyping}
                placeholder="Type your message..."
                disabled={sendMessageMutation.isPending}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-background">
            <div className="text-center">
              <MessageSquarePlus className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No conversation selected</h3>
              <p className="text-sm text-muted-foreground">
                Select a conversation from the list to start chatting
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
