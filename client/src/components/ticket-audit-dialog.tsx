import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TicketAuditLog } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Edit, FileText, Mail } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TicketAuditDialogProps {
  ticketId: string | null;
  ticketNumber?: string;
  onClose: () => void;
}

export function TicketAuditDialog({ ticketId, ticketNumber, onClose }: TicketAuditDialogProps) {
  const { data: auditLog = [], isLoading } = useQuery<TicketAuditLog[]>({
    queryKey: [`/api/tickets/${ticketId}/audit`],
    enabled: !!ticketId,
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case "created":
        return <FileText className="w-4 h-4" />;
      case "updated":
        return <Edit className="w-4 h-4" />;
      case "status_changed":
        return <Edit className="w-4 h-4" />;
      case "resolution_sent":
        return <Mail className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "created":
        return "bg-primary/10 text-primary border-primary/20";
      case "updated":
        return "bg-agent/10 text-agent border-agent/20";
      case "status_changed":
        return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
      case "resolution_sent":
        return "bg-success/10 text-success border-success/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const parseChanges = (changesStr: string) => {
    try {
      return JSON.parse(changesStr);
    } catch {
      return null;
    }
  };

  return (
    <Dialog open={!!ticketId} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-ticket-audit">
        <DialogHeader>
          <DialogTitle>Ticket History</DialogTitle>
          <DialogDescription>
            View all changes and actions for ticket {ticketNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading history...</div>
          ) : auditLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No history available</div>
          ) : (
            <div className="space-y-4">
              {auditLog.map((log) => {
                const changes = parseChanges(log.changes || "{}");
                
                return (
                  <div
                    key={log.id}
                    className="border rounded-lg p-4 space-y-3 bg-card"
                    data-testid={`audit-log-${log.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`${getActionColor(log.action)}`}>
                          <span className="flex items-center gap-1">
                            {getActionIcon(log.action)}
                            {log.action.replace(/_/g, " ")}
                          </span>
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{log.performedByName || "System"}</span>
                    </div>

                    {log.action === "created" && (
                      <div className="text-sm text-muted-foreground">
                        Ticket was created
                      </div>
                    )}

                    {log.action === "resolution_sent" && (
                      <div className="text-sm text-success">
                        Resolution email sent to customer
                      </div>
                    )}

                    {changes && Object.keys(changes).length > 0 && log.action !== "created" && log.action !== "resolution_sent" && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Changes:</div>
                        <div className="space-y-1">
                          {Object.entries(changes).map(([field, change]: [string, any]) => (
                            <div key={field} className="text-sm bg-muted/50 rounded p-2">
                              <div className="font-medium capitalize">{field.replace(/([A-Z])/g, " $1")}</div>
                              <div className="flex items-center gap-2 mt-1 text-xs">
                                <span className="text-destructive line-through">{String(change.old || "—")}</span>
                                <span>→</span>
                                <span className="text-success">{String(change.new || "—")}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
