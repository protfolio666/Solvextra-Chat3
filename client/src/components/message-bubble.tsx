import { Message } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

interface MessageBubbleProps {
  message: Message;
  agentAvatar?: string;
}

export function MessageBubble({ message, agentAvatar }: MessageBubbleProps) {
  const isCustomer = message.sender === "customer";
  const isAI = message.sender === "ai";
  const isAgent = message.sender === "agent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.3,
        ease: [0.4, 0.0, 0.2, 1]
      }}
      className={`flex gap-3 px-4 py-2 ${isCustomer ? "justify-end" : "justify-start"}`}
      data-testid={`message-${message.sender}`}
    >
      {(isAI || isAgent) && (
        <Avatar className="w-8 h-8 mt-1">
          {isAI ? (
            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary" />
            </div>
          ) : (
            <>
              <AvatarImage src={agentAvatar} />
              <AvatarFallback className="bg-agent text-agent-foreground text-xs">
                {message.senderName?.slice(0, 2).toUpperCase() || "AG"}
              </AvatarFallback>
            </>
          )}
        </Avatar>
      )}

      <div className={`flex flex-col ${isCustomer ? "items-end" : "items-start"} max-w-[70%]`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isCustomer
              ? "bg-primary text-primary-foreground"
              : isAI
              ? "bg-card border border-l-4 border-primary text-card-foreground"
              : "bg-agent text-agent-foreground"
          }`}
        >
          {isAgent && message.senderName && (
            <p className="text-xs font-medium mb-1 opacity-75">
              {message.senderName}
            </p>
          )}
          <p className="text-sm whitespace-pre-wrap break-words" data-testid="text-message-content">
            {message.content}
          </p>
        </div>
        <span className="text-xs text-muted-foreground mt-1">
          {message.timestamp ? format(new Date(message.timestamp), "dd MMM yyyy, HH:mm") : "—"}
        </span>
      </div>

      {isCustomer && (
        <Avatar className="w-8 h-8 mt-1">
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <User className="w-4 h-4 text-muted-foreground" />
          </div>
        </Avatar>
      )}
    </motion.div>
  );
}
