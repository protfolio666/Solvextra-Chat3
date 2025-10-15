import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Conversation, Message, Agent } from "@shared/schema";
import { ConversationCard } from "@/components/conversation-card";
import { MessageBubble } from "@/components/message-bubble";
import { ChatInput } from "@/components/chat-input";
import { EscalationBanner } from "@/components/escalation-banner";
import { AgentAssignmentCard } from "@/components/agent-assignment-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Bell, Search, Filter, MessageSquarePlus, CheckCircle, Ticket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useWebSocket } from "@/hooks/use-websocket";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const createTicketSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  tat: z.number().min(1, "TAT must be at least 1 hour"),
});

type CreateTicketForm = z.infer<typeof createTicketSchema>;

export default function Inbox() {
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [createTicketOpen, setCreateTicketOpen] = useState(false);
  const { send } = useWebSocket();
  const { toast } = useToast();
  const { user } = useAuth();

  const createTicketForm = useForm<CreateTicketForm>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      tat: 24,
    },
  });

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

  const resolveConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/resolve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      toast({
        title: "Conversation resolved",
        description: "Conversation has been marked as resolved and CSAT request sent to customer",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to resolve conversation",
        variant: "destructive",
      });
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: CreateTicketForm & { conversationId: string }) => {
      return apiRequest("POST", `/api/conversations/${data.conversationId}/create-ticket`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      setCreateTicketOpen(false);
      createTicketForm.reset();
      toast({
        title: "Ticket created",
        description: "A new support ticket has been created from this conversation",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create ticket",
        variant: "destructive",
      });
    },
  });

  const activeConversation = conversations.find(c => c.id === selectedConversation);
  const needsEscalation = activeConversation?.status === "open";
  const isAssigned = activeConversation?.status === "assigned";

  const filteredConversations = conversations.filter(c =>
    c.customerName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendMessage = (content: string) => {
    if (selectedConversation) {
      sendMessageMutation.mutate({ conversationId: selectedConversation, content });
    }
  };

  const handleEscalate = () => {
    if (selectedConversation) {
      escalateMutation.mutate(selectedConversation);
    }
  };

  const handleResolve = () => {
    if (selectedConversation) {
      resolveConversationMutation.mutate(selectedConversation);
    }
  };

  const handleCreateTicket = (data: CreateTicketForm) => {
    if (selectedConversation) {
      createTicketMutation.mutate({ ...data, conversationId: selectedConversation });
    }
  };

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

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full grid grid-cols-4 gap-1">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="open" className="text-xs">Open</TabsTrigger>
              <TabsTrigger value="assigned" className="text-xs">Assigned</TabsTrigger>
              <TabsTrigger value="resolved" className="text-xs">Resolved</TabsTrigger>
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
                  {activeConversation.status !== "resolved" && activeConversation.status !== "ticket" && (
                    <Dialog open={createTicketOpen} onOpenChange={setCreateTicketOpen}>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          data-testid="button-create-ticket"
                        >
                          <Ticket className="w-4 h-4 mr-2" />
                          Create Ticket
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Support Ticket</DialogTitle>
                        </DialogHeader>
                        <Form {...createTicketForm}>
                          <form onSubmit={createTicketForm.handleSubmit(handleCreateTicket)} className="space-y-4">
                            <FormField
                              control={createTicketForm.control}
                              name="title"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Title</FormLabel>
                                  <FormControl>
                                    <Input placeholder="Brief description of the issue" {...field} data-testid="input-ticket-title" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={createTicketForm.control}
                              name="description"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Description</FormLabel>
                                  <FormControl>
                                    <Textarea placeholder="Detailed description of the issue" {...field} data-testid="input-ticket-description" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={createTicketForm.control}
                              name="priority"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Priority</FormLabel>
                                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                      <SelectTrigger data-testid="select-ticket-priority">
                                        <SelectValue placeholder="Select priority" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="low">Low</SelectItem>
                                      <SelectItem value="medium">Medium</SelectItem>
                                      <SelectItem value="high">High</SelectItem>
                                      <SelectItem value="urgent">Urgent</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={createTicketForm.control}
                              name="tat"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Turn Around Time (hours)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      placeholder="24"
                                      {...field}
                                      onChange={e => field.onChange(parseInt(e.target.value))}
                                      data-testid="input-ticket-tat"
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setCreateTicketOpen(false)}
                                data-testid="button-cancel-ticket"
                              >
                                Cancel
                              </Button>
                              <Button
                                type="submit"
                                disabled={createTicketMutation.isPending}
                                data-testid="button-submit-ticket"
                              >
                                {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
                              </Button>
                            </div>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  )}
                  {activeConversation.status !== "resolved" && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleResolve}
                      disabled={resolveConversationMutation.isPending}
                      data-testid="button-resolve-conversation"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      {resolveConversationMutation.isPending ? "Resolving..." : "Resolve"}
                    </Button>
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
                  messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      agentAvatar={assignedAgent?.avatar || undefined}
                    />
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Chat Input */}
            <ChatInput
              onSend={handleSendMessage}
              placeholder="Type your message..."
              disabled={sendMessageMutation.isPending}
            />
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
