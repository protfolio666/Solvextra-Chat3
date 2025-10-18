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
      color: "bg-green-500",
      label: "Available",
      animate: true,
    },
    break: {
      color: "bg-yellow-500",
      label: "On Break",
      animate: false,
    },
    training: {
      color: "bg-blue-500",
      label: "In Training",
      animate: false,
    },
    floor_support: {
      color: "bg-purple-500",
      label: "Floor Support",
      animate: false,
    },
    not_available: {
      color: "bg-gray-500",
      label: "Not Available",
      animate: false,
    },
  };

  const config = statusConfig[status] || statusConfig.not_available; // Fallback to not_available if status is invalid

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
