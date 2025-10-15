import { Ticket } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle, CheckCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
  onResolve?: (ticketId: string) => void;
}

export function TicketCard({ ticket, onClick, onResolve }: TicketCardProps) {
  const priorityColors = {
    low: "bg-muted text-muted-foreground",
    medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
    high: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const statusColors = {
    open: "bg-primary/10 text-primary border-primary/20",
    in_progress: "bg-agent/10 text-agent border-agent/20",
    resolved: "bg-success/10 text-success border-success/20",
  };

  return (
    <Card className="cursor-pointer hover-elevate transition-all" onClick={onClick} data-testid={`ticket-card-${ticket.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-medium line-clamp-1" data-testid="text-ticket-title">
            {ticket.title}
          </CardTitle>
          <Badge variant="outline" className={`${priorityColors[ticket.priority as keyof typeof priorityColors] || priorityColors.medium}`}>
            {ticket.priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
        
        <div className="flex items-center justify-between">
          <Badge variant="outline" className={`${statusColors[ticket.status as keyof typeof statusColors] || statusColors.open}`}>
            {ticket.status}
          </Badge>
          
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>TAT: {ticket.tat}min</span>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Created {formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}
        </div>

        {ticket.status !== "resolved" && onResolve && (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onResolve(ticket.id);
            }}
            data-testid={`button-resolve-ticket-${ticket.id}`}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark as Resolved
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
