import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Filter, Search, Star } from "lucide-react";
import { format } from "date-fns";
import { SiTelegram, SiWhatsapp, SiInstagram } from "react-icons/si";
import { FaXTwitter, FaGlobe } from "react-icons/fa6";

interface ExportData {
  conversationId: string;
  channel: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  status: string;
  createdAt: Date;
  lastMessageAt: Date;
  agentId: string | null;
  agentName: string | null;
  agentEmail: string | null;
  ticketId: string | null;
  ticketNumber: string | null;
  ticketStatus: string | null;
  ticketPriority: string | null;
  ticketCreatedAt: Date | null;
  ticketResolvedAt: Date | null;
  csatRating: number | null;
  csatFeedback: string | null;
  csatCreatedAt: Date | null;
  totalMessages: number;
  customerMessages: number;
  aiMessages: number;
  agentMessages: number;
  messageTranscript: string;
}

export default function ExportPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: exportData = [], isLoading } = useQuery<ExportData[]>({
    queryKey: ["/api/export/conversations"],
  });

  const filteredData = exportData.filter((row) => {
    const matchesSearch =
      (row.customerName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.customerEmail || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (row.ticketNumber || "").toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesChannel = channelFilter === "all" || row.channel === channelFilter;
    const matchesStatus = statusFilter === "all" || row.status === statusFilter;

    return matchesSearch && matchesChannel && matchesStatus;
  });

  const getChannelIcon = (channel: string) => {
    const icons: { [key: string]: JSX.Element } = {
      telegram: <SiTelegram className="w-4 h-4" />,
      whatsapp: <SiWhatsapp className="w-4 h-4" />,
      instagram: <SiInstagram className="w-4 h-4" />,
      twitter: <FaXTwitter className="w-4 h-4" />,
      website: <FaGlobe className="w-4 h-4" />,
    };
    return icons[channel] || <FaGlobe className="w-4 h-4" />;
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      open: "bg-blue-500/10 text-blue-500 border-blue-500/20",
      assigned: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
      resolved: "bg-green-500/10 text-green-500 border-green-500/20",
      ticket: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    };
    return colors[status] || "bg-muted text-muted-foreground";
  };

  const exportToCSV = () => {
    const headers = [
      "Conversation ID",
      "Channel",
      "Customer Name",
      "Customer Email",
      "Customer Phone",
      "Status",
      "Created At",
      "Last Message At",
      "Total Messages",
      "Customer Messages",
      "AI Messages",
      "Agent Messages",
      "Agent Name",
      "Agent Email",
      "Ticket Number",
      "Ticket Status",
      "Ticket Priority",
      "Ticket Created",
      "Ticket Resolved",
      "Escalated",
      "CSAT Rating",
      "CSAT Feedback",
      "Full Conversation",
    ];

    const csvRows = filteredData.map((row) => [
      row.conversationId,
      row.channel,
      row.customerName || "",
      row.customerEmail || "",
      row.customerPhone || "",
      row.status,
      format(new Date(row.createdAt), "yyyy-MM-dd HH:mm:ss"),
      format(new Date(row.lastMessageAt), "yyyy-MM-dd HH:mm:ss"),
      row.totalMessages?.toString() || "0",
      row.customerMessages?.toString() || "0",
      row.aiMessages?.toString() || "0",
      row.agentMessages?.toString() || "0",
      row.agentName || "",
      row.agentEmail || "",
      row.ticketNumber || "",
      row.ticketStatus || "",
      row.ticketPriority || "",
      row.ticketCreatedAt ? format(new Date(row.ticketCreatedAt), "yyyy-MM-dd HH:mm:ss") : "",
      row.ticketResolvedAt ? format(new Date(row.ticketResolvedAt), "yyyy-MM-dd HH:mm:ss") : "",
      row.ticketId ? "Yes" : "No",
      row.csatRating?.toString() || "",
      row.csatFeedback || "",
      row.messageTranscript || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...csvRows.map((row) =>
        row.map((cell) => `"${cell.toString().replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `conversations_export_${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Export Conversations</h1>
          <p className="text-muted-foreground mt-2">
            View and export comprehensive conversation data with filters
          </p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Conversation Data</CardTitle>
                <CardDescription>
                  Filter and export conversation history with all details
                </CardDescription>
              </div>
              <Button onClick={exportToCSV} data-testid="button-export-csv">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex gap-4 items-end flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label className="text-sm font-medium mb-2 block">Search</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search customer, email, ticket..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-search"
                    />
                  </div>
                </div>
                <div className="w-[180px]">
                  <label className="text-sm font-medium mb-2 block">Channel</label>
                  <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger data-testid="select-channel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="telegram">Telegram</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="twitter">Twitter</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-[180px]">
                  <label className="text-sm font-medium mb-2 block">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger data-testid="select-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="assigned">Assigned</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="ticket">Ticket</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Results Count */}
              <div className="text-sm text-muted-foreground">
                Showing {filteredData.length} of {exportData.length} conversations
              </div>

              {/* Table */}
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Channel</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Messages</TableHead>
                        <TableHead>Agent</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Resolved</TableHead>
                        <TableHead>Escalated</TableHead>
                        <TableHead>Ticket</TableHead>
                        <TableHead>CSAT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8">
                            Loading...
                          </TableCell>
                        </TableRow>
                      ) : filteredData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            No conversations found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredData.map((row) => (
                          <TableRow key={row.conversationId} data-testid={`row-conversation-${row.conversationId}`}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getChannelIcon(row.channel)}
                                <span className="capitalize">{row.channel}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{row.customerName || "Unknown"}</div>
                                {row.customerEmail && (
                                  <div className="text-xs text-muted-foreground">{row.customerEmail}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusColor(row.status)}>
                                {row.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div className="font-medium">{row.totalMessages || 0} total</div>
                                <div className="text-xs text-muted-foreground">
                                  {row.customerMessages || 0}👤 {row.aiMessages || 0}🤖 {row.agentMessages || 0}👨‍💼
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {row.agentName || <span className="text-muted-foreground">-</span>}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                {format(new Date(row.createdAt), "MMM d, yyyy")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(row.createdAt), "HH:mm")}
                              </div>
                            </TableCell>
                            <TableCell>
                              {row.ticketResolvedAt ? (
                                <div className="text-sm">
                                  {format(new Date(row.ticketResolvedAt), "MMM d, yyyy")}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.ticketId ? (
                                <Badge variant="outline" className="bg-purple-500/10 text-purple-500">
                                  Yes
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">No</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.ticketNumber ? (
                                <code className="text-xs bg-muted px-2 py-1 rounded">{row.ticketNumber}</code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.csatRating ? (
                                <div className="flex items-center gap-1">
                                  <Star className={`w-4 h-4 ${row.csatRating >= 4 ? "fill-yellow-400 text-yellow-400" : row.csatRating >= 3 ? "fill-orange-400 text-orange-400" : "fill-red-400 text-red-400"}`} />
                                  <span className="text-sm font-medium">{row.csatRating}/5</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
