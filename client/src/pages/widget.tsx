import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Message } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X, MessageCircle } from "lucide-react";
import { ChatInput } from "@/components/chat-input";
import { TypingIndicator } from "@/components/typing-indicator";
import { useWebSocket } from "@/hooks/use-websocket";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [hasStarted, setHasStarted] = useState(false);
  const [agentTyping, setAgentTyping] = useState(false);

  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversationId, "messages"],
    enabled: !!conversationId,
    refetchInterval: 2000,
  });

  // WebSocket for real-time updates
  const { send } = useWebSocket({
    onMessage: (data: any) => {
      if (data.message?.conversationId === conversationId) {
        queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
      }
    },
    onTyping: (data: any) => {
      const { conversationId: typingConvId, sender, isTyping } = data;
      if (typingConvId === conversationId && (sender === "agent" || sender === "ai")) {
        setAgentTyping(isTyping);
      }
    },
  });

  const createConversationMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/conversations", {
        channel: "website",
        customerName: name,
        customerAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`,
      });
      return await res.json();
    },
    onSuccess: (data) => {
      setConversationId(data.id);
      setHasStarted(true);
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/messages`, {
        sender: "customer",
        senderName: customerName,
        content,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId, "messages"] });
    },
  });

  const handleStart = () => {
    if (customerName.trim()) {
      createConversationMutation.mutate(customerName);
    }
  };

  const handleSend = (content: string) => {
    if (content.trim() && conversationId) {
      sendMessageMutation.mutate(content);
    }
  };

  const handleTyping = (isTyping: boolean) => {
    if (conversationId && customerName) {
      send({
        type: "typing",
        data: {
          conversationId,
          sender: "customer",
          senderName: customerName,
          isTyping,
        },
      });
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {!isOpen ? (
        <Button
          onClick={() => setIsOpen(true)}
          size="icon"
          className="h-14 w-14 rounded-full shadow-lg"
          data-testid="button-open-chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      ) : (
        <Card className="w-[380px] h-[600px] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="bg-primary text-primary-foreground p-4 rounded-t-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              <div>
                <h3 className="font-semibold">Support Chat</h3>
                <p className="text-xs opacity-90">We're here to help!</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!hasStarted ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-4">
              <div className="text-center space-y-2">
                <h4 className="font-semibold text-lg">Welcome!</h4>
                <p className="text-sm text-muted-foreground">
                  Please enter your name to start chatting
                </p>
              </div>
              <div className="w-full space-y-3">
                <Input
                  placeholder="Your name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleStart()}
                  data-testid="input-customer-name"
                />
                <Button
                  onClick={handleStart}
                  className="w-full"
                  disabled={!customerName.trim() || createConversationMutation.isPending}
                  data-testid="button-start-chat"
                >
                  Start Chat
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}
                    >
                      <div className={`flex gap-2 max-w-[80%] ${msg.sender === "customer" ? "flex-row-reverse" : ""}`}>
                        <Avatar className="h-8 w-8">
                          {msg.sender === "customer" ? (
                            <>
                              <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${customerName}`} />
                              <AvatarFallback>{customerName[0]}</AvatarFallback>
                            </>
                          ) : (
                            <>
                              <AvatarImage src="/agent-avatar.png" />
                              <AvatarFallback>{msg.sender === "ai" ? "AI" : "A"}</AvatarFallback>
                            </>
                          )}
                        </Avatar>
                        <div>
                          <div
                            className={`rounded-lg px-3 py-2 ${
                              msg.sender === "customer"
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm">{msg.content}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(msg.timestamp), "HH:mm")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Agent/AI Typing Indicator */}
                  {agentTyping && (
                    <TypingIndicator
                      sender="agent"
                      senderName="Support Agent"
                    />
                  )}
                </div>
              </ScrollArea>

              {/* Input */}
              <ChatInput
                onSend={handleSend}
                onTyping={handleTyping}
                placeholder="Type your message..."
                disabled={sendMessageMutation.isPending}
              />
            </>
          )}
        </Card>
      )}
    </div>
  );
}
