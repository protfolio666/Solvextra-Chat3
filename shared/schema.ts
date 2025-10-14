import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Channel types
export type Channel = "whatsapp" | "telegram" | "instagram" | "twitter" | "website";
export type ConversationStatus = "open" | "assigned" | "resolved" | "ticket";
export type MessageSender = "customer" | "ai" | "agent";
export type AgentStatus = "available" | "busy" | "offline";
export type AIProvider = "openai" | "gemini" | "openrouter";

// Conversations
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channel: varchar("channel", { length: 20 }).notNull().$type<Channel>(),
  customerName: text("customer_name").notNull(),
  customerAvatar: text("customer_avatar"),
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

// WebSocket message types
export interface WSMessage {
  type: "message" | "status_update" | "typing" | "escalation" | "assignment";
  data: any;
}

export interface TypingIndicator {
  conversationId: string;
  agentName: string;
  isTyping: boolean;
}
