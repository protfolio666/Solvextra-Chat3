interface TypingIndicatorProps {
  sender: "customer" | "agent" | "ai";
  senderName: string;
}

export function TypingIndicator({ sender, senderName }: TypingIndicatorProps) {
  const isCustomer = sender === "customer";
  const isAI = sender === "ai";
  
  return (
    <div 
      className={`flex items-center gap-2 px-4 py-2 max-w-[70%] animate-in fade-in slide-in-from-bottom-2 duration-200 ${
        isCustomer ? "" : "ml-auto"
      }`} 
      data-testid="typing-indicator"
    >
      <div 
        className={`rounded-2xl px-4 py-2.5 flex items-center gap-2 ${
          isCustomer
            ? "bg-muted text-foreground"
            : isAI
            ? "bg-blue-100 dark:bg-blue-950 text-blue-900 dark:text-blue-100"
            : "bg-primary text-primary-foreground"
        }`}
      >
        <span className="text-sm">{senderName} is typing</span>
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
          <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
          <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
