import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { generateAIResponse } from "./ai-providers";
import { setupAuth } from "./auth";
import { requireAdmin } from "./middleware/role-check";
import { sendEmail, generateTicketResolutionEmail, generateTicketCreationEmail, generateTicketReopenEmail } from "./email-service";
import { startInactivityMonitor } from "./inactivity-monitor";
import {
  insertConversationSchema,
  insertMessageSchema,
  insertAgentSchema,
  insertTicketSchema,
  insertAISettingsSchema,
  insertKnowledgeFileSchema,
  insertChannelIntegrationSchema,
  insertCsatRatingSchema,
  insertEmailSettingsSchema,
  Channel,
  AgentStatus,
  WSMessage,
  Conversation,
  Message,
  User,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Health check endpoint for deployment monitoring (Railway, etc.)
  app.get("/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || "development",
    });
  });

  // Setup authentication
  setupAuth(app);

  // WebSocket server for real-time messaging
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store active WebSocket connections
  const clients = new Map<string, WebSocket>();

  // Ping interval to keep connections alive
  const pingInterval = setInterval(() => {
    clients.forEach((ws, clientId) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clients.delete(clientId);
      }
    });
  }, 30000); // Ping every 30 seconds

  wss.on('connection', (ws: WebSocket) => {
    const clientId = Math.random().toString(36).substring(7);
    clients.set(clientId, ws);

    // Handle pong responses
    ws.on('pong', () => {
      // Connection is alive
    });

    ws.on('message', async (data: string) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        
        // Broadcast to all connected clients
        clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
          }
        });
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      clients.delete(clientId);
    });
  });

  // Helper function to broadcast WebSocket messages
  function broadcast(message: WSMessage) {
    const messageStr = JSON.stringify(message);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // Helper function to fetch conversation history for AI memory (last 10 messages)
  async function getConversationHistory(conversationId: string) {
    const messages = await storage.getMessages(conversationId);
    // Get last 10 messages for better memory and context
    const recentMessages = messages
      .slice(-10) // Keep all messages (customer, AI, agent) for full context
      .map((m: Message) => ({
        sender: m.sender,
        content: m.content,
      }));
    return recentMessages;
  }

  // Helper function to send CSAT rating request to customer
  async function sendCsatRequest(conversation: Conversation, ticketId?: string) {
    const csatMessage = `Thank you for contacting us!\n\nYour issue has been resolved. We'd love to hear your feedback!\n\nPlease rate your experience:\n1 - Poor\n2 - Fair\n3 - Good\n4 - Very Good\n5 - Excellent\n\nReply with a number (1-5) to rate your experience.`;

    // Create the CSAT request message in the conversation
    const message = await storage.createMessage({
      conversationId: conversation.id,
      sender: "agent",
      senderName: "Support Team",
      content: csatMessage,
    });

    // Send to customer via their channel
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
              text: csatMessage,
            }),
          });
          console.log(`✅ CSAT request sent to Telegram customer (chat_id: ${conversation.channelUserId})`);
        } catch (error) {
          console.error('❌ Failed to send CSAT request to Telegram:', error);
        }
      }
    } else if (conversation.channel === "website") {
      // Broadcast CSAT request via WebSocket for website chat
      broadcast({
        type: "csat_request",
        data: { conversationId: conversation.id, message, ticketId },
      });
    }
  }

  // Helper function for smart escalation
  async function handleSmartEscalation(conversationId: string, reason: string = "AI unable to resolve", notifyAdminOnly: boolean = false) {
    try {
      console.log(`🔄 Smart escalation triggered for conversation ${conversationId}: ${reason}`);
      
      // Find available agents
      const agents = await storage.getAgents();
      const availableAgents = agents.filter(a => a.status === "available");
      
      if (availableAgents.length > 0) {
        // Set to pending_acceptance status with 30-second window
        await storage.updateConversation(conversationId, {
          status: "pending_acceptance",
          escalationTimestamp: new Date(),
        });
        
        console.log(`🔔 Chat escalated - pending agent acceptance (30-second window)`);
        
        // Broadcast new chat arrival with sound notification trigger
        broadcast({
          type: "new_chat",
          data: {
            conversationId,
            reason,
          },
        });
        
        return { success: true, assignedTo: "pending_acceptance" };
      } else {
        // No agents available
        if (notifyAdminOnly) {
          // When AI is paused and no agents available - notify admin only (no ticket)
          console.log('👮 AI paused, no agents available - notifying admin');
          
          // Keep conversation as "open" so admin can respond
          await storage.updateConversation(conversationId, {
            status: "open",
          });
          
          // Broadcast admin notification
          broadcast({
            type: "admin_notification",
            data: {
              conversationId,
              reason,
              message: "AI paused - Admin attention needed (no agents available)",
            },
          });
          
          return { success: true, assignedTo: "admin", reason };
        } else {
          // Create ticket (normal escalation when AI not paused)
          console.log('⚠️ No agents available - creating ticket');
          
          const conversation = await storage.getConversation(conversationId);
          if (conversation) {
            const ticket = await storage.createTicket({
              conversationId: conversation.id,
              title: `Support needed for ${conversation.customerName}`,
              description: reason,
              priority: "medium",
              status: "open",
              tat: 24, // 24 hours TAT by default
            });
            
            // Update conversation status
            await storage.updateConversation(conversationId, {
              status: "ticket",
            });
            
            console.log(`🎫 Ticket created with ID ${ticket.id}, TAT: ${ticket.tat} hours`);
            
            // Broadcast ticket creation
            broadcast({
              type: "escalation",
              data: {
                conversationId,
                ticketId: ticket.id,
                message: `Ticket created - TAT: ${ticket.tat} hours`,
              },
            });
            
            return { success: true, assignedTo: "ticket", ticketId: ticket.id };
          }
        }
      }
    } catch (error) {
      console.error('Smart escalation error:', error);
      return { success: false, error };
    }
  }

  // Conversations
  app.get("/api/conversations", async (req, res) => {
    const conversations = await storage.getConversations();
    res.json(conversations);
  });

  // Export conversations with all details (admin only)
  app.get("/api/export/conversations", requireAdmin, async (req, res) => {
    try {
      const exportData = await storage.getConversationsForExport();
      res.json(exportData);
    } catch (error) {
      console.error("Error exporting conversations:", error);
      res.status(500).json({ error: "Failed to export conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.json(conversation);
  });

  app.post("/api/conversations", async (req, res) => {
    const result = insertConversationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const conversation = await storage.createConversation(result.data);
    broadcast({ type: "message", data: { conversation } });
    res.json(conversation);
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    const conversation = await storage.updateConversation(req.params.id, req.body);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    broadcast({ type: "status_update", data: { conversation } });
    res.json(conversation);
  });

  // Messages
  app.get("/api/conversations/:id/messages", async (req, res) => {
    const messages = await storage.getMessages(req.params.id);
    res.json(messages);
  });

  app.post("/api/conversations/:conversationId/messages", async (req, res) => {
    const result = insertMessageSchema.safeParse({
      ...req.body,
      conversationId: req.params.conversationId,
    });
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const message = await storage.createMessage(result.data);
    console.log(`💬 Message created - sender: ${message.sender}, content: ${message.content}, conversationId: ${message.conversationId}`);
    
    // Update lastCustomerMessageAt if message is from customer (for inactivity tracking)
    if (message.sender === "customer") {
      await storage.updateConversation(message.conversationId, {
        lastCustomerMessageAt: new Date(),
        inactivityCheckCount: 0, // Reset inactivity check count
      });
    }
    
    // Broadcast immediately for real-time updates
    const wsMessage = { type: "message" as const, data: { message } };
    broadcast(wsMessage);
    console.log(`📡 Broadcasted message to ${clients.size} WebSocket clients`);

    // If message is from agent, mark conversation as assigned (agent has taken over)
    if (message.sender === "agent") {
      const conversation = await storage.getConversation(message.conversationId);
      if (conversation && (conversation.status === "open" || conversation.status === "ticket")) {
        // Find the current user (agent/admin) from session
        const currentUser = (req as any).user;
        if (currentUser) {
          // Check if user has an agent profile (works for both agents and admins who are also agents)
          const agents = await storage.getAgents();
          const agentProfile = agents.find(a => a.email === currentUser.username);
          
          if (agentProfile) {
            // User has agent profile - assign conversation and track workload
            await storage.updateConversation(message.conversationId, {
              status: "assigned",
              assignedAgentId: agentProfile.id,
            });
            
            // Increment agent's active conversation count
            await storage.updateAgentConversations(agentProfile.id, 1);
            
            console.log(`✅ Conversation assigned to ${agentProfile.name} (manual takeover)`);
            
            broadcast({
              type: "assignment",
              data: {
                conversationId: message.conversationId,
                agentId: agentProfile.id,
                agentName: agentProfile.name,
              },
            });
          } else if (currentUser.role === "admin") {
            // Admin without agent profile - just mark as assigned without specific agent
            await storage.updateConversation(message.conversationId, {
              status: "assigned",
            });
            console.log(`✅ Conversation taken over by admin ${currentUser.name} (manual takeover)`);
          } else {
            // Agent role but no profile - shouldn't happen but handle gracefully
            console.log(`⚠️ User ${currentUser.name} has agent role but no agent profile`);
          }
        }
      }
    }

    // If message is from agent or AI, send to customer on Telegram
    if (message.sender === "agent" || message.sender === "ai") {
      console.log(`📤 Attempting to send ${message.sender} message to customer...`);
      const conversation = await storage.getConversation(message.conversationId);
      console.log(`📋 Conversation details - channel: ${conversation?.channel}, channelUserId: ${conversation?.channelUserId}`);
      
      if (conversation && conversation.channel === "telegram" && conversation.channelUserId) {
        const telegramIntegration = await storage.getChannelIntegration("telegram");
        console.log(`🔑 Telegram integration found: ${telegramIntegration ? 'YES' : 'NO'}, has token: ${telegramIntegration?.apiToken ? 'YES' : 'NO'}`);
        
        if (telegramIntegration?.apiToken) {
          try {
            const sendMessageUrl = `https://api.telegram.org/bot${telegramIntegration.apiToken}/sendMessage`;
            const response = await fetch(sendMessageUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: conversation.channelUserId,
                text: message.content,
              }),
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error(`❌ Telegram API error: ${response.status} - ${errorText}`);
            } else {
              console.log(`✅ Message sent to Telegram customer (chat_id: ${conversation.channelUserId})`);
            }
          } catch (error) {
            console.error('❌ Failed to send message to Telegram:', error);
          }
        } else {
          console.log('⚠️ No Telegram API token configured');
        }
      } else {
        console.log(`⚠️ Cannot send to Telegram - Missing: ${!conversation ? 'conversation' : !conversation.channelUserId ? 'channelUserId' : 'not telegram channel'}`);
      }
    }

    // If message is from customer, generate AI response (only if not already assigned to agent)
    if (message.sender === "customer") {
      const conversation = await storage.getConversation(message.conversationId);
      
      // Skip AI response if conversation is already assigned to an agent or resolved
      if (conversation && conversation.status === "open") {
        const aiSettings = await storage.getAISettings();
        
        // Check if AI is paused - if so, skip AI and escalate to agent
        if (aiSettings?.paused) {
          console.log('⏸️ AI is paused - escalating to agent or admin');
          await handleSmartEscalation(message.conversationId, "AI is paused - routing to human agent", true);
        } else if (aiSettings?.enabled) {
          try {
            // Fetch knowledge files to include in AI context
            const knowledgeFiles = await storage.getKnowledgeFiles();
            const knowledgeFilesMetadata = knowledgeFiles.map(f => ({
              name: f.name,
              createdAt: f.createdAt,
            }));
            
            // Fetch last 5 messages for conversation context
            const conversationHistory = await getConversationHistory(message.conversationId);
            
            const aiResponse = await generateAIResponse(message.content, {
              provider: aiSettings.provider,
              knowledgeBase: aiSettings.knowledgeBase || undefined,
              systemPrompt: aiSettings.systemPrompt || undefined,
              model: aiSettings.model || undefined,
              knowledgeFiles: knowledgeFilesMetadata.length > 0 ? knowledgeFilesMetadata : undefined,
              conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
            });

            const aiMessage = await storage.createMessage({
              conversationId: message.conversationId,
              sender: "ai",
              senderName: "AI Assistant",
              content: aiResponse.content,
            });

            const aiWsMessage = { type: "message" as const, data: { message: aiMessage } };
            broadcast(aiWsMessage);
            console.log(`📡 Broadcasted AI message to ${clients.size} WebSocket clients`);
            
            // Send AI response to Telegram customer
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
                      text: aiResponse.content,
                    }),
                  });
                  console.log(`✅ AI response sent to Telegram customer (chat_id: ${conversation.channelUserId})`);
                } catch (error) {
                  console.error('❌ Failed to send AI response to Telegram:', error);
                }
              }
            }
            
            // Check if AI response indicates need for human assistance or customer wants agent
            const needsEscalation = /(?:human agent|speak to someone|talk to human|connect to agent|connect you|let me connect|transfer you|can't help|unable to assist|need more help|complex issue|escalate)/i.test(aiResponse.content);
            
            if (aiResponse.shouldEscalate || needsEscalation) {
              console.log('🔔 AI detected need for human assistance or customer requested agent');
              await handleSmartEscalation(message.conversationId, "AI detected customer needs human assistance");
            }
            
            // Check if customer is satisfied and wants to close the chat
            if (aiResponse.shouldCloseWithCSAT) {
              console.log('✅ AI detected customer satisfaction - auto-closing with CSAT');
              
              // Mark conversation as resolved
              await storage.updateConversation(message.conversationId, {
                status: "resolved",
              });
              
              // Create and send CSAT survey message
              const csatText = `Thank you for contacting us! 🌟\n\nPlease rate your experience:\n\n⭐ - Poor\n⭐⭐ - Fair\n⭐⭐⭐ - Good\n⭐⭐⭐⭐ - Very Good\n⭐⭐⭐⭐⭐ - Excellent\n\nReply with a number from 1 to 5.`;
              
              const csatMessage = await storage.createMessage({
                conversationId: message.conversationId,
                sender: "ai",
                senderName: "Support Team",
                content: csatText,
              });
              
              broadcast({ type: "message" as const, data: { message: csatMessage } });
              
              // Send to Telegram if applicable
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
                        text: csatMessage.content,
                      }),
                    });
                  } catch (error) {
                    console.error('❌ Failed to send CSAT to Telegram:', error);
                  }
                }
              }
              
              // Broadcast conversation update
              broadcast({
                type: "status_update",
                data: {
                  conversationId: message.conversationId,
                  status: "resolved",
                },
              });
            }
          } catch (error) {
            console.error("AI response error:", error);
            // On AI error, escalate to human agent
            await handleSmartEscalation(message.conversationId, "AI service error - escalating to human agent");
          }
        } else if (!aiSettings?.enabled) {
          // If AI is disabled, immediately escalate to available agent or create ticket
          console.log('⚠️ AI is disabled - escalating to agent');
          await handleSmartEscalation(message.conversationId, "AI is disabled");
        }
      }
    }

    res.json(message);
  });

  // Manual agent assignment (Admin only)
  app.post("/api/conversations/:id/assign", async (req, res) => {
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const { agentId } = req.body;
    if (!agentId) {
      return res.status(400).json({ error: "Agent ID is required" });
    }

    const agent = await storage.getAgent(agentId);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    // If there's a previous agent, decrement their conversation count
    if (conversation.assignedAgentId && conversation.assignedAgentId !== agentId) {
      await storage.updateAgentConversations(conversation.assignedAgentId, -1);
      console.log(`📤 Chat transferred from previous agent ${conversation.assignedAgentId}`);
    }

    // Assign to specified agent
    const updated = await storage.updateConversation(conversation.id, {
      status: "assigned",
      assignedAgentId: agent.id,
    });

    // Only increment if this is a new assignment (not a transfer to same agent)
    if (conversation.assignedAgentId !== agentId) {
      await storage.updateAgentConversations(agent.id, 1);
    }
    
    broadcast({ 
      type: "assignment", 
      data: { 
        conversation: updated, 
        agent,
        previousAgentId: conversation.assignedAgentId,
      } 
    });
    res.json({ conversation: updated, agent });
  });

  // Accept pending chat (First-accept-first-serve)
  app.post("/api/conversations/:id/accept", async (req, res) => {
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Check if still in pending_acceptance status
    if (conversation.status !== "pending_acceptance") {
      return res.status(400).json({ error: "Chat is no longer available for acceptance" });
    }

    // Check if within 30-second window
    if (conversation.escalationTimestamp) {
      const elapsed = Date.now() - new Date(conversation.escalationTimestamp).getTime();
      if (elapsed > 30000) {
        // Expired - only admin can see it now
        return res.status(400).json({ error: "Acceptance window expired" });
      }
    }

    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Find agent by user email
    const agents = await storage.getAgents();
    const agent = agents.find(a => a.email === req.user?.username);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found for this user" });
    }

    // Assign to this agent (first-accept-first-serve)
    const updated = await storage.updateConversation(conversation.id, {
      status: "assigned",
      assignedAgentId: agent.id,
    });

    await storage.updateAgentConversations(agent.id, 1);
    
    console.log(`✅ Chat accepted by agent ${agent.name}`);
    
    broadcast({ 
      type: "chat_accepted", 
      data: { 
        conversationId: conversation.id,
        agentId: agent.id,
        agentName: agent.name,
      } 
    });
    
    res.json({ conversation: updated, agent });
  });

  // Escalation - Use smart escalation with 30-second pending_acceptance window
  app.post("/api/conversations/:id/escalate", async (req, res) => {
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Use smart escalation which handles pending_acceptance with 30-second window
    const result = await handleSmartEscalation(conversation.id, "Manually escalated");
    
    const updatedConversation = await storage.getConversation(conversation.id);
    
    res.json({ 
      conversation: updatedConversation,
      result
    });
  });

  // Agents
  app.get("/api/agents", requireAdmin, async (req, res) => {
    const agents = await storage.getAgents();
    res.json(agents);
  });

  // Get current agent's info (for agents to identify themselves)
  app.get("/api/agents/me", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const agents = await storage.getAgents();
    const currentAgent = agents.find(a => a.email === req.user?.username);
    
    if (!currentAgent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    res.json(currentAgent);
  });

  app.get("/api/conversations/:id/agent", async (req, res) => {
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation || !conversation.assignedAgentId) {
      return res.status(404).json({ error: "No agent assigned" });
    }
    const agent = await storage.getAgent(conversation.assignedAgentId);
    res.json(agent);
  });

  app.post("/api/agents", requireAdmin, async (req, res) => {
    try {
      const { name, email, password, status } = req.body;
      
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(email);
      if (existingUser) {
        return res.status(400).json({ error: "An account with this email already exists" });
      }

      // Import hashPassword from auth
      const { hashPassword } = await import("./auth");
      
      // Create user account with "agent" role
      const user = await storage.createUser({
        username: email,
        email: email,
        password: await hashPassword(password),
        role: "agent",
        name: name,
      });

      // Create agent profile linked to user
      const agent = await storage.createAgent({
        name,
        email,
        status: status || "offline",
      });

      broadcast({ type: "status_update", data: { agent } });
      res.json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  // Allow agents to update their own status
  app.patch("/api/agents/me/status", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const { status } = req.body;
    
    // Validate status
    const validStatuses: AgentStatus[] = ["available", "break", "training", "floor_support", "not_available"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be one of: available, break, training, floor_support, not_available" });
    }

    const agents = await storage.getAgents();
    const currentAgent = agents.find(a => a.email === req.user?.username);
    
    if (!currentAgent) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const agent = await storage.updateAgentStatus(currentAgent.id, status);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    
    broadcast({ type: "status_update", data: { agent } });
    res.json(agent);
  });

  // Admin route to update any agent's status
  app.patch("/api/agents/:id/status", requireAdmin, async (req, res) => {
    const { status } = req.body;
    
    // Validate status
    const validStatuses: AgentStatus[] = ["available", "break", "training", "floor_support", "not_available"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status. Must be one of: available, break, training, floor_support, not_available" });
    }
    
    const agent = await storage.updateAgentStatus(req.params.id, status);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    broadcast({ type: "status_update", data: { agent } });
    res.json(agent);
  });

  // Admin route to reset agent password
  app.patch("/api/agents/:id/reset-password", requireAdmin, async (req, res) => {
    try {
      const { newPassword } = req.body;
      
      if (!newPassword) {
        return res.status(400).json({ error: "New password is required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters" });
      }

      // Get the agent to find their email
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }

      // Update the user password
      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(newPassword);
      
      const user = await storage.getUserByUsername(agent.email);
      if (!user) {
        return res.status(404).json({ error: "User account not found" });
      }

      await storage.updateUserPassword(user.id, hashedPassword);

      res.json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ error: "Failed to reset password" });
    }
  });

  // Tickets
  app.get("/api/tickets", async (req, res) => {
    const tickets = await storage.getTickets();
    res.json(tickets);
  });

  // Create ticket from conversation and close chat without CSAT
  app.post("/api/tickets/from-conversation", async (req, res) => {
    const { conversationId, title, description, priority } = req.body;
    
    if (!conversationId || !title || !description) {
      return res.status(400).json({ error: "conversationId, title, and description are required" });
    }

    // Get conversation details
    const conversation = await storage.getConversation(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Create ticket
    const ticketData = {
      conversationId,
      title,
      description,
      issue: description,
      customerEmail: conversation.customerEmail,
      priority: priority || "medium",
      status: "open" as const,
      tat: 60,
    };

    const ticket = await storage.createTicket(ticketData);

    // Close conversation without CSAT
    await storage.updateConversation(conversationId, {
      status: "resolved",
    });

    // Broadcast status update
    broadcast({
      type: "status_update",
      data: { conversation: { id: conversationId, status: "resolved" } },
    });

    // Send email notification for ticket creation if enabled
    if (ticket.customerEmail) {
      try {
        const emailSettings = await storage.getEmailSettings();
        if (emailSettings?.enabled) {
          const emailHtml = generateTicketCreationEmail(
            conversation.customerName,
            ticket.ticketNumber,
            ticket.title,
            ticket.issue || ticket.description,
            ticket.tat
          );

          await sendEmail({
            to: ticket.customerEmail,
            subject: `Support Ticket Created: ${ticket.ticketNumber}`,
            html: emailHtml,
            emailSettings,
          });
          console.log(`✅ Ticket creation email sent to ${ticket.customerEmail}`);
        }
      } catch (error) {
        console.error("Failed to send ticket creation email:", error);
      }
    }

    console.log(`✅ Ticket ${ticket.ticketNumber} created from conversation and chat closed`);
    res.json({ ticket });
  });

  app.post("/api/tickets", async (req, res) => {
    const result = insertTicketSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    const user = req.user as User;
    
    // Add creator information to ticket
    const ticketData = {
      ...result.data,
      createdBy: user?.id,
      createdByName: user?.name,
    };
    
    const ticket = await storage.createTicket(ticketData);

    // Log ticket creation in audit log
    if (user) {
      try {
        await storage.createTicketAuditLog({
          ticketId: ticket.id,
          action: "created",
          performedBy: user.id,
          performedByName: user.name,
          changes: JSON.stringify({ created: true }),
          snapshot: JSON.stringify(ticket),
        });
      } catch (error) {
        console.error("❌ Failed to log ticket creation in audit log:", error);
      }
    }

    // Send email notification for ticket creation/escalation if customer email is available
    if (ticket.status === "open" && ticket.customerEmail) {
      try {
        const emailSettings = await storage.getEmailSettings();
        if (emailSettings?.enabled) {
          const conversation = await storage.getConversation(ticket.conversationId);
          const customerName = conversation?.customerName || "Customer";
          const issueDetails = ticket.issue || ticket.description;

          const emailHtml = generateTicketCreationEmail(
            customerName,
            ticket.ticketNumber,
            ticket.title,
            issueDetails,
            ticket.tat
          );

          await sendEmail({
            to: ticket.customerEmail,
            subject: `Support Ticket Created: ${ticket.ticketNumber}`,
            html: emailHtml,
            emailSettings,
          });
          console.log(`✅ Ticket creation email sent to ${ticket.customerEmail}`);
        }
      } catch (error) {
        console.error('❌ Failed to send ticket creation email:', error);
      }
    }

    res.json(ticket);
  });

  app.patch("/api/tickets/:id", async (req, res) => {
    const oldTicket = await storage.getTicket(req.params.id);
    if (!oldTicket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const ticket = await storage.updateTicket(req.params.id, req.body);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Log ticket update in audit log
    const user = req.user as User;
    if (user) {
      try {
        // Calculate what changed
        const changes: Record<string, { old: any; new: any }> = {};
        const fieldsToTrack = ['title', 'description', 'issue', 'notes', 'priority', 'status', 'tat', 'customerEmail'];
        
        fieldsToTrack.forEach(field => {
          if (oldTicket[field as keyof typeof oldTicket] !== ticket[field as keyof typeof ticket]) {
            changes[field] = {
              old: oldTicket[field as keyof typeof oldTicket],
              new: ticket[field as keyof typeof ticket],
            };
          }
        });

        // Only log if there are actual changes
        if (Object.keys(changes).length > 0) {
          const action = oldTicket.status !== ticket.status ? "status_changed" : "updated";
          
          await storage.createTicketAuditLog({
            ticketId: ticket.id,
            action,
            performedBy: user.id,
            performedByName: user.name,
            changes: JSON.stringify(changes),
            snapshot: JSON.stringify(ticket),
          });
        }
      } catch (error) {
        console.error("❌ Failed to log ticket update in audit log:", error);
      }
    }

    // Handle status change email notifications
    const wasResolved = oldTicket.status === "resolved";
    const isNowResolved = ticket.status === "resolved";
    const isNowOpen = ticket.status === "open" || ticket.status === "in_progress";
    
    console.log('📧 Ticket update check:', {
      wasResolved,
      isNowResolved,
      isNowOpen,
      hasEmail: !!ticket.customerEmail,
      oldStatus: oldTicket.status,
      newStatus: ticket.status,
      customerEmail: ticket.customerEmail
    });
    
    // Send reopen email if ticket was resolved and is now open/in_progress
    if (wasResolved && isNowOpen && ticket.customerEmail) {
      console.log('📧 Attempting to send ticket reopen email...');
      try {
        const emailSettings = await storage.getEmailSettings();
        console.log('📧 Email settings:', {
          exists: !!emailSettings,
          enabled: emailSettings?.enabled,
          hasApiKey: !!emailSettings?.sendgridApiKey,
          hasSenderEmail: !!emailSettings?.senderEmail
        });
        
        if (emailSettings?.enabled) {
          const conversation = await storage.getConversation(ticket.conversationId);
          const customerName = conversation?.customerName || "Customer";

          const emailHtml = generateTicketReopenEmail(
            customerName,
            ticket.ticketNumber,
            ticket.title,
            ticket.tat
          );

          await sendEmail({
            to: ticket.customerEmail,
            subject: `Ticket Reopened: ${ticket.ticketNumber}`,
            html: emailHtml,
            emailSettings,
          });
          console.log(`✅ Ticket reopen email sent to ${ticket.customerEmail}`);
        } else {
          console.log('📧 Email notifications disabled or not configured');
        }
      } catch (error) {
        console.error('❌ Failed to send ticket reopen email:', error);
      }
    }

    // Send CSAT email if ticket is newly resolved (from any non-resolved status to resolved)
    if (!wasResolved && isNowResolved && ticket.customerEmail) {
      console.log('📧 Attempting to send ticket resolution/CSAT email...');
      try {
        const emailSettings = await storage.getEmailSettings();
        if (emailSettings?.enabled) {
          const conversation = await storage.getConversation(ticket.conversationId);
          if (conversation) {
            // Send CSAT request message to customer via chat
            await sendCsatRequest(conversation, ticket.id);

            // Send CSAT email
            const csatUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.com'}/csat/${ticket.id}`;
            const emailHtml = generateTicketResolutionEmail(
              conversation.customerName,
              ticket.ticketNumber,
              ticket.title,
              ticket.id,
              csatUrl
            );

            await sendEmail({
              to: ticket.customerEmail,
              subject: `Ticket Resolved: ${ticket.title}`,
              html: emailHtml,
              emailSettings,
            });
            console.log(`✅ Ticket resolution/CSAT email sent to ${ticket.customerEmail}`);
          }
        }
      } catch (error) {
        console.error('❌ Failed to send ticket resolution email:', error);
      }
    }

    res.json(ticket);
  });

  // Get audit log for a ticket
  app.get("/api/tickets/:id/audit", async (req, res) => {
    const auditLog = await storage.getTicketAuditLog(req.params.id);
    res.json(auditLog);
  });

  // Send resolution email to customer
  app.post("/api/tickets/:id/send-resolution", async (req, res) => {
    const { subject, message } = req.body;
    
    if (!subject || !message) {
      return res.status(400).json({ error: "Subject and message are required" });
    }

    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    if (!ticket.customerEmail) {
      return res.status(400).json({ error: "No customer email associated with this ticket" });
    }

    const user = req.user as User;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    try {
      const emailSettings = await storage.getEmailSettings();
      if (!emailSettings?.enabled) {
        return res.status(400).json({ error: "Email service is not configured or disabled" });
      }

      // Create email HTML with agent's custom message
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px 20px; border-radius: 0 0 10px 10px; }
            .message { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
            .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            .ticket-info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
            .label { font-weight: 600; color: #4b5563; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 style="margin: 0;">Resolution for Ticket ${ticket.ticketNumber}</h1>
          </div>
          <div class="content">
            <div class="ticket-info">
              <p style="margin: 5px 0;"><span class="label">Ticket:</span> ${ticket.ticketNumber}</p>
              <p style="margin: 5px 0;"><span class="label">Title:</span> ${ticket.title}</p>
            </div>
            
            <div class="message">
              <p style="white-space: pre-wrap; margin: 0;">${message.replace(/\n/g, '<br>')}</p>
            </div>

            <p style="margin-top: 20px; color: #6b7280; font-size: 14px;">
              Sent by ${user.name} from Solvextra Support Team
            </p>

            <div class="footer">
              <p>Thank you for using our support services!</p>
              <p style="margin-top: 10px;">If you have any questions, please don't hesitate to reach out.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: ticket.customerEmail,
        subject: subject,
        html: emailHtml,
        emailSettings,
      });

      // Update ticket to mark resolution as sent
      await storage.updateTicket(ticket.id, {
        resolutionSent: true,
        resolutionSentAt: new Date(),
      });

      // Log the resolution send action in audit log
      await storage.createTicketAuditLog({
        ticketId: ticket.id,
        action: "resolution_sent",
        performedBy: user.id,
        performedByName: user.name,
        changes: JSON.stringify({ subject, messageSent: true }),
        snapshot: JSON.stringify(ticket),
      });

      console.log(`✅ Resolution email sent to ${ticket.customerEmail} for ticket ${ticket.ticketNumber}`);
      res.json({ success: true, message: "Resolution email sent successfully" });
    } catch (error) {
      console.error("❌ Failed to send resolution email:", error);
      res.status(500).json({ error: "Failed to send resolution email" });
    }
  });

  // Resolve Ticket - marks as resolved and sends CSAT request
  app.post("/api/tickets/:id/resolve", async (req, res) => {
    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    // Update ticket status to resolved
    const updatedTicket = await storage.updateTicket(req.params.id, {
      status: "resolved",
      resolvedAt: new Date(),
    });

    // Get conversation to send CSAT request
    const conversation = await storage.getConversation(ticket.conversationId);
    if (conversation) {
      // Send CSAT request message to customer via chat
      await sendCsatRequest(conversation, ticket.id);

      // Send email notification if customer email is available
      if (ticket.customerEmail) {
        try {
          const emailSettings = await storage.getEmailSettings();
          if (emailSettings?.enabled) {
            const csatUrl = `${process.env.REPLIT_DEV_DOMAIN || 'https://your-domain.com'}/csat/${ticket.id}`;
            const emailHtml = generateTicketResolutionEmail(
              conversation.customerName,
              ticket.ticketNumber,
              ticket.title,
              ticket.id,
              csatUrl
            );

            await sendEmail({
              to: ticket.customerEmail,
              subject: `Ticket Resolved: ${ticket.title}`,
              html: emailHtml,
              emailSettings,
            });
            console.log(`✅ Ticket resolution email sent to ${ticket.customerEmail}`);
          }
        } catch (error) {
          console.error('❌ Failed to send ticket resolution email:', error);
        }
      }
    }

    res.json(updatedTicket);
  });

  // Public endpoint to get ticket for CSAT page (no auth required)
  app.get("/api/public/tickets/:id", async (req, res) => {
    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    // Return only safe, minimal data for CSAT page
    res.json({
      id: ticket.id,
      title: ticket.title,
    });
  });

  // Resolve Conversation - marks as resolved and sends CSAT request
  app.post("/api/conversations/:id/resolve", async (req, res) => {
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Update conversation status to resolved
    const updatedConversation = await storage.updateConversation(req.params.id, {
      status: "resolved",
    });

    // Send CSAT request message to customer
    await sendCsatRequest(conversation, undefined);

    res.json(updatedConversation);
  });

  // Convert Conversation to Ticket
  app.post("/api/conversations/:id/convert-to-ticket", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Check if conversation is already a ticket
      if (conversation.status === "ticket") {
        return res.status(400).json({ error: "Conversation is already a ticket" });
      }

      // Check if a ticket already exists for this conversation
      const existingTickets = await storage.getTickets();
      const existingTicket = existingTickets.find(t => t.conversationId === conversation.id);
      if (existingTicket) {
        return res.status(400).json({ error: "A ticket already exists for this conversation" });
      }

      // Create ticket from conversation
      const ticket = await storage.createTicket({
        conversationId: conversation.id,
        title: `Support for ${conversation.customerName}`,
        description: "Converted from conversation",
        priority: "medium",
        status: "open",
        tat: 24,
        customerEmail: conversation.customerEmail || undefined,
      });

      // Send email notification if customer email is available
      if (ticket.customerEmail) {
        try {
          const emailSettings = await storage.getEmailSettings();
          if (emailSettings?.enabled) {
            const issueDetails = ticket.issue || ticket.description;

            const emailHtml = generateTicketCreationEmail(
              conversation.customerName,
              ticket.ticketNumber,
              ticket.title,
              issueDetails,
              ticket.tat
            );

            await sendEmail({
              to: ticket.customerEmail,
              subject: `Support Ticket Created: ${ticket.ticketNumber}`,
              html: emailHtml,
              emailSettings,
            });
            console.log(`✅ Ticket creation email sent to ${ticket.customerEmail}`);
          }
        } catch (error) {
          console.error('❌ Failed to send ticket creation email:', error);
        }
      }

      // Update conversation status to ticket
      const updatedConversation = await storage.updateConversation(req.params.id, {
        status: "ticket",
      });

      // Broadcast update
      broadcast({
        type: "status_update",
        data: {
          conversationId: conversation.id,
          status: "ticket",
          ticketId: ticket.id,
        },
      });

      res.json({ conversation: updatedConversation, ticket });
    } catch (error) {
      console.error("❌ Error converting conversation to ticket:", error);
      res.status(500).json({ 
        error: "Failed to convert conversation to ticket",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Close Conversation/Ticket without CSAT (only for ticket status)
  app.post("/api/conversations/:id/close", async (req, res) => {
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Update conversation status to resolved WITHOUT sending CSAT
    const updatedConversation = await storage.updateConversation(req.params.id, {
      status: "resolved",
    });

    // Find and update associated ticket if it exists
    const tickets = await storage.getTickets();
    const ticket = tickets.find(t => t.conversationId === conversation.id);
    if (ticket) {
      await storage.updateTicket(ticket.id, {
        status: "resolved",
        resolvedAt: new Date(),
      });
    }

    // Broadcast update
    broadcast({
      type: "status_update",
      data: {
        conversationId: conversation.id,
        status: "resolved",
      },
    });

    res.json(updatedConversation);
  });

  // Public ticket endpoint for CSAT (no auth required)
  app.get("/api/public/tickets/:id", async (req, res) => {
    const ticket = await storage.getTicket(req.params.id);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    // Return only safe public data
    res.json({
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      title: ticket.title,
      conversationId: ticket.conversationId,
    });
  });

  // Submit CSAT Rating (from customer)
  app.get("/api/csat-ratings", requireAdmin, async (req, res) => {
    const ratings = await storage.getCsatRatings();
    res.json(ratings);
  });

  app.post("/api/csat-ratings", async (req, res) => {
    const result = insertCsatRatingSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const rating = await storage.createCsatRating(result.data);
    res.json(rating);
  });

  // AI Settings
  app.get("/api/settings/ai", requireAdmin, async (req, res) => {
    const settings = await storage.getAISettings();
    res.json(settings);
  });

  app.post("/api/settings/ai", requireAdmin, async (req, res) => {
    const result = insertAISettingsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    console.log("📝 Saving AI settings:", JSON.stringify(result.data, null, 2));
    const settings = await storage.upsertAISettings(result.data);
    console.log("✅ Saved AI settings:", JSON.stringify(settings, null, 2));
    res.json(settings);
  });

  // Channel Integrations
  app.get("/api/settings/channels", requireAdmin, async (req, res) => {
    const integrations = await storage.getChannelIntegrations();
    res.json(integrations);
  });

  app.get("/api/settings/channels/:channel", requireAdmin, async (req, res) => {
    const channel = req.params.channel as Channel;
    const integration = await storage.getChannelIntegration(channel);
    res.json(integration);
  });

  app.post("/api/settings/channels", requireAdmin, async (req, res) => {
    const result = insertChannelIntegrationSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    const integration = await storage.upsertChannelIntegration(result.data);

    // Auto-register Telegram webhook when bot token is saved
    if (integration.channel === "telegram" && integration.apiToken && integration.enabled) {
      try {
        // Get the correct domain from various Replit environment variables
        const domain = process.env.REPLIT_DEV_DOMAIN || 
                      process.env.REPLIT_DEPLOYMENT || 
                      (process.env.REPL_SLUG ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` : null) ||
                      'localhost:5000';
        const protocol = domain.includes('localhost') ? 'http' : 'https';
        const webhookUrl = `${protocol}://${domain}/api/webhooks/telegram`;
        
        console.log('Registering Telegram webhook at:', webhookUrl);
        
        const telegramApiUrl = `https://api.telegram.org/bot${integration.apiToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
        
        const response = await fetch(telegramApiUrl);
        const data = await response.json();
        
        if (data.ok) {
          console.log('✅ Telegram webhook registered successfully at:', webhookUrl);
          console.log('Webhook info:', data.result);
        } else {
          console.error('❌ Failed to register Telegram webhook:', data);
        }
      } catch (error) {
        console.error('Error registering Telegram webhook:', error);
      }
    }
    
    res.json(integration);
  });

  // Knowledge Files
  app.get("/api/knowledge-files", async (req, res) => {
    const files = await storage.getKnowledgeFiles();
    res.json(files);
  });

  app.post("/api/knowledge-files", async (req, res) => {
    const result = insertKnowledgeFileSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const file = await storage.createKnowledgeFile(result.data);
    res.json(file);
  });

  app.delete("/api/knowledge-files/:id", async (req, res) => {
    const success = await storage.deleteKnowledgeFile(req.params.id);
    if (!success) {
      return res.status(404).json({ error: "File not found" });
    }
    res.json({ success: true });
  });

  // Email Settings
  app.get("/api/settings/email", requireAdmin, async (req, res) => {
    const settings = await storage.getEmailSettings();
    res.json(settings);
  });

  app.post("/api/settings/email", requireAdmin, async (req, res) => {
    const result = insertEmailSettingsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const settings = await storage.upsertEmailSettings(result.data);
    res.json(settings);
  });

  // Webhooks for external channels
  app.post("/api/webhooks/telegram", async (req, res) => {
    try {
      console.log('📨 Telegram webhook received:', JSON.stringify(req.body, null, 2));
      const update = req.body;
      
      if (update.message) {
        const { message } = update;
        const customerId = message.from.id.toString();
        const customerName = message.from.first_name + (message.from.last_name ? ` ${message.from.last_name}` : '');
        
        console.log(`New message from ${customerName}: ${message.text}`);
        
        // Create or get conversation
        // Find the most recent conversation for this customer
        let conversation = (await storage.getConversations())
          .filter(c => c.channel === "telegram" && c.customerName === customerName)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        
        // Check if this is a CSAT rating for a resolved conversation
        const isNumericRating = /^[1-5]$/.test(message.text?.trim() || "");
        
        // Debug: Check last message
        if (conversation && isNumericRating) {
          const messages = await storage.getMessages(conversation.id);
          const lastAgentMessage = messages
            .filter(m => m.sender === "agent" || m.sender === "ai")
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
          console.log('🔍 CSAT Debug - Conversation status:', conversation.status);
          console.log('🔍 CSAT Debug - Is numeric rating:', isNumericRating);
          console.log('🔍 CSAT Debug - Last agent message:', lastAgentMessage?.content?.substring(0, 50));
        }
        
        const isCsatResponse = conversation?.status === "resolved" && 
          isNumericRating &&
          (await storage.getMessages(conversation.id))
            .filter(m => m.sender === "agent" || m.sender === "ai")
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
            ?.content.includes("rate your experience");
        
        if (isCsatResponse && conversation) {
          // This is a CSAT rating - process it without creating new conversation
          console.log('⭐ CSAT rating received:', message.text);
          
          try {
            const rating = parseInt(message.text?.trim() || "0");
            
            // Find related ticket if any
            const tickets = await storage.getTickets();
            const relatedTicket = tickets.find(t => t.conversationId === conversation.id);
            
            // Create CSAT rating
            await storage.createCsatRating({
              ticketId: relatedTicket?.id,
              conversationId: conversation.id,
              rating,
            });
            console.log('✅ CSAT rating saved:', rating);
            
            // Send thank you message
            const telegramIntegration = await storage.getChannelIntegration("telegram");
            if (telegramIntegration?.apiToken) {
              const sendMessageUrl = `https://api.telegram.org/bot${telegramIntegration.apiToken}/sendMessage`;
              await fetch(sendMessageUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: message.chat.id,
                  text: `Thank you for your ${rating}-star rating! We appreciate your feedback. 🙏`,
                }),
              });
              console.log('✅ CSAT thank you message sent to Telegram');
            }
          } catch (error) {
            console.error('❌ Failed to save CSAT rating:', error);
          }
          
          res.json({ ok: true });
          return;
        }
        
        // If no conversation exists OR the latest one is resolved, create a new conversation
        if (!conversation || conversation.status === "resolved") {
          if (conversation?.status === "resolved") {
            console.log('Previous conversation was resolved - creating new conversation for returning customer:', customerName);
          } else {
            console.log('Creating new conversation for', customerName);
          }
          
          conversation = await storage.createConversation({
            channel: "telegram",
            customerName,
            customerAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${customerName}`,
            channelUserId: message.chat.id.toString(), // Store Telegram chat_id
            status: "open",
            lastMessageAt: new Date(),
          });
          
          // Broadcast new chat arrival
          broadcast({
            type: "new_chat",
            data: {
              conversation,
            },
          });
          console.log(`📡 Broadcasted new Telegram chat for ${customerName}`);
        } else {
          // Update last message timestamp for existing open/assigned conversation
          await storage.updateConversation(conversation.id, {
            lastMessageAt: new Date(),
          });
        }
        
        // Save customer message
        const savedMessage = await storage.createMessage({
          conversationId: conversation.id,
          sender: "customer",
          senderName: customerName,
          content: message.text || "",
        });
        
        console.log('Message saved:', savedMessage.id);
        
        // Broadcast via WebSocket for instant updates
        broadcast({
          type: "message",
          data: {
            message: savedMessage,
          },
        });
        console.log(`📡 Broadcasted Telegram message to ${clients.size} WebSocket clients`);
        
        // Auto-respond with AI (if enabled and conversation not already assigned to agent)
        const aiSettings = await storage.getAISettings();
        if (conversation.status === "open") {
          if (aiSettings?.enabled) {
            console.log('Generating AI response with provider:', aiSettings.provider, 'model:', aiSettings.model);
            
            // Fetch knowledge files to include in AI context
            const knowledgeFiles = await storage.getKnowledgeFiles();
            const knowledgeFilesMetadata = knowledgeFiles.map(f => ({
              name: f.name,
              createdAt: f.createdAt,
            }));
            
            // Fetch last 5 messages for conversation context
            const conversationHistory = await getConversationHistory(conversation.id);
            
            const aiResponse = await generateAIResponse(message.text || "", {
              provider: aiSettings.provider,
              model: aiSettings.model || undefined,
              knowledgeBase: aiSettings.knowledgeBase || undefined,
              systemPrompt: aiSettings.systemPrompt || undefined,
              knowledgeFiles: knowledgeFilesMetadata.length > 0 ? knowledgeFilesMetadata : undefined,
              conversationHistory: conversationHistory.length > 0 ? conversationHistory : undefined,
            });
            
            if (aiResponse?.content) {
              // Save AI response
              const aiMessage = await storage.createMessage({
                conversationId: conversation.id,
                sender: "ai",
                senderName: "AI Assistant",
                content: aiResponse.content,
              });
              
              // Send response back to Telegram
              const telegramIntegration = await storage.getChannelIntegration("telegram");
              if (telegramIntegration?.apiToken) {
                const sendMessageUrl = `https://api.telegram.org/bot${telegramIntegration.apiToken}/sendMessage`;
                await fetch(sendMessageUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: message.chat.id,
                    text: aiResponse.content,
                  }),
                });
                console.log('✅ AI response sent to Telegram');
              }
              
              // Broadcast AI response via WebSocket for instant updates
              broadcast({
                type: "message",
                data: {
                  message: aiMessage,
                },
              });
              console.log(`📡 Broadcasted Telegram AI message to ${clients.size} WebSocket clients`);
              
              // Check if AI wants to close chat with CSAT
              if (aiResponse.shouldCloseWithCSAT) {
                console.log('✅ AI detected customer satisfaction - closing with CSAT');
                
                // Update conversation to resolved
                await storage.updateConversation(conversation.id, {
                  status: "resolved",
                });
                
                // Create and save CSAT survey message
                const csatText = `Thank you for contacting us! 🌟\n\nPlease rate your experience:\n\n⭐ - Poor\n⭐⭐ - Fair\n⭐⭐⭐ - Good\n⭐⭐⭐⭐ - Very Good\n⭐⭐⭐⭐⭐ - Excellent\n\nReply with a number from 1 to 5.`;
                
                const csatMessage = await storage.createMessage({
                  conversationId: conversation.id,
                  sender: "ai",
                  senderName: "Support Team",
                  content: csatText,
                });
                
                // Broadcast CSAT message
                broadcast({
                  type: "message",
                  data: {
                    message: csatMessage,
                  },
                });
                
                // Send CSAT survey to Telegram
                const telegramIntegration = await storage.getChannelIntegration("telegram");
                if (telegramIntegration?.apiToken) {
                  const sendMessageUrl = `https://api.telegram.org/bot${telegramIntegration.apiToken}/sendMessage`;
                  await fetch(sendMessageUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: message.chat.id,
                      text: csatText,
                    }),
                  });
                  console.log('📊 CSAT survey sent to Telegram');
                }
                
                // Broadcast conversation update
                broadcast({
                  type: "status_update",
                  data: {
                    conversationId: conversation.id,
                  },
                });
              }
              // Check if AI response indicates need for human assistance
              else if (aiResponse.shouldEscalate) {
                console.log('🔔 AI detected need for human assistance or customer requested agent');
                await handleSmartEscalation(conversation.id, "AI detected customer needs human assistance");
              }
            }
          } else {
            console.log('⚠️ AI is not enabled - escalating to agent');
            const escalationResult = await handleSmartEscalation(conversation.id, "AI is disabled");
          
            // Send notification to customer on Telegram
            const telegramIntegration = await storage.getChannelIntegration("telegram");
            if (telegramIntegration?.apiToken && escalationResult) {
              const sendMessageUrl = `https://api.telegram.org/bot${telegramIntegration.apiToken}/sendMessage`;
              let responseText = "";
              
              if (escalationResult.assignedTo === "agent") {
                responseText = `Your message has been received. An agent will assist you shortly.`;
              } else if (escalationResult.assignedTo === "ticket") {
                responseText = `Thank you for contacting us! We've created a support ticket for you. Our team will respond within 24 hours.`;
              }
              
              if (responseText) {
                await fetch(sendMessageUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: message.chat.id,
                    text: responseText,
                  }),
                });
                console.log('✅ Escalation notification sent to Telegram');
              }
            }
          }
        } else {
          console.log(`⏭️ Conversation already ${conversation.status} - skipping AI response`);
        }
      }
      
      res.json({ ok: true });
    } catch (error) {
      console.error("❌ Telegram webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/webhooks/whatsapp", async (req, res) => {
    try {
      // WhatsApp webhook implementation
      const { entry } = req.body;
      
      if (entry && entry[0]?.changes?.[0]?.value?.messages?.[0]) {
        const message = entry[0].changes[0].value.messages[0];
        const contact = entry[0].changes[0].value.contacts[0];
        
        const conversation = await storage.createConversation({
          channel: "whatsapp",
          customerName: contact.profile.name,
          status: "open",
          lastMessageAt: new Date(),
        });
        
        await storage.createMessage({
          conversationId: conversation.id,
          sender: "customer",
          senderName: contact.profile.name,
          content: message.text?.body || "",
        });
      }
      
      res.json({ ok: true });
    } catch (error) {
      console.error("WhatsApp webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/webhooks/instagram", async (req, res) => {
    try {
      // Instagram webhook implementation
      res.json({ ok: true });
    } catch (error) {
      console.error("Instagram webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/webhooks/twitter", async (req, res) => {
    try {
      // Twitter/X webhook implementation
      res.json({ ok: true });
    } catch (error) {
      console.error("Twitter webhook error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Analytics
  app.get("/api/analytics/stats", requireAdmin, async (req, res) => {
    const conversations = await storage.getConversations();
    const agents = await storage.getAgents();
    const tickets = await storage.getTickets();

    const stats = {
      totalConversations: conversations.length,
      activeAgents: agents.filter(a => a.status === "available").length,
      avgResponseTime: "2.5m",
      resolutionRate: "94%",
      openConversations: conversations.filter(c => c.status === "open").length,
      resolvedConversations: conversations.filter(c => c.status === "resolved").length,
      openTickets: tickets.filter(t => t.status === "open").length,
    };

    res.json(stats);
  });

  // Start inactivity monitoring system
  startInactivityMonitor({ storage, broadcast });

  // Auto-register webhooks for environment variable-based channel integrations
  async function autoRegisterWebhooks() {
    try {
      // Auto-register Telegram webhook if TELEGRAM_BOT_TOKEN is set
      if (process.env.TELEGRAM_BOT_TOKEN) {
        const domain = process.env.REPLIT_DEV_DOMAIN || process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RENDER_EXTERNAL_URL;
        if (domain) {
          const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'https';
          const webhookUrl = `${protocol}://${domain}/api/webhooks/telegram`;
          const telegramApiUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookUrl)}`;
          
          console.log('🔄 Auto-registering Telegram webhook from environment variables...');
          const response = await fetch(telegramApiUrl);
          const data = await response.json();
          
          if (data.ok) {
            console.log('✅ Telegram webhook auto-registered successfully at:', webhookUrl);
          } else {
            console.error('❌ Failed to auto-register Telegram webhook:', data);
          }
        } else {
          console.log('⚠️ TELEGRAM_BOT_TOKEN found but no domain detected. Webhook not registered.');
        }
      }
      
      // Add similar auto-registration for other channels as needed
    } catch (error) {
      console.error('Error auto-registering webhooks:', error);
    }
  }
  
  // Call auto-registration after a brief delay to ensure server is ready
  setTimeout(autoRegisterWebhooks, 3000);

  return httpServer;
}
