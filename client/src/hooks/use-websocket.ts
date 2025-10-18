import { useEffect, useRef, useCallback } from "react";
import { WSMessage } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

interface WebSocketCallbacks {
  onNewChat?: () => void;
  onMessage?: (data: any) => void;
  onChatAccepted?: (data: any) => void;
  onTyping?: (data: any) => void;
}

export function useWebSocket(callbacks?: WebSocketCallbacks) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const callbacksRef = useRef(callbacks);
  
  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log("Connecting to WebSocket:", wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("WebSocket connected successfully");
        };

        ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            
            // Refetch relevant queries immediately for instant updates
            switch (message.type) {
              case "new_chat":
                queryClient.refetchQueries({ queryKey: ["/api/conversations"] });
                callbacksRef.current?.onNewChat?.();
                break;
              case "message":
                // Refetch both conversations list and specific conversation messages
                queryClient.refetchQueries({ queryKey: ["/api/conversations"] });
                if (message.data.message?.conversationId) {
                  queryClient.refetchQueries({ 
                    queryKey: ["/api/conversations", message.data.message.conversationId, "messages"] 
                  });
                }
                callbacksRef.current?.onMessage?.(message.data);
                break;
              case "chat_accepted":
                queryClient.refetchQueries({ queryKey: ["/api/conversations"] });
                if (message.data.conversationId) {
                  queryClient.refetchQueries({ 
                    queryKey: ["/api/conversations", message.data.conversationId, "agent"] 
                  });
                }
                callbacksRef.current?.onChatAccepted?.(message.data);
                break;
              case "status_update":
                if (message.data.conversation) {
                  queryClient.refetchQueries({ queryKey: ["/api/conversations"] });
                }
                if (message.data.agent) {
                  queryClient.refetchQueries({ queryKey: ["/api/agents"] });
                }
                break;
              case "escalation":
                queryClient.refetchQueries({ queryKey: ["/api/conversations"] });
                if (message.data.ticket) {
                  queryClient.refetchQueries({ queryKey: ["/api/tickets"] });
                }
                break;
              case "assignment":
                queryClient.refetchQueries({ queryKey: ["/api/conversations"] });
                queryClient.refetchQueries({ queryKey: ["/api/agents"] });
                // Refetch agent query for the specific conversation
                if (message.data.conversationId) {
                  queryClient.refetchQueries({ 
                    queryKey: ["/api/conversations", message.data.conversationId, "agent"] 
                  });
                }
                break;
              case "typing":
                callbacksRef.current?.onTyping?.(message.data);
                break;
              case "ticket_updated":
                // Refetch tickets list
                queryClient.refetchQueries({ queryKey: ["/api/tickets"] });
                // Refetch audit log and email replies for the specific ticket
                if (message.data?.ticketId) {
                  queryClient.refetchQueries({ 
                    queryKey: [`/api/tickets/${message.data.ticketId}/audit`] 
                  });
                  queryClient.refetchQueries({ 
                    queryKey: [`/api/tickets/${message.data.ticketId}/email-replies`] 
                  });
                }
                break;
            }
          } catch (error) {
            console.error("WebSocket message parsing error:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
        };

        ws.onclose = () => {
          console.log("WebSocket disconnected, reconnecting in 3s...");
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error("Failed to create WebSocket:", error);
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      wsRef.current?.close();
    };
  }, []);

  const send = useCallback((message: WSMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  return { send };
}
