import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EscalationBannerProps {
  onEscalate: () => void;
  isEscalating?: boolean;
}

export function EscalationBanner({ onEscalate, isEscalating }: EscalationBannerProps) {
  return (
    <div className="bg-destructive text-destructive-foreground p-3 flex items-center justify-between gap-4 shadow-lg">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-5 h-5" />
        <div>
          <p className="text-sm font-medium">Customer needs human assistance</p>
          <p className="text-xs opacity-90">AI couldn't resolve this conversation</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onEscalate}
        disabled={isEscalating}
        className="bg-white text-destructive hover:bg-white/90 border-white/20"
        data-testid="button-escalate"
      >
        {isEscalating ? "Escalating..." : "Escalate to Agent"}
      </Button>
    </div>
  );
}
