import { Agent } from "@shared/schema";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AgentStatusIndicator } from "./agent-status-indicator";
import { User } from "lucide-react";

interface AgentAssignmentCardProps {
  agent: Agent;
}

export function AgentAssignmentCard({ agent }: AgentAssignmentCardProps) {
  return (
    <div className="border-l-4 border-agent bg-agent/5 p-4 rounded-lg" data-testid="card-agent-assignment">
      <div className="flex items-center gap-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={agent.avatar || undefined} />
          <AvatarFallback className="bg-agent text-agent-foreground">
            {agent.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-foreground" data-testid="text-agent-name">
              {agent.name}
            </h4>
            <AgentStatusIndicator status={agent.status} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground">{agent.email}</p>
        </div>
      </div>
    </div>
  );
}
