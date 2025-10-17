import { motion } from "framer-motion";

export function ConversationSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 border-b border-border"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-muted rounded-full animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-4 bg-muted rounded w-32 animate-pulse" />
            <div className="h-3 bg-muted rounded w-16 animate-pulse" />
          </div>
          <div className="h-3 bg-muted rounded w-full animate-pulse" />
          <div className="h-5 bg-muted rounded w-20 animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}
