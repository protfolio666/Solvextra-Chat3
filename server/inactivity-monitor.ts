import { IStorage } from "./storage";

interface InactivityMonitorConfig {
  storage: IStorage;
  broadcast: (message: any) => void;
}

// Track active inactivity checks to prevent duplicate processing
const activeChecks = new Set<string>();

export function startInactivityMonitor(config: InactivityMonitorConfig) {
  const { storage, broadcast } = config;
  
  // Check for inactive conversations every minute
  const checkInterval = setInterval(async () => {
    try {
      const conversations = await storage.getConversations();
      const now = new Date();
      
      for (const conversation of conversations) {
        // Only check open conversations with AI (not assigned to agents)
        if (conversation.status !== "open") continue;
        if (!conversation.lastCustomerMessageAt) continue;
        if (activeChecks.has(conversation.id)) continue;
        
        const timeSinceLastMessage = now.getTime() - new Date(conversation.lastCustomerMessageAt).getTime();
        const minutesInactive = Math.floor(timeSinceLastMessage / 60000);
        
        // Check if customer has been inactive for 10+ minutes
        if (minutesInactive >= 10) {
          const checkCount = conversation.inactivityCheckCount || 0;
          
          if (checkCount < 3) {
            // Send "Are we on chat?" message
            activeChecks.add(conversation.id);
            
            console.log(`⏰ Inactivity detected for conversation ${conversation.id} - sending check message (${checkCount + 1}/3)`);
            
            const checkMessage = await storage.createMessage({
              conversationId: conversation.id,
              sender: "ai",
              senderName: "Support Team",
              content: "Are we on chat?",
            });
            
            // Update check count
            await storage.updateConversation(conversation.id, {
              inactivityCheckCount: checkCount + 1,
            });
            
            broadcast({ type: "message", data: { message: checkMessage } });
            
            // Send to customer on their channel
            await sendToCustomerChannel(conversation, checkMessage.content, storage);
            
            // Schedule to check again in 30 seconds
            setTimeout(async () => {
              activeChecks.delete(conversation.id);
              
              // Check if customer responded
              const updatedConv = await storage.getConversation(conversation.id);
              if (!updatedConv) return;
              
              const timeSinceCheck = now.getTime() - new Date(updatedConv.lastCustomerMessageAt || now).getTime();
              const checkCountNow = updatedConv.inactivityCheckCount || 0;
              
              // If customer still hasn't responded and we've sent 3 checks, close the chat
              if (checkCountNow >= 3 && timeSinceCheck >= 600000) {
                console.log(`🔒 Auto-closing conversation ${conversation.id} due to inactivity (no response after 3 checks)`);
                
                const closeMessage = await storage.createMessage({
                  conversationId: conversation.id,
                  sender: "ai",
                  senderName: "Support Team",
                  content: "As per no response in chat I am closing the case. If you face any other issue please connect again.",
                });
                
                broadcast({ type: "message", data: { message: closeMessage } });
                
                // Send to customer
                await sendToCustomerChannel(conversation, closeMessage.content, storage);
                
                // Close conversation without CSAT
                await storage.updateConversation(conversation.id, {
                  status: "resolved",
                });
                
                broadcast({
                  type: "status_update",
                  data: {
                    conversationId: conversation.id,
                    status: "resolved",
                  },
                });
              }
            }, 30000); // 30 seconds
          }
        }
      }
    } catch (error) {
      console.error("Inactivity monitor error:", error);
    }
  }, 60000); // Check every minute
  
  console.log("✅ Inactivity monitor started");
  
  return () => {
    clearInterval(checkInterval);
    console.log("🛑 Inactivity monitor stopped");
  };
}

// Helper function to send message to customer on their channel
async function sendToCustomerChannel(conversation: any, message: string, storage: IStorage) {
  if (conversation.channel === "telegram" && conversation.channelUserId) {
    const telegramIntegration = await storage.getChannelIntegration("telegram");
    if (telegramIntegration?.apiToken) {
      try {
        const sendMessageUrl = `https://api.telegram.org/bot${telegramIntegration.apiToken}/sendMessage`;
        await fetch(sendMessageUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: conversation.channelUserId,
            text: message,
          }),
        });
        console.log(`✅ Inactivity message sent to ${conversation.channel} customer`);
      } catch (error) {
        console.error(`❌ Failed to send inactivity message to ${conversation.channel}:`, error);
      }
    }
  }
  // Add support for other channels (WhatsApp, Instagram, etc.) as needed
}
