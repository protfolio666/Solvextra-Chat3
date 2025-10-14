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
  Channel,
  WSMessage,
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
    broadcast({ type: "message", data: { message } });

    // If message is from customer, generate AI response
    if (message.sender === "customer") {
      const conversation = await storage.getConversation(message.conversationId);
      
      if (conversation && conversation.status === "open") {
        const aiSettings = await storage.getAISettings();
        
        if (aiSettings?.enabled) {
          try {
            const aiResponse = await generateAIResponse(message.content, {
              provider: aiSettings.provider,
              knowledgeBase: aiSettings.knowledgeBase,
              systemPrompt: aiSettings.systemPrompt,
            });

            const aiMessage = await storage.createMessage({
              conversationId: message.conversationId,
              sender: "ai",
              senderName: "AI Assistant",
              content: aiResponse.content,
            });

            broadcast({ type: "message", data: { message: aiMessage } });
          } catch (error) {
            console.error("AI response error:", error);
          }
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
    const result = insertAgentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const agent = await storage.createAgent(result.data);
    broadcast({ type: "status_update", data: { agent } });
    res.json(agent);
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
        
        // Auto-respond with AI (if enabled)
        const aiSettings = await storage.getAISettings();
        if (aiSettings?.enabled) {
          console.log('Generating AI response...');
          const aiResponse = await generateAIResponse(conversation.id, message.text, aiSettings);
          
          if (aiResponse) {
            // Save AI response
            await storage.createMessage({
              conversationId: conversation.id,
              sender: "ai",
              senderName: "AI Assistant",
              content: aiResponse,
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
                  text: aiResponse,
                }),
              });
              console.log('AI response sent to Telegram');
            }
            
            // Broadcast AI response via WebSocket
            broadcast({
              type: "message",
              data: {
                conversationId: conversation.id,
                sender: "ai",
                content: aiResponse,
              },
            });
          }
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
