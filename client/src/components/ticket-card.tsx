import { Ticket } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertCircle, CheckCircle, Eye, Mail, FileText } from "lucide-react";
import { format } from "date-fns";

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
  onResolve?: (ticketId: string) => void;
  onViewAudit?: (ticketId: string) => void;
  onViewCreationDetails?: (ticketId: string) => void;
  onSendResolution?: (ticketId: string) => void;
  showResolveButton?: boolean; // Explicitly control resolve button visibility
}

export function TicketCard({ ticket, onClick, onResolve, onViewAudit, onViewCreationDetails, onSendResolution, showResolveButton = true }: TicketCardProps) {
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
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded" data-testid="text-ticket-number">
              {ticket.ticketNumber}
            </span>
            <Badge variant="outline" className={`${priorityColors[ticket.priority as keyof typeof priorityColors] || priorityColors.medium}`}>
              {ticket.priority}
            </Badge>
          </div>
        </div>
        <CardTitle className="text-base font-medium line-clamp-1" data-testid="text-ticket-title">
          {ticket.title}
        </CardTitle>
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
          Created {format(new Date(ticket.createdAt), "dd MMM yyyy, HH:mm")}
          {ticket.createdByName && (
            <span className="ml-2">• by {ticket.createdByName}</span>
          )}
        </div>

        <div className="flex gap-2">
          {onViewAudit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onViewAudit(ticket.id);
              }}
              data-testid={`button-view-audit-${ticket.id}`}
              title="View ticket history"
            >
              <Eye className="w-4 h-4" />
            </Button>
          )}

          {onViewCreationDetails && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onViewCreationDetails(ticket.id);
              }}
              data-testid={`button-view-creation-${ticket.id}`}
              title="View original ticket details"
            >
              <FileText className="w-4 h-4" />
            </Button>
          )}

          {ticket.customerEmail && onSendResolution && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onSendResolution(ticket.id);
              }}
              data-testid={`button-send-resolution-${ticket.id}`}
              title="Send resolution email"
              className="flex items-center gap-1"
            >
              <Mail className="w-4 h-4" />
              {ticket.resolutionSent && (
                <Badge variant="outline" className="ml-1 bg-success/10 text-success text-[10px] px-1 py-0">
                  Sent
                </Badge>
              )}
            </Button>
          )}
        </div>

        {ticket.status !== "resolved" && onResolve && showResolveButton && (
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
