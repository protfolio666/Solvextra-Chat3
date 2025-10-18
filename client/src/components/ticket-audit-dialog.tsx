import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TicketAuditLog, EmailReply } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Edit, FileText, Mail, Image as ImageIcon, Paperclip } from "lucide-react";
import { format } from "date-fns";

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

  const { data: emailReplies = [] } = useQuery<EmailReply[]>({
    queryKey: [`/api/tickets/${ticketId}/email-replies`],
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
      case "email_reply_received":
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
      case "email_reply_received":
        return "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400";
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
                        {format(new Date(log.timestamp), "dd MMM yyyy, HH:mm")}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{log.performedByName || "System"}</span>
                    </div>

                    {log.action === "created" && changes && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-success">Ticket Created</div>
                        <div className="space-y-1 text-sm bg-muted/50 rounded p-3">
                          {changes.status && (
                            <div><span className="font-medium">Status:</span> {changes.status}</div>
                          )}
                          {changes.priority && (
                            <div><span className="font-medium">Priority:</span> {changes.priority}</div>
                          )}
                          {changes.tat && (
                            <div><span className="font-medium">TAT:</span> {changes.tat} minutes</div>
                          )}
                          {changes.customerEmail && (
                            <div><span className="font-medium">Customer Email:</span> {changes.customerEmail}</div>
                          )}
                          {changes.issue && (
                            <div><span className="font-medium">Issue Details:</span> {changes.issue}</div>
                          )}
                          {changes.notes && (
                            <div><span className="font-medium">Internal Notes:</span> {changes.notes}</div>
                          )}
                        </div>
                      </div>
                    )}

                    {log.action === "resolution_sent" && changes && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-success">Resolution Email Sent</div>
                        <div className="space-y-1 text-sm bg-success/5 border border-success/20 rounded p-3">
                          <div><span className="font-medium">Sent by:</span> {log.performedByName}</div>
                          <div><span className="font-medium">Subject:</span> {changes.subject || "Resolution details"}</div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Email delivered to customer successfully
                          </div>
                        </div>
                      </div>
                    )}

                    {log.action === "email_reply_received" && changes && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-400">Customer Email Reply</div>
                        <div className="space-y-2 text-sm bg-blue-500/5 border border-blue-500/20 rounded p-3">
                          <div><span className="font-medium">From:</span> {changes.from}</div>
                          <div><span className="font-medium">Subject:</span> {changes.subject || "(No subject)"}</div>
                          
                          {changes.hasAttachments && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-blue-700 dark:text-blue-400">
                              <Paperclip className="w-3 h-3" />
                              <span>{changes.attachmentCount} attachment{changes.attachmentCount > 1 ? 's' : ''} included</span>
                            </div>
                          )}

                          {/* Display actual attachments from email replies */}
                          {(() => {
                            const reply = emailReplies.find(r => r.id === changes.replyId);
                            if (reply?.attachments && reply.attachments.length > 0) {
                              return (
                                <div className="mt-3 space-y-2">
                                  <div className="text-xs font-medium">Attachments:</div>
                                  <div className="grid grid-cols-2 gap-2">
                                    {reply.attachments.map((attachment, idx) => (
                                      <div key={idx} className="border rounded overflow-hidden">
                                        <img 
                                          src={attachment} 
                                          alt={`Attachment ${idx + 1}`}
                                          className="w-full h-32 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                          onClick={() => window.open(attachment, '_blank')}
                                          data-testid={`img-attachment-${idx}`}
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      </div>
                    )}

                    {changes && Object.keys(changes).length > 0 && log.action !== "created" && log.action !== "resolution_sent" && log.action !== "email_reply_received" && (
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
