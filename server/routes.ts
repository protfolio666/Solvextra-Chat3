import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { generateAIResponse } from "./ai-providers";
import { setupAuth } from "./auth";
import { requireAdmin } from "./middleware/role-check";
import {
  insertConversationSchema,
  insertMessageSchema,
  insertAgentSchema,
  insertTicketSchema,
  insertAISettingsSchema,
  insertKnowledgeFileSchema,
  insertChannelIntegrationSchema,
  insertCsatRatingSchema,
  Channel,
  WSMessage,
  Conversation,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Setup authentication
  setupAuth(app);

  // WebSocket server for real-time messaging
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store active WebSocket connections
  const clients = new Map<string, WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    const clientId = Math.random().toString(36).substring(7);
    clients.set(clientId, ws);

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
        // Assign to agent with lowest active conversations
        const agentWithLeastLoad = availableAgents.reduce((min, agent) => 
          agent.activeConversations < min.activeConversations ? agent : min
        );
        
        // Update conversation status and assign agent
        await storage.updateConversation(conversationId, {
          status: "assigned",
          assignedAgentId: agentWithLeastLoad.id,
        });
        
        // Increment agent's active conversation count
        await storage.updateAgentConversations(agentWithLeastLoad.id, 1);
        
        console.log(`✅ Conversation assigned to agent ${agentWithLeastLoad.name}`);
        
        // Broadcast assignment
        broadcast({
          type: "assignment",
          data: {
            conversationId,
            agentId: agentWithLeastLoad.id,
            agentName: agentWithLeastLoad.name,
          },
        });
        
        return { success: true, assignedTo: "agent", agentName: agentWithLeastLoad.name };
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
    broadcast({ type: "message", data: { message } });

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
            const aiResponse = await generateAIResponse(message.content, {
              provider: aiSettings.provider,
              knowledgeBase: aiSettings.knowledgeBase || undefined,
              systemPrompt: aiSettings.systemPrompt || undefined,
              model: aiSettings.model || undefined,
            });

            const aiMessage = await storage.createMessage({
              conversationId: message.conversationId,
              sender: "ai",
              senderName: "AI Assistant",
              content: aiResponse.content,
            });

            broadcast({ type: "message", data: { message: aiMessage } });
            
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
            
            // Check if AI response indicates need for human assistance
            const needsEscalation = /(?:human agent|speak to someone|can't help|unable to assist|need more help|complex issue|escalate)/i.test(aiResponse.content);
            
            if (needsEscalation) {
              console.log('🔔 AI detected need for human assistance');
              await handleSmartEscalation(message.conversationId, "AI detected customer needs human assistance");
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

  // Escalation
  app.post("/api/conversations/:id/escalate", async (req, res) => {
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Find available agent
    const agent = await storage.getAvailableAgent();

    if (agent) {
      // Assign to agent
      const updated = await storage.updateConversation(conversation.id, {
        status: "assigned",
        assignedAgentId: agent.id,
      });

      await storage.updateAgentConversations(agent.id, 1);
      
      broadcast({ type: "escalation", data: { conversation: updated, agent } });
      res.json({ conversation: updated, agent });
    } else {
      // No agents available - create ticket
      const ticket = await storage.createTicket({
        conversationId: conversation.id,
        title: `Support needed for ${conversation.customerName}`,
        description: "Customer needs assistance. No agents currently available.",
        priority: "medium",
        status: "open",
        tat: 60,
      });

      const updated = await storage.updateConversation(conversation.id, {
        status: "ticket",
      });

      broadcast({ type: "escalation", data: { conversation: updated, ticket } });
      res.json({ conversation: updated, ticket });
    }
  });

  // Agents
  app.get("/api/agents", requireAdmin, async (req, res) => {
    const agents = await storage.getAgents();
    res.json(agents);
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

  app.patch("/api/agents/:id/status", requireAdmin, async (req, res) => {
    const { status } = req.body;
    const agent = await storage.updateAgentStatus(req.params.id, status);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    broadcast({ type: "status_update", data: { agent } });
    res.json(agent);
  });

  // Tickets
  app.get("/api/tickets", async (req, res) => {
    const tickets = await storage.getTickets();
    res.json(tickets);
  });

  app.post("/api/tickets", async (req, res) => {
    const result = insertTicketSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const ticket = await storage.createTicket(result.data);
    res.json(ticket);
  });

  app.patch("/api/tickets/:id", async (req, res) => {
    const ticket = await storage.updateTicket(req.params.id, req.body);
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    res.json(ticket);
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
      // Send CSAT request message to customer
      await sendCsatRequest(conversation, ticket.id);
    }

    res.json(updatedTicket);
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
    });

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
  });

  // Close Conversation/Ticket without CSAT (only for ticket status)
  app.post("/api/conversations/:id/close", async (req, res) => {
    const conversation = await storage.getConversation(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Only allow closing tickets without CSAT
    if (conversation.status !== "ticket") {
      return res.status(400).json({ error: "Can only close conversations that are tickets. Use resolve endpoint for regular conversations." });
    }

    // Update conversation status to resolved
    const updatedConversation = await storage.updateConversation(req.params.id, {
      status: "resolved",
    });

    // Find and update associated ticket
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

  // Submit CSAT Rating (from customer)
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
    const settings = await storage.upsertAISettings(result.data);
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
        let conversation = (await storage.getConversations()).find(
          c => c.channel === "telegram" && c.customerName === customerName
        );
        
        if (!conversation) {
          console.log('Creating new conversation for', customerName);
          conversation = await storage.createConversation({
            channel: "telegram",
            customerName,
            customerAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${customerName}`,
            channelUserId: message.chat.id.toString(), // Store Telegram chat_id
            status: "open",
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
        
        // Broadcast via WebSocket
        broadcast({
          type: "message",
          data: {
            conversationId: conversation.id,
            sender: "customer",
            content: message.text,
          },
        });
        
        // Auto-respond with AI (if enabled and conversation not already assigned to agent)
        const aiSettings = await storage.getAISettings();
        if (conversation.status === "open") {
          if (aiSettings?.enabled) {
            console.log('Generating AI response with provider:', aiSettings.provider);
            const aiResponse = await generateAIResponse(message.text || "", {
              provider: aiSettings.provider,
              knowledgeBase: aiSettings.knowledgeBase || undefined,
              systemPrompt: aiSettings.systemPrompt || undefined,
            });
            
            if (aiResponse?.content) {
              // Save AI response
              await storage.createMessage({
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
              
              // Broadcast AI response via WebSocket
              broadcast({
                type: "message",
                data: {
                  conversationId: conversation.id,
                  sender: "ai",
                  content: aiResponse.content,
                },
              });
              
              // Check if AI response indicates need for human assistance
              const needsEscalation = /(?:human agent|speak to someone|can't help|unable to assist|need more help|complex issue|escalate)/i.test(aiResponse.content);
              
              if (needsEscalation) {
                console.log('🔔 AI detected need for human assistance');
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
        } else if (conversation.status === "resolved") {
          // Customer returned after resolution - reopen and assign to available agent
          console.log('🔄 Customer returned after resolution - reopening conversation');
          
          // Update last message time first
          await storage.updateConversation(conversation.id, {
            lastMessageAt: new Date(),
          });
          
          // Reopen conversation and assign to available agent (this will set status to "assigned" or "ticket")
          const escalationResult = await handleSmartEscalation(conversation.id, "Customer returned after resolution");
          
          // Send notification to customer on Telegram
          const telegramIntegration = await storage.getChannelIntegration("telegram");
          if (telegramIntegration?.apiToken) {
            const sendMessageUrl = `https://api.telegram.org/bot${telegramIntegration.apiToken}/sendMessage`;
            let responseText = "";
            
            if (escalationResult?.assignedTo === "agent") {
              responseText = `Welcome back! An agent will assist you shortly.`;
            } else if (escalationResult?.assignedTo === "ticket") {
              responseText = `Thank you for contacting us again! We've created a support ticket for you. Our team will respond within 24 hours.`;
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
              console.log('✅ Reopening notification sent to Telegram');
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

  return httpServer;
}
