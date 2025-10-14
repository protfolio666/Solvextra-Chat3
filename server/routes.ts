import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { generateAIResponse } from "./ai-providers";
import {
  insertConversationSchema,
  insertMessageSchema,
  insertAgentSchema,
  insertTicketSchema,
  insertAISettingsSchema,
  WSMessage,
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

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
  app.get("/api/agents", async (req, res) => {
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

  app.post("/api/agents", async (req, res) => {
    const result = insertAgentSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const agent = await storage.createAgent(result.data);
    broadcast({ type: "status_update", data: { agent } });
    res.json(agent);
  });

  app.patch("/api/agents/:id/status", async (req, res) => {
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
  app.get("/api/settings/ai", async (req, res) => {
    const settings = await storage.getAISettings();
    res.json(settings);
  });

  app.post("/api/settings/ai", async (req, res) => {
    const result = insertAISettingsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    const settings = await storage.upsertAISettings(result.data);
    res.json(settings);
  });

  // Analytics
  app.get("/api/analytics/stats", async (req, res) => {
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
