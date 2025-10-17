import { useEffect, useRef, useCallback } from "react";
import { WSMessage } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

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
            
            // Invalidate relevant queries based on message type
            switch (message.type) {
              case "message":
                queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                if (message.data.message?.conversationId) {
                  queryClient.invalidateQueries({ 
                    queryKey: ["/api/conversations", message.data.message.conversationId, "messages"] 
                  });
                }
                break;
              case "status_update":
                if (message.data.conversation) {
                  queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                }
                if (message.data.agent) {
                  queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
                }
                break;
              case "escalation":
                queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                if (message.data.ticket) {
                  queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
                }
                break;
              case "assignment":
                queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
                queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
                // Invalidate agent query for the specific conversation
                if (message.data.conversationId) {
                  queryClient.invalidateQueries({ 
                    queryKey: ["/api/conversations", message.data.conversationId, "agent"] 
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
