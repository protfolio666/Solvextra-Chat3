export function TypingIndicator({ agentName }: { agentName: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 max-w-[70%]" data-testid="typing-indicator">
      <div className="bg-card border border-card-border rounded-2xl px-4 py-3 flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">{agentName} is typing</span>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:0ms]" />
          <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
