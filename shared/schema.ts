import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Channel types
export type Channel = "whatsapp" | "telegram" | "instagram" | "twitter" | "website";
export type ConversationStatus = "open" | "assigned" | "resolved" | "ticket";
export type MessageSender = "customer" | "ai" | "agent";
export type AgentStatus = "available" | "busy" | "offline";
export type AIProvider = "openai" | "gemini" | "openrouter";
export type UserRole = "admin" | "agent";

// Conversations
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channel: varchar("channel", { length: 20 }).notNull().$type<Channel>(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email"),
  customerPhone: text("customer_phone"),
  customerAvatar: text("customer_avatar"),
  channelUserId: text("channel_user_id"), // External ID (Telegram chat_id, WhatsApp number, etc.)
  status: varchar("status", { length: 20 }).notNull().default("open").$type<ConversationStatus>(),
  assignedAgentId: varchar("assigned_agent_id"),
  lastMessageAt: timestamp("last_message_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Messages
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  sender: varchar("sender", { length: 20 }).notNull().$type<MessageSender>(),
  senderName: text("sender_name"),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  timestamp: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Agents
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatar: text("avatar"),
  status: varchar("status", { length: 20 }).notNull().default("offline").$type<AgentStatus>(),
  activeConversations: integer("active_conversations").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  activeConversations: true,
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Tickets
export const tickets = pgTable("tickets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  priority: varchar("priority", { length: 20 }).notNull().default("medium"),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  tat: integer("tat").notNull(), // Turn Around Time in minutes
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
  createdAt: true,
});

export type InsertTicket = z.infer<typeof insertTicketSchema>;
export type Ticket = typeof tickets.$inferSelect;

// AI Settings
export const aiSettings = pgTable("ai_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: varchar("provider", { length: 20 }).notNull().$type<AIProvider>(),
  enabled: boolean("enabled").notNull().default(true),
  paused: boolean("paused").notNull().default(false),
  model: text("model"), // For OpenRouter: "openai/gpt-4o-mini" or "anthropic/claude-3.5-sonnet"
  knowledgeBase: text("knowledge_base"),
  systemPrompt: text("system_prompt"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAISettingsSchema = createInsertSchema(aiSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertAISettings = z.infer<typeof insertAISettingsSchema>;
export type AISettings = typeof aiSettings.$inferSelect;

// Users (for authentication)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("agent").$type<UserRole>(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Knowledge Base Files
export const knowledgeFiles = pgTable("knowledge_files", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  uploadedBy: integer("uploaded_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertKnowledgeFileSchema = createInsertSchema(knowledgeFiles).omit({
  id: true,
  createdAt: true,
});

export type InsertKnowledgeFile = z.infer<typeof insertKnowledgeFileSchema>;
export type KnowledgeFile = typeof knowledgeFiles.$inferSelect;

// Channel Integrations
export const channelIntegrations = pgTable("channel_integrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channel: varchar("channel", { length: 20 }).notNull().unique().$type<Channel>(),
  enabled: boolean("enabled").notNull().default(false),
  // Telegram, WhatsApp use apiToken
  apiToken: text("api_token"),
  // Meta/Instagram use appId + appSecret
  appId: text("app_id"),
  appSecret: text("app_secret"),
  // Twitter/X use clientId + clientSecret
  clientId: text("client_id"),
  clientSecret: text("client_secret"),
  webhookUrl: text("webhook_url"),
  config: text("config"), // JSON string for additional config
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertChannelIntegrationSchema = createInsertSchema(channelIntegrations).omit({
  id: true,
  updatedAt: true,
});

export type InsertChannelIntegration = z.infer<typeof insertChannelIntegrationSchema>;
export type ChannelIntegration = typeof channelIntegrations.$inferSelect;

// CSAT Ratings
export const csatRatings = pgTable("csat_ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  ticketId: varchar("ticket_id"),
  rating: integer("rating").notNull(), // 1-5 stars
  feedback: text("feedback"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCsatRatingSchema = createInsertSchema(csatRatings).omit({
  id: true,
  createdAt: true,
});

export type InsertCsatRating = z.infer<typeof insertCsatRatingSchema>;
export type CsatRating = typeof csatRatings.$inferSelect;

// Email Settings (SendGrid)
export const emailSettings = pgTable("email_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sendgridApiKey: text("sendgrid_api_key"),
  senderEmail: text("sender_email"),
  senderName: text("sender_name").default("Solvextra Support"),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailSettingsSchema = createInsertSchema(emailSettings).omit({
  id: true,
  updatedAt: true,
});

export type InsertEmailSettings = z.infer<typeof insertEmailSettingsSchema>;
export type EmailSettings = typeof emailSettings.$inferSelect;

// WebSocket message types
export interface WSMessage {
  type: "message" | "status_update" | "typing" | "escalation" | "assignment" | "admin_notification" | "csat_request";
  data: any;
}

export interface TypingIndicator {
  conversationId: string;
  agentName: string;
  isTyping: boolean;
}
