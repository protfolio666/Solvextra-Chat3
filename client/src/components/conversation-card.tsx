import { Conversation } from "@shared/schema";
import { ChannelBadge } from "./channel-badge";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

interface ConversationCardProps {
  conversation: Conversation;
  isActive?: boolean;
  onClick?: () => void;
  preview?: string;
  unread?: boolean;
}

export function ConversationCard({
  conversation,
  isActive = false,
  onClick,
  preview,
  unread = false,
}: ConversationCardProps) {
  const statusColors = {
    open: "bg-muted text-muted-foreground",
    assigned: "bg-agent/10 text-agent border-agent/20",
    resolved: "bg-success/10 text-success border-success/20",
    ticket: "bg-destructive/10 text-destructive border-destructive/20",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      whileHover={{ 
        scale: 1.01,
        backgroundColor: "rgba(var(--accent), 0.3)",
        transition: { duration: 0.2 }
      }}
      whileTap={{ scale: 0.99 }}
      className={`relative p-4 border-b border-border cursor-pointer transition-all ${
        isActive ? "bg-accent/50 shadow-sm" : ""
      }`}
      onClick={onClick}
      data-testid={`conversation-card-${conversation.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarImage src={conversation.customerAvatar || undefined} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {conversation.customerName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="absolute -bottom-0.5 -right-0.5">
            <ChannelBadge channel={conversation.channel} size="sm" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="text-sm font-medium text-foreground truncate" data-testid="text-customer-name">
              {conversation.customerName}
            </h3>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
            </span>
          </div>

          {preview && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
              {preview}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs ${statusColors[conversation.status]}`}>
              {conversation.status}
            </Badge>
            {unread && (
              <div className="w-2 h-2 bg-success rounded-full" data-testid="indicator-unread" />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
