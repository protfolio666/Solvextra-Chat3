import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Ticket } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Mail, Send } from "lucide-react";

const resolutionEmailSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

type ResolutionEmailForm = z.infer<typeof resolutionEmailSchema>;

interface SendResolutionDialogProps {
  ticket: Ticket | null;
  onClose: () => void;
}

export function SendResolutionDialog({ ticket, onClose }: SendResolutionDialogProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);

  const form = useForm<ResolutionEmailForm>({
    resolver: zodResolver(resolutionEmailSchema),
    defaultValues: {
      subject: ticket ? `Resolution for Ticket ${ticket.ticketNumber}` : "",
      message: "",
    },
  });

  useEffect(() => {
    if (ticket) {
      form.reset({
        subject: `Resolution for Ticket ${ticket.ticketNumber}`,
        message: "",
      });
    }
  }, [ticket, form]);

  const sendResolutionMutation = useMutation({
    mutationFn: async (data: ResolutionEmailForm) => {
      if (!ticket) throw new Error("No ticket selected");
      return apiRequest("POST", `/api/tickets/${ticket.id}/send-resolution`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Resolution sent",
        description: `Resolution email has been sent to ${ticket?.customerEmail}`,
      });
      onClose();
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send resolution email",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: ResolutionEmailForm) => {
    setIsSending(true);
    try {
      await sendResolutionMutation.mutateAsync(data);
    } finally {
      setIsSending(false);
    }
  };

  if (!ticket) return null;

  return (
    <Dialog open={!!ticket} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-send-resolution">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            <DialogTitle>Send Resolution Email</DialogTitle>
          </div>
          <DialogDescription>
            Send a resolution email to {ticket.customerEmail} for ticket {ticket.ticketNumber}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Enter email subject"
                      data-testid="input-resolution-subject"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Write your resolution message to the customer..."
                      rows={10}
                      className="font-mono text-sm resize-none"
                      data-testid="textarea-resolution-message"
                    />
                  </FormControl>
                  <FormMessage />
                  <div className="text-xs text-muted-foreground mt-1">
                    Your message will be sent to the customer with ticket details
                  </div>
                </FormItem>
              )}
            />

            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <div className="font-medium">Recipient</div>
              <div className="text-muted-foreground">{ticket.customerEmail}</div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSending}
                data-testid="button-cancel-resolution"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSending}
                data-testid="button-send-resolution"
              >
                <Send className="w-4 h-4 mr-2" />
                {isSending ? "Sending..." : "Send Email"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
