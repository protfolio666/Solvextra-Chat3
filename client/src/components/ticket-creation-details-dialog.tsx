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
import { FileText, User, Clock } from "lucide-react";
import { format } from "date-fns";

interface TicketCreationDetailsDialogProps {
  ticketId: string | null;
  ticketNumber?: string;
  onClose: () => void;
}

export function TicketCreationDetailsDialog({ ticketId, ticketNumber, onClose }: TicketCreationDetailsDialogProps) {
  const { data: auditLog = [], isLoading } = useQuery<TicketAuditLog[]>({
    queryKey: [`/api/tickets/${ticketId}/audit`],
    enabled: !!ticketId,
  });

  // Find the creation log entry
  const creationLog = auditLog.find(log => log.action === "created");
  
  const parseChanges = (changesStr: string | null | undefined) => {
    if (!changesStr) return null;
    try {
      const parsed = JSON.parse(changesStr);
      console.log("Parsed creation changes:", parsed);
      return parsed;
    } catch (error) {
      console.error("Failed to parse changes:", error);
      return null;
    }
  };

  const changes = creationLog?.changes ? parseChanges(creationLog.changes) : null;

  return (
    <Dialog open={!!ticketId} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-ticket-creation-details">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Original Ticket Details
          </DialogTitle>
          <DialogDescription>
            View the initial information provided when ticket {ticketNumber} was created
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading details...</div>
          ) : !creationLog || !changes ? (
            <div className="text-center py-8 text-muted-foreground">No creation details available</div>
          ) : (
            <div className="space-y-4">
              {/* Creator and Time */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-primary" />
                  <span className="font-medium">Created by:</span>
                  <span className="text-muted-foreground">{creationLog.performedByName || "System"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-primary" />
                  <span className="font-medium">Created:</span>
                  <span className="text-muted-foreground">
                    {format(new Date(creationLog.timestamp), "dd MMM yyyy, HH:mm")}
                  </span>
                </div>
              </div>

              {/* Ticket Details */}
              <div className="bg-card border rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Ticket Information
                </h3>
                
                <div className="grid grid-cols-2 gap-3">
                  {changes.status && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Status</div>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                        {String(changes.status)}
                      </Badge>
                    </div>
                  )}

                  {changes.priority && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">Priority</div>
                      <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400">
                        {String(changes.priority)}
                      </Badge>
                    </div>
                  )}

                  {changes.tat && (
                    <div>
                      <div className="text-xs font-medium text-muted-foreground mb-1">TAT (Turn Around Time)</div>
                      <div className="text-sm font-medium">{String(changes.tat)} minutes</div>
                    </div>
                  )}

                  {changes.customerEmail && (
                    <div className="col-span-2">
                      <div className="text-xs font-medium text-muted-foreground mb-1">Customer Email</div>
                      <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                        {String(changes.customerEmail)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Issue Details */}
              {changes.issue && changes.issue !== "Not provided" && (
                <div className="bg-card border rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                    Issue Details
                  </h3>
                  <div className="text-sm bg-muted/50 rounded p-3 whitespace-pre-wrap">
                    {String(changes.issue)}
                  </div>
                </div>
              )}

              {/* Internal Notes */}
              {changes.notes && changes.notes !== "Not provided" && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 space-y-2">
                  <h3 className="font-semibold text-sm text-amber-700 dark:text-amber-400 uppercase tracking-wide">
                    Internal Notes (Agent Only)
                  </h3>
                  <div className="text-sm bg-amber-500/5 rounded p-3 whitespace-pre-wrap">
                    {String(changes.notes)}
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground italic text-center pt-2 border-t">
                This information was captured when the ticket was originally created and cannot be modified.
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
