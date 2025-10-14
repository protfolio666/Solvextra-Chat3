import {
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  Agent,
  InsertAgent,
  Ticket,
  InsertTicket,
  AISettings,
  InsertAISettings,
  AIProvider,
  AgentStatus,
  User,
  InsertUser,
  KnowledgeFile,
  InsertKnowledgeFile,
} from "@shared/schema";
import { randomUUID } from "crypto";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // Conversations
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation | undefined>;

  // Messages
  getMessages(conversationId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Agents
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  getAvailableAgent(): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgentStatus(id: string, status: AgentStatus): Promise<Agent | undefined>;
  updateAgentConversations(id: string, delta: number): Promise<Agent | undefined>;

  // Tickets
  getTickets(): Promise<Ticket[]>;
  getTicket(id: string): Promise<Ticket | undefined>;
  createTicket(ticket: InsertTicket): Promise<Ticket>;
  updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | undefined>;

  // AI Settings
  getAISettings(): Promise<AISettings | undefined>;
  upsertAISettings(settings: Partial<InsertAISettings>): Promise<AISettings>;

  // Users (Auth)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Knowledge Files
  getKnowledgeFiles(): Promise<KnowledgeFile[]>;
  createKnowledgeFile(file: InsertKnowledgeFile): Promise<KnowledgeFile>;
  deleteKnowledgeFile(id: string): Promise<boolean>;

  // Session Store
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private agents: Map<string, Agent>;
  private tickets: Map<string, Ticket>;
  private aiSettings: AISettings | undefined;
  private users: Map<number, User>;
  private knowledgeFiles: Map<string, KnowledgeFile>;
  private userIdCounter: number;
  public sessionStore: session.SessionStore;

  constructor() {
    this.conversations = new Map();
    this.messages = new Map();
    this.agents = new Map();
    this.tickets = new Map();
    this.users = new Map();
    this.knowledgeFiles = new Map();
    this.userIdCounter = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    
    // Initialize permanent admin account
    this.initializePermanentAdmin();
  }

  private async initializePermanentAdmin() {
    const { scrypt, randomBytes } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(scrypt);
    
    const password = "Solvextra098$#@";
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    const hashedPassword = `${buf.toString("hex")}.${salt}`;
    
    const permanentAdmin: User = {
      id: 1,
      username: "abhishek@solvextra.com",
      password: hashedPassword,
      role: "admin",
      name: "Abhishek",
      email: "abhishek@solvextra.com",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Abhishek",
      createdAt: new Date(),
    };
    
    this.users.set(1, permanentAdmin);
    this.userIdCounter = 2; // Start from 2 for new users
  }

  private initializeMockData_REMOVED() {
    // Create mock agents
    const mockAgents: Agent[] = [
      {
        id: randomUUID(),
        name: "Sarah Johnson",
        email: "sarah@supporthub.com",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah",
        status: "available",
        activeConversations: 2,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        name: "Michael Chen",
        email: "michael@supporthub.com",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael",
        status: "busy",
        activeConversations: 5,
        createdAt: new Date(),
      },
      {
        id: randomUUID(),
        name: "Emily Rodriguez",
        email: "emily@supporthub.com",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Emily",
        status: "available",
        activeConversations: 1,
        createdAt: new Date(),
      },
    ];

    mockAgents.forEach(agent => this.agents.set(agent.id, agent));

    // Create mock conversations
    const channels: Array<"whatsapp" | "telegram" | "instagram" | "twitter" | "website"> = [
      "whatsapp", "telegram", "instagram", "twitter", "website"
    ];
    
    for (let i = 0; i < 8; i++) {
      const convId = randomUUID();
      const conversation: Conversation = {
        id: convId,
        channel: channels[i % channels.length],
        customerName: `Customer ${String.fromCharCode(65 + i)}`,
        customerAvatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=Customer${i}`,
        status: i % 3 === 0 ? "open" : i % 3 === 1 ? "assigned" : "resolved",
        assignedAgentId: i % 3 === 1 ? Array.from(this.agents.values())[0].id : undefined,
        lastMessageAt: new Date(Date.now() - i * 3600000),
        createdAt: new Date(Date.now() - i * 3600000),
      };
      this.conversations.set(convId, conversation);

      // Add messages for each conversation
      const msgId1 = randomUUID();
      const msg1: Message = {
        id: msgId1,
        conversationId: convId,
        sender: "customer",
        senderName: conversation.customerName,
        content: `Hi, I need help with my order #${1000 + i}`,
        timestamp: new Date(Date.now() - i * 3600000),
      };
      this.messages.set(msgId1, msg1);

      if (i % 3 !== 0) {
        const msgId2 = randomUUID();
        const msg2: Message = {
          id: msgId2,
          conversationId: convId,
          sender: i % 3 === 1 ? "agent" : "ai",
          senderName: i % 3 === 1 ? "Sarah Johnson" : "AI Assistant",
          content: i % 3 === 1 
            ? "I'd be happy to help you with that. Let me check your order details."
            : "I can help you with your order. Could you provide more details about the issue?",
          timestamp: new Date(Date.now() - i * 3600000 + 60000),
        };
        this.messages.set(msgId2, msg2);
      }
    }

    // Create mock tickets
    for (let i = 0; i < 5; i++) {
      const ticketId = randomUUID();
      const ticket: Ticket = {
        id: ticketId,
        conversationId: Array.from(this.conversations.keys())[i],
        title: `Issue with order #${1000 + i}`,
        description: `Customer reported an issue with their recent purchase. Needs immediate attention.`,
        priority: i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low",
        status: i % 2 === 0 ? "open" : "in_progress",
        tat: 60 + i * 15,
        createdAt: new Date(Date.now() - i * 7200000),
        resolvedAt: i % 2 === 1 ? new Date() : undefined,
      };
      this.tickets.set(ticketId, ticket);
    }

    // Initialize AI settings
    this.aiSettings = {
      id: randomUUID(),
      provider: "openai",
      enabled: true,
      knowledgeBase: "We are a customer support platform. We help businesses manage customer conversations across multiple channels.",
      systemPrompt: "You are a helpful customer support assistant. Be professional, friendly, and concise. If you cannot help with a specific request, suggest escalating to a human agent.",
      updatedAt: new Date(),
    };
  }

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime()
    );
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    const id = randomUUID();
    const conversation: Conversation = {
      ...insertConversation,
      id,
      lastMessageAt: new Date(),
      createdAt: new Date(),
    };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation | undefined> {
    const conversation = this.conversations.get(id);
    if (!conversation) return undefined;
    
    const updated = { ...conversation, ...data };
    this.conversations.set(id, updated);
    return updated;
  }

  // Messages
  async getMessages(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(m => m.conversationId === conversationId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const message: Message = {
      ...insertMessage,
      id,
      timestamp: new Date(),
    };
    this.messages.set(id, message);

    // Update conversation's lastMessageAt
    const conversation = this.conversations.get(insertMessage.conversationId);
    if (conversation) {
      conversation.lastMessageAt = new Date();
      this.conversations.set(conversation.id, conversation);
    }

    return message;
  }

  // Agents
  async getAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async getAvailableAgent(): Promise<Agent | undefined> {
    const availableAgents = Array.from(this.agents.values())
      .filter(a => a.status === "available")
      .sort((a, b) => a.activeConversations - b.activeConversations);
    
    return availableAgents[0];
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const id = randomUUID();
    const agent: Agent = {
      ...insertAgent,
      id,
      activeConversations: 0,
      createdAt: new Date(),
    };
    this.agents.set(id, agent);
    return agent;
  }

  async updateAgentStatus(id: string, status: AgentStatus): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    
    agent.status = status;
    this.agents.set(id, agent);
    return agent;
  }

  async updateAgentConversations(id: string, delta: number): Promise<Agent | undefined> {
    const agent = this.agents.get(id);
    if (!agent) return undefined;
    
    agent.activeConversations = Math.max(0, agent.activeConversations + delta);
    this.agents.set(id, agent);
    return agent;
  }

  // Tickets
  async getTickets(): Promise<Ticket[]> {
    return Array.from(this.tickets.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    return this.tickets.get(id);
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    const id = randomUUID();
    const ticket: Ticket = {
      ...insertTicket,
      id,
      createdAt: new Date(),
      resolvedAt: undefined,
    };
    this.tickets.set(id, ticket);
    return ticket;
  }

  async updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | undefined> {
    const ticket = this.tickets.get(id);
    if (!ticket) return undefined;
    
    const updated = { ...ticket, ...data };
    this.tickets.set(id, updated);
    return updated;
  }

  // AI Settings
  async getAISettings(): Promise<AISettings | undefined> {
    return this.aiSettings;
  }

  async upsertAISettings(settings: Partial<InsertAISettings>): Promise<AISettings> {
    if (this.aiSettings) {
      this.aiSettings = {
        ...this.aiSettings,
        ...settings,
        updatedAt: new Date(),
      };
    } else {
      this.aiSettings = {
        id: randomUUID(),
        provider: settings.provider || "openai",
        enabled: settings.enabled ?? true,
        knowledgeBase: settings.knowledgeBase,
        systemPrompt: settings.systemPrompt,
        updatedAt: new Date(),
      };
    }
    return this.aiSettings!;
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = {
      ...user,
      id: this.userIdCounter++,
      createdAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    // Prevent deletion of permanent admin (ID: 1)
    if (id === 1) {
      throw new Error("Cannot delete permanent admin account");
    }
    return this.users.delete(id);
  }

  // Knowledge Files
  async getKnowledgeFiles(): Promise<KnowledgeFile[]> {
    return Array.from(this.knowledgeFiles.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  async createKnowledgeFile(file: InsertKnowledgeFile): Promise<KnowledgeFile> {
    const newFile: KnowledgeFile = {
      ...file,
      id: randomUUID(),
      createdAt: new Date(),
    };
    this.knowledgeFiles.set(newFile.id, newFile);
    return newFile;
  }

  async deleteKnowledgeFile(id: string): Promise<boolean> {
    return this.knowledgeFiles.delete(id);
  }
}

export const storage = new MemStorage();
