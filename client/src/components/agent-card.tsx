import { Agent } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AgentStatusIndicator } from "./agent-status-indicator";
import { Badge } from "@/components/ui/badge";

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
}

export function AgentCard({ agent, onClick }: AgentCardProps) {
  return (
    <Card className="cursor-pointer hover-elevate transition-all" onClick={onClick} data-testid={`agent-card-${agent.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-12 h-12">
              <AvatarImage src={agent.avatar || undefined} />
              <AvatarFallback className="bg-agent text-agent-foreground">
                {agent.name.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1">
              <AgentStatusIndicator status={agent.status} size="md" />
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm truncate" data-testid="text-agent-name">{agent.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {agent.activeConversations} active
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
