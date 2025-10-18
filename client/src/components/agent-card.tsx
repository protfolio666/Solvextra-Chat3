import { Agent, AgentStatus } from "@shared/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AgentStatusIndicator } from "./agent-status-indicator";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Circle, KeyRound } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
  showStatusControl?: boolean; // For admin to change status
}

const statusConfig: Record<AgentStatus, { label: string; color: string }> = {
  available: { label: "Available", color: "text-green-600 dark:text-green-400" },
  break: { label: "On Break", color: "text-yellow-600 dark:text-yellow-400" },
  training: { label: "In Training", color: "text-blue-600 dark:text-blue-400" },
  floor_support: { label: "Floor Support", color: "text-purple-600 dark:text-purple-400" },
  not_available: { label: "Not Available", color: "text-gray-600 dark:text-gray-400" },
};

export function AgentCard({ agent, onClick, showStatusControl = false }: AgentCardProps) {
  const { toast } = useToast();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const updateStatusMutation = useMutation({
    mutationFn: async (status: AgentStatus) => {
      return apiRequest("PATCH", `/api/agents/${agent.id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      toast({
        title: "Status Updated",
        description: `${agent.name}'s status has been updated`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      return apiRequest("PATCH", `/api/agents/${agent.id}/reset-password`, { newPassword: password });
    },
    onSuccess: () => {
      setPasswordDialogOpen(false);
      setNewPassword("");
      toast({
        title: "Password Reset",
        description: `Password for ${agent.name} has been reset successfully`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to reset password",
        variant: "destructive",
      });
    },
  });

  const handlePasswordReset = () => {
    if (!newPassword) {
      toast({
        title: "Error",
        description: "Please enter a new password",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    resetPasswordMutation.mutate(newPassword);
  };

  return (
    <Card className="hover-elevate transition-all" data-testid={`agent-card-${agent.id}`}>
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

        {/* Admin Status Control */}
        {showStatusControl && (
          <div className="mt-3 pt-3 border-t border-border space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Agent Status</label>
              <Select
                value={agent.status}
                onValueChange={(value) => updateStatusMutation.mutate(value as AgentStatus)}
                disabled={updateStatusMutation.isPending}
              >
                <SelectTrigger className="w-full h-8 text-xs" data-testid={`select-agent-status-${agent.id}`}>
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <Circle className={`w-2 h-2 fill-current ${statusConfig[agent.status].color}`} />
                      <span>{statusConfig[agent.status].label}</span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusConfig).map(([value, config]) => (
                    <SelectItem key={value} value={value} data-testid={`status-option-${value}-${agent.id}`}>
                      <div className="flex items-center gap-2">
                        <Circle className={`w-2 h-2 fill-current ${config.color}`} />
                        <span>{config.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset Password Button */}
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs"
                  data-testid={`button-reset-password-${agent.id}`}
                >
                  <KeyRound className="w-3 h-3 mr-1.5" />
                  Reset Password
                </Button>
              </DialogTrigger>
              <DialogContent data-testid={`dialog-reset-password-${agent.id}`}>
                <DialogHeader>
                  <DialogTitle>Reset Password for {agent.name}</DialogTitle>
                  <DialogDescription>
                    Enter a new password for this agent. They will use this password to log in.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor={`password-${agent.id}`}>New Password</Label>
                    <Input
                      id={`password-${agent.id}`}
                      type="password"
                      placeholder="Minimum 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      data-testid={`input-new-password-${agent.id}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Password must be at least 6 characters long
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setPasswordDialogOpen(false)}
                    data-testid={`button-cancel-reset-${agent.id}`}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePasswordReset}
                    disabled={resetPasswordMutation.isPending}
                    data-testid={`button-confirm-reset-${agent.id}`}
                  >
                    {resetPasswordMutation.isPending ? "Resetting..." : "Reset Password"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
