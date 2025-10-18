import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Ticket, Conversation, insertTicketSchema } from "@shared/schema";
import { TicketCard } from "@/components/ticket-card";
import { TicketAuditDialog } from "@/components/ticket-audit-dialog";
import { TicketCreationDetailsDialog } from "@/components/ticket-creation-details-dialog";
import { SendResolutionDialog } from "@/components/send-resolution-dialog";
import { Button } from "@/components/ui/button";
import { Plus, Search, Filter, Minimize2, Maximize2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const createTicketSchema = insertTicketSchema.extend({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  issue: z.string().optional(),
  notes: z.string().optional(),
  customerEmail: z.string().optional(),
});

type CreateTicketForm = z.infer<typeof createTicketSchema>;

const updateTicketSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  tat: z.number().optional(),
  issue: z.string().optional(),
  notes: z.string().optional(),
  customerEmail: z.string().optional(),
});

type UpdateTicketForm = z.infer<typeof updateTicketSchema>;

export default function Tickets() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [auditTicketId, setAuditTicketId] = useState<string | null>(null);
  const [creationDetailsTicketId, setCreationDetailsTicketId] = useState<string | null>(null);
  const [resolutionTicket, setResolutionTicket] = useState<Ticket | null>(null);
  const { toast } = useToast();

  const { data: tickets = [] } = useQuery<Ticket[]>({
    queryKey: ["/api/tickets"],
  });

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const form = useForm<CreateTicketForm>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      conversationId: "",
      title: "",
      description: "",
      issue: "",
      notes: "",
      customerEmail: "",
      priority: "medium",
      status: "open",
      tat: 60,
    },
  });

  const editForm = useForm<UpdateTicketForm>({
    resolver: zodResolver(updateTicketSchema),
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: CreateTicketForm) => {
      return apiRequest("POST", "/api/tickets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Ticket created",
        description: "New ticket has been created successfully",
      });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create ticket",
        variant: "destructive",
      });
    },
  });

  const resolveTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      return apiRequest("POST", `/api/tickets/${ticketId}/resolve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Ticket resolved",
        description: "Ticket has been marked as resolved and CSAT request sent to customer",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to resolve ticket",
        variant: "destructive",
      });
    },
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateTicketForm }) => {
      return apiRequest("PATCH", `/api/tickets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      toast({
        title: "Ticket updated",
        description: "Ticket has been updated successfully",
      });
      handleCloseEdit();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update ticket",
        variant: "destructive",
      });
    },
  });

  const handleResolveTicket = (ticketId: string) => {
    resolveTicketMutation.mutate(ticketId);
  };

  const handleViewAudit = (ticketId: string) => {
    setAuditTicketId(ticketId);
  };

  const handleViewCreationDetails = (ticketId: string) => {
    setCreationDetailsTicketId(ticketId);
  };

  const handleSendResolution = (ticketId: string) => {
    const ticket = tickets.find(t => t.id === ticketId);
    if (ticket) {
      setResolutionTicket(ticket);
    }
  };

  const handleEditTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    editForm.reset({
      status: ticket.status as "open" | "in_progress" | "resolved",
      priority: ticket.priority as "low" | "medium" | "high",
      tat: ticket.tat,
      issue: ticket.issue || "",
      notes: ticket.notes || "",
      customerEmail: ticket.customerEmail || "",
    });
    setIsEditDialogOpen(true);
    setIsMinimized(false);
  };

  const handleMinimize = () => {
    setIsMinimized(true);
  };

  const handleRestore = () => {
    setIsMinimized(false);
  };

  const handleCloseEdit = () => {
    setIsEditDialogOpen(false);
    setIsMinimized(false);
    setSelectedTicket(null);
    editForm.reset();
  };

  const onUpdateSubmit = (data: UpdateTicketForm) => {
    if (selectedTicket) {
      updateTicketMutation.mutate({ id: selectedTicket.id, data });
    }
  };

  const onSubmit = (data: CreateTicketForm) => {
    createTicketMutation.mutate(data);
  };

  const filteredTickets = tickets
    .filter((ticket) => {
      const matchesSearch =
        ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ticket.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesTab = activeTab === "all" || ticket.status === activeTab;
      
      return matchesSearch && matchesTab;
    });

  const getTabCount = (status: string) => {
    if (status === "all") return tickets.length;
    return tickets.filter(t => t.status === status).length;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="border-b border-border p-6 bg-background">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Tickets</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track and manage support tickets
            </p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-ticket">
                <Plus className="w-4 h-4 mr-2" />
                Create Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Ticket</DialogTitle>
                <DialogDescription>
                  Create a support ticket to track customer issues
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="conversationId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conversation</FormLabel>
                        <Select onValueChange={(value) => {
                          field.onChange(value);
                          const selectedConv = conversations.find(c => c.id === value);
                          if (selectedConv?.customerEmail) {
                            form.setValue('customerEmail', selectedConv.customerEmail);
                          } else {
                            form.setValue('customerEmail', '');
                          }
                        }} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-conversation">
                              <SelectValue placeholder="Select a conversation" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {conversations.map((conv) => (
                              <SelectItem key={conv.id} value={conv.id}>
                                {conv.customerName} - {conv.channel}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Ticket title" {...field} data-testid="input-ticket-title" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Describe the issue..."
                            {...field}
                            data-testid="textarea-ticket-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="issue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issue Details (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Detailed issue description for customer email..."
                            {...field}
                            data-testid="textarea-ticket-issue"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Notes (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Internal notes for agents..."
                            {...field}
                            data-testid="textarea-ticket-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Enter customer email or select conversation" 
                            {...field} 
                            data-testid="input-customer-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-priority">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TAT (Turn Around Time in minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="60"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                            data-testid="input-tat"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={createTicketMutation.isPending}
                      data-testid="button-submit-ticket"
                    >
                      {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isEditDialogOpen && !isMinimized} onOpenChange={(open) => {
            if (!open) handleCloseEdit();
          }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <div>
                    <DialogTitle>Edit Ticket</DialogTitle>
                    <DialogDescription>
                      Update ticket details and status
                    </DialogDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleMinimize}
                    data-testid="button-minimize-ticket"
                  >
                    <Minimize2 className="w-4 h-4" />
                  </Button>
                </div>
              </DialogHeader>
              {selectedTicket && (
                <div className="mb-4 p-3 bg-muted rounded-md">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-muted-foreground bg-background px-2 py-0.5 rounded">
                      {selectedTicket.ticketNumber}
                    </span>
                  </div>
                  <p className="text-sm font-medium">{selectedTicket.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedTicket.description}</p>
                </div>
              )}
              <Form {...editForm}>
                <form onSubmit={editForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
                  <FormField
                    control={editForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-status">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="open">Open</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="resolved">Resolved</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-edit-priority">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="tat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TAT (Turn Around Time in minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="60"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                            data-testid="input-edit-tat"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="customerEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Email</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Customer email" 
                            {...field} 
                            data-testid="input-edit-customer-email"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="issue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Issue Details</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Detailed issue description for customer email..."
                            {...field}
                            data-testid="input-edit-issue"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={editForm.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Internal Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Internal notes for agents..."
                            {...field}
                            data-testid="input-edit-notes"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button
                      type="submit"
                      disabled={updateTicketMutation.isPending}
                      data-testid="button-update-ticket"
                    >
                      {updateTicketMutation.isPending ? "Updating..." : "Update Ticket"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="pl-9"
              data-testid="input-search-tickets"
            />
          </div>
          <Button variant="outline" size="icon">
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">
              All Tickets ({getTabCount("all")})
            </TabsTrigger>
            <TabsTrigger value="open" data-testid="tab-open">
              Open ({getTabCount("open")})
            </TabsTrigger>
            <TabsTrigger value="in_progress" data-testid="tab-in-progress">
              In Progress ({getTabCount("in_progress")})
            </TabsTrigger>
            <TabsTrigger value="resolved" data-testid="tab-resolved">
              Resolved ({getTabCount("resolved")})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {filteredTickets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No tickets found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredTickets.map((ticket) => (
              <TicketCard 
                key={ticket.id} 
                ticket={ticket} 
                onClick={() => handleEditTicket(ticket)}
                onResolve={handleResolveTicket}
                onViewAudit={handleViewAudit}
                onViewCreationDetails={handleViewCreationDetails}
                onSendResolution={handleSendResolution}
              />
            ))}
          </div>
        )}
      </div>

      {isMinimized && selectedTicket && (
        <div className="fixed bottom-6 right-6 z-50">
          <Button
            variant="default"
            className="shadow-lg hover-elevate flex items-center gap-2 px-4 py-6"
            onClick={handleRestore}
            data-testid="button-restore-ticket"
          >
            <span className="font-mono text-xs">{selectedTicket.ticketNumber}</span>
            <span className="font-medium">{selectedTicket.title}</span>
            <Maximize2 className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}

      <TicketAuditDialog
        ticketId={auditTicketId}
        ticketNumber={tickets.find(t => t.id === auditTicketId)?.ticketNumber}
        onClose={() => setAuditTicketId(null)}
      />

      <TicketCreationDetailsDialog
        ticketId={creationDetailsTicketId}
        ticketNumber={tickets.find(t => t.id === creationDetailsTicketId)?.ticketNumber}
        onClose={() => setCreationDetailsTicketId(null)}
      />

      <SendResolutionDialog
        ticket={resolutionTicket}
        onClose={() => setResolutionTicket(null)}
      />
    </div>
  );
}
