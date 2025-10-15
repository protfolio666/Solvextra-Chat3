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
  ChannelIntegration,
  InsertChannelIntegration,
  Channel,
  CsatRating,
  InsertCsatRating,
  EmailSettings,
  InsertEmailSettings,
  conversations,
  messages,
  agents,
  tickets,
  aiSettings,
  users,
  knowledgeFiles,
  channelIntegrations,
  csatRatings,
  emailSettings,
} from "@shared/schema";
import { randomUUID } from "crypto";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPgSimple from "connect-pg-simple";
import { db } from "./db";
import { eq, desc, asc, and, sql } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PgSession = connectPgSimple(session);

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

  // Channel Integrations
  getChannelIntegrations(): Promise<ChannelIntegration[]>;
  getChannelIntegration(channel: Channel): Promise<ChannelIntegration | undefined>;
  upsertChannelIntegration(integration: InsertChannelIntegration): Promise<ChannelIntegration>;

  // CSAT Ratings
  createCsatRating(rating: InsertCsatRating): Promise<CsatRating>;
  getCsatRatings(conversationId?: string, ticketId?: string): Promise<CsatRating[]>;

  // Email Settings
  getEmailSettings(): Promise<EmailSettings | undefined>;
  upsertEmailSettings(settings: Partial<InsertEmailSettings>): Promise<EmailSettings>;

  // Session Store
  sessionStore: session.Store;
}

export class DbStorage implements IStorage {
  public sessionStore: session.Store;

  constructor() {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    this.sessionStore = new PgSession({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true,
    });

    this.initializePermanentAdmin();
  }

  private async initializePermanentAdmin() {
    try {
      const existingAdmin = await db
        .select()
        .from(users)
        .where(eq(users.id, 1))
        .limit(1);

      if (existingAdmin.length === 0) {
        const { scrypt, randomBytes } = await import("crypto");
        const { promisify } = await import("util");
        const scryptAsync = promisify(scrypt);

        const password = "Solvextra098$#@";
        const salt = randomBytes(16).toString("hex");
        const buf = (await scryptAsync(password, salt, 64)) as Buffer;
        const hashedPassword = `${buf.toString("hex")}.${salt}`;

        await db.insert(users).values({
          id: 1,
          username: "abhishek@solvextra.com",
          password: hashedPassword,
          role: "admin",
          name: "Abhishek",
          email: "abhishek@solvextra.com",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Abhishek",
        } as any);

        // Reset the sequence to start from 2 (after admin's ID=1)
        await db.execute(sql`SELECT setval('users_id_seq', 2, false)`);

        console.log("Permanent admin account initialized");
      }
    } catch (error) {
      console.error("Error initializing permanent admin:", error);
    }
  }

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    try {
      return await db
        .select()
        .from(conversations)
        .orderBy(desc(conversations.lastMessageAt));
    } catch (error) {
      console.error("Error getting conversations:", error);
      return [];
    }
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    try {
      const result = await db
        .select()
        .from(conversations)
        .where(eq(conversations.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting conversation:", error);
      return undefined;
    }
  }

  async createConversation(insertConversation: InsertConversation): Promise<Conversation> {
    try {
      const result = await db
        .insert(conversations)
        .values(insertConversation as any)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation | undefined> {
    try {
      const result = await db
        .update(conversations)
        .set(data)
        .where(eq(conversations.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating conversation:", error);
      return undefined;
    }
  }

  // Messages
  async getMessages(conversationId: string): Promise<Message[]> {
    try {
      return await db
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conversationId))
        .orderBy(asc(messages.timestamp));
    } catch (error) {
      console.error("Error getting messages:", error);
      return [];
    }
  }

  async createMessage(insertMessage: InsertMessage): Promise<Message> {
    try {
      const result = await db
        .insert(messages)
        .values(insertMessage as any)
        .returning();

      await db
        .update(conversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(conversations.id, insertMessage.conversationId));

      return result[0];
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  }

  // Agents
  async getAgents(): Promise<Agent[]> {
    try {
      return await db.select().from(agents);
    } catch (error) {
      console.error("Error getting agents:", error);
      return [];
    }
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    try {
      const result = await db
        .select()
        .from(agents)
        .where(eq(agents.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting agent:", error);
      return undefined;
    }
  }

  async getAvailableAgent(): Promise<Agent | undefined> {
    try {
      const result = await db
        .select()
        .from(agents)
        .where(eq(agents.status, "available"))
        .orderBy(asc(agents.activeConversations))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting available agent:", error);
      return undefined;
    }
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    try {
      const result = await db
        .insert(agents)
        .values(insertAgent as any)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating agent:", error);
      throw error;
    }
  }

  async updateAgentStatus(id: string, status: AgentStatus): Promise<Agent | undefined> {
    try {
      const result = await db
        .update(agents)
        .set({ status })
        .where(eq(agents.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating agent status:", error);
      return undefined;
    }
  }

  async updateAgentConversations(id: string, delta: number): Promise<Agent | undefined> {
    try {
      const agent = await this.getAgent(id);
      if (!agent) return undefined;

      const newCount = Math.max(0, agent.activeConversations + delta);
      const result = await db
        .update(agents)
        .set({ activeConversations: newCount })
        .where(eq(agents.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating agent conversations:", error);
      return undefined;
    }
  }

  // Tickets
  async getTickets(): Promise<Ticket[]> {
    try {
      return await db
        .select()
        .from(tickets)
        .orderBy(desc(tickets.createdAt));
    } catch (error) {
      console.error("Error getting tickets:", error);
      return [];
    }
  }

  async getTicket(id: string): Promise<Ticket | undefined> {
    try {
      const result = await db
        .select()
        .from(tickets)
        .where(eq(tickets.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting ticket:", error);
      return undefined;
    }
  }

  async createTicket(insertTicket: InsertTicket): Promise<Ticket> {
    try {
      const result = await db
        .insert(tickets)
        .values(insertTicket as any)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating ticket:", error);
      throw error;
    }
  }

  async updateTicket(id: string, data: Partial<Ticket>): Promise<Ticket | undefined> {
    try {
      const result = await db
        .update(tickets)
        .set(data)
        .where(eq(tickets.id, id))
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error updating ticket:", error);
      return undefined;
    }
  }

  // AI Settings
  async getAISettings(): Promise<AISettings | undefined> {
    try {
      const result = await db
        .select()
        .from(aiSettings)
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting AI settings:", error);
      return undefined;
    }
  }

  async upsertAISettings(settings: Partial<InsertAISettings>): Promise<AISettings> {
    try {
      const existing = await this.getAISettings();
      
      if (existing) {
        const updateData: any = {
          updatedAt: new Date(),
        };
        if (settings.provider !== undefined) updateData.provider = settings.provider;
        if (settings.enabled !== undefined) updateData.enabled = settings.enabled;
        if (settings.paused !== undefined) updateData.paused = settings.paused;
        if (settings.model !== undefined) updateData.model = settings.model;
        if (settings.knowledgeBase !== undefined) updateData.knowledgeBase = settings.knowledgeBase;
        if (settings.systemPrompt !== undefined) updateData.systemPrompt = settings.systemPrompt;

        const result = await db
          .update(aiSettings)
          .set(updateData)
          .where(eq(aiSettings.id, existing.id))
          .returning();
        return result[0];
      } else {
        const result = await db
          .insert(aiSettings)
          .values({
            provider: settings.provider || "openai",
            enabled: settings.enabled ?? true,
            paused: settings.paused ?? false,
            model: settings.model,
            knowledgeBase: settings.knowledgeBase,
            systemPrompt: settings.systemPrompt,
          } as any)
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error("Error upserting AI settings:", error);
      throw error;
    }
  }

  // Users
  async getUser(id: number): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting user by username:", error);
      return undefined;
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const result = await db
        .insert(users)
        .values(user as any)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  // Knowledge Files
  async getKnowledgeFiles(): Promise<KnowledgeFile[]> {
    try {
      return await db
        .select()
        .from(knowledgeFiles)
        .orderBy(desc(knowledgeFiles.createdAt));
    } catch (error) {
      console.error("Error getting knowledge files:", error);
      return [];
    }
  }

  async createKnowledgeFile(file: InsertKnowledgeFile): Promise<KnowledgeFile> {
    try {
      const result = await db
        .insert(knowledgeFiles)
        .values(file as any)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating knowledge file:", error);
      throw error;
    }
  }

  async deleteKnowledgeFile(id: string): Promise<boolean> {
    try {
      const result = await db
        .delete(knowledgeFiles)
        .where(eq(knowledgeFiles.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error("Error deleting knowledge file:", error);
      return false;
    }
  }

  // Channel Integrations
  async getChannelIntegrations(): Promise<ChannelIntegration[]> {
    try {
      return await db.select().from(channelIntegrations);
    } catch (error) {
      console.error("Error getting channel integrations:", error);
      return [];
    }
  }

  async getChannelIntegration(channel: Channel): Promise<ChannelIntegration | undefined> {
    try {
      const result = await db
        .select()
        .from(channelIntegrations)
        .where(eq(channelIntegrations.channel, channel as any))
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting channel integration:", error);
      return undefined;
    }
  }

  async upsertChannelIntegration(integration: InsertChannelIntegration): Promise<ChannelIntegration> {
    try {
      const existing = await this.getChannelIntegration(integration.channel as Channel);

      if (existing) {
        const updateData: any = {
          enabled: integration.enabled,
          updatedAt: new Date(),
        };
        if (integration.apiToken !== undefined) updateData.apiToken = integration.apiToken;
        if (integration.appId !== undefined) updateData.appId = integration.appId;
        if (integration.appSecret !== undefined) updateData.appSecret = integration.appSecret;
        if (integration.clientId !== undefined) updateData.clientId = integration.clientId;
        if (integration.clientSecret !== undefined) updateData.clientSecret = integration.clientSecret;
        if (integration.webhookUrl !== undefined) updateData.webhookUrl = integration.webhookUrl;
        if (integration.config !== undefined) updateData.config = integration.config;

        const result = await db
          .update(channelIntegrations)
          .set(updateData)
          .where(eq(channelIntegrations.channel, integration.channel as any))
          .returning();
        return result[0];
      } else {
        const result = await db
          .insert(channelIntegrations)
          .values(integration as any)
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error("Error upserting channel integration:", error);
      throw error;
    }
  }

  // CSAT Ratings
  async createCsatRating(rating: InsertCsatRating): Promise<CsatRating> {
    try {
      const result = await db
        .insert(csatRatings)
        .values(rating)
        .returning();
      return result[0];
    } catch (error) {
      console.error("Error creating CSAT rating:", error);
      throw error;
    }
  }

  async getCsatRatings(conversationId?: string, ticketId?: string): Promise<CsatRating[]> {
    try {
      let query = db.select().from(csatRatings);
      
      if (conversationId) {
        query = query.where(eq(csatRatings.conversationId, conversationId)) as any;
      }
      if (ticketId) {
        query = query.where(eq(csatRatings.ticketId, ticketId)) as any;
      }

      return await query;
    } catch (error) {
      console.error("Error getting CSAT ratings:", error);
      return [];
    }
  }

  // Email Settings
  async getEmailSettings(): Promise<EmailSettings | undefined> {
    try {
      const result = await db
        .select()
        .from(emailSettings)
        .limit(1);
      return result[0];
    } catch (error) {
      console.error("Error getting email settings:", error);
      return undefined;
    }
  }

  async upsertEmailSettings(settings: Partial<InsertEmailSettings>): Promise<EmailSettings> {
    try {
      const existing = await this.getEmailSettings();
      
      if (existing) {
        const updateData: any = {
          updatedAt: new Date(),
        };
        if (settings.sendgridApiKey !== undefined) updateData.sendgridApiKey = settings.sendgridApiKey;
        if (settings.senderEmail !== undefined) updateData.senderEmail = settings.senderEmail;
        if (settings.senderName !== undefined) updateData.senderName = settings.senderName;
        if (settings.enabled !== undefined) updateData.enabled = settings.enabled;

        const result = await db
          .update(emailSettings)
          .set(updateData)
          .where(eq(emailSettings.id, existing.id))
          .returning();
        return result[0];
      } else {
        const result = await db
          .insert(emailSettings)
          .values({
            sendgridApiKey: settings.sendgridApiKey,
            senderEmail: settings.senderEmail,
            senderName: settings.senderName || "Solvextra Support",
            enabled: settings.enabled ?? false,
          } as any)
          .returning();
        return result[0];
      }
    } catch (error) {
      console.error("Error upserting email settings:", error);
      throw error;
    }
  }
}

// Commented out MemStorage for reference
/*
export class MemStorage implements IStorage {
  private conversations: Map<string, Conversation>;
  private messages: Map<string, Message>;
  private agents: Map<string, Agent>;
  private tickets: Map<string, Ticket>;
  private aiSettings: AISettings | undefined;
  private users: Map<number, User>;
  private knowledgeFiles: Map<string, KnowledgeFile>;
  private channelIntegrations: Map<Channel, ChannelIntegration>;
  private userIdCounter: number;
  public sessionStore: session.SessionStore;

  constructor() {
    this.conversations = new Map();
    this.messages = new Map();
    this.agents = new Map();
    this.tickets = new Map();
    this.users = new Map();
    this.knowledgeFiles = new Map();
    this.channelIntegrations = new Map();
    this.userIdCounter = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
    
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
    this.userIdCounter = 2;
  }

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

    const conversation = this.conversations.get(insertMessage.conversationId);
    if (conversation) {
      conversation.lastMessageAt = new Date();
      this.conversations.set(conversation.id, conversation);
    }

    return message;
  }

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
        paused: settings.paused ?? false,
        model: settings.model,
        knowledgeBase: settings.knowledgeBase,
        systemPrompt: settings.systemPrompt,
        updatedAt: new Date(),
      };
    }
    return this.aiSettings!;
  }

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
    if (id === 1) {
      throw new Error("Cannot delete permanent admin account");
    }
    return this.users.delete(id);
  }

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

  async getChannelIntegrations(): Promise<ChannelIntegration[]> {
    return Array.from(this.channelIntegrations.values());
  }

  async getChannelIntegration(channel: Channel): Promise<ChannelIntegration | undefined> {
    return this.channelIntegrations.get(channel);
  }

  async upsertChannelIntegration(integration: InsertChannelIntegration): Promise<ChannelIntegration> {
    const existing = this.channelIntegrations.get(integration.channel);
    const newIntegration: ChannelIntegration = {
      id: existing?.id || randomUUID(),
      channel: integration.channel,
      enabled: integration.enabled ?? false,
      apiToken: integration.apiToken,
      webhookUrl: integration.webhookUrl,
      config: integration.config,
      updatedAt: new Date(),
    };
    this.channelIntegrations.set(integration.channel, newIntegration);
    return newIntegration;
  }
}
*/

export const storage = new DbStorage();
