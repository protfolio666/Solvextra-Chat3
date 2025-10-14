import { AgentStatus } from "@shared/schema";

interface AgentStatusIndicatorProps {
  status: AgentStatus;
  withLabel?: boolean;
  size?: "sm" | "md";
}

export function AgentStatusIndicator({ status, withLabel = false, size = "md" }: AgentStatusIndicatorProps) {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-2.5 h-2.5",
  };

  const statusConfig = {
    available: {
      color: "bg-success",
      label: "Available",
      animate: true,
    },
    busy: {
      color: "bg-yellow-500",
      label: "Busy",
      animate: false,
    },
    offline: {
      color: "bg-muted-foreground",
      label: "Offline",
      animate: false,
    },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5" data-testid={`status-${status}`}>
      <div className="relative">
        <div className={`${sizeClasses[size]} ${config.color} rounded-full`} />
        {config.animate && (
          <div className={`absolute inset-0 ${config.color} rounded-full animate-ping opacity-75`} />
        )}
      </div>
      {withLabel && (
        <span className="text-xs text-muted-foreground">{config.label}</span>
      )}
    </div>
  );
}
