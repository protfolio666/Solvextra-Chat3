# Omnichannel Customer Support Platform

## Overview

An omnichannel customer support platform designed to unify customer conversations from various channels (WhatsApp, Telegram, Instagram, Twitter, Website) into a single inbox. The platform supports role-based authentication (Admin/Agent), features AI-powered automated responses with intelligent escalation to human agents, and provides comprehensive ticket management, a knowledge base with file upload capabilities, and real-time analytics. Its core purpose is to enhance information clarity and accelerate conversation processing, drawing inspiration from leading industry solutions. The platform also includes advanced features like CSAT rating collection, email notifications, and comprehensive data export functionalities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18 and TypeScript, using Vite for development and bundling. Wouter handles client-side routing, and TanStack Query manages server state. UI components are developed using Shadcn/ui with Radix UI primitives for accessibility, styled with Tailwind CSS, and support light/dark modes. The design emphasizes information density and productivity, akin to Intercom and Zendesk. React Query manages server state with WebSocket integration for real-time updates.

### Backend Architecture

The backend uses Express.js with TypeScript and Node.js, featuring a RESTful API and a WebSocket server for real-time communication. Drizzle ORM with PostgreSQL is used for type-safe database operations, supported by Zod for runtime validation. An in-memory storage (MemStorage) acts as an abstraction layer for data. The database schema includes `conversations`, `messages`, `agents`, `tickets` (with unique sequential IDs), `ai_settings`, `users`, `knowledge_files`, `email_settings`, and `csat_ratings` tables, along with a PostgreSQL sequence for ticket numbers.

### AI Integration Layer

The platform features a multi-provider AI architecture supporting OpenAI, Google Gemini, and OpenRouter (with free models like DeepSeek V3), with a unified interface for response generation. It includes configurable system prompts and knowledge base injection. The AI automatically receives metadata from uploaded knowledge files (filenames and upload dates) in its context, enabling it to reference available resources when responding to customers. The AI handles initial customer messages, and an intelligent escalation system automatically detects when human intervention is needed, assigning conversations to available agents or creating tickets with defined TATs.

**Note on Knowledge File Text Extraction**: Currently, the AI receives file names and metadata but cannot automatically extract text from PDF, Excel, or Word documents. For full text extraction, install these packages: `pdf-parse` (for PDFs), `xlsx` (for Excel), and `mammoth` (for Word documents). Admins can manually add key information from these files to the Knowledge Base text field as a workaround.

### System Features

- **Authentication & Authorization**: Role-Based Access Control (Admin/Agent) with protected routes and server-side authorization using Passport.js.
- **Channel Integration**: Supports Web Chat Widget, WhatsApp, Telegram, Instagram, and Twitter with platform-specific authentication and auto-webhook registration.
- **30-Second Auto-Assignment**: When AI escalates a conversation, it enters "pending_acceptance" status with a 30-second window. All available agents can see and accept the chat (first-accept-first-serve). After 30 seconds, the chat is hidden from agents but remains visible to admin for manual assignment. Includes sound notifications (doorbell for new chats, beep for messages).
- **Smart Chat Transfer**: When admin transfers a chat to another agent, the previous agent loses visibility. Agents only see: (1) open chats handled by AI, (2) pending acceptance chats within 30 seconds, (3) chats specifically assigned to them. Admin sees all chats.
- **AI Conversation Memory**: AI maintains context of the last 5 messages in each conversation for all providers (OpenAI, Gemini, OpenRouter), enabling coherent multi-turn dialogues.
- **Ticket Management**: Features unique ticket numbers, issue details, internal notes, priority, TAT, and status management (create, edit, re-open, filter).
- **Knowledge Base**: Allows file uploads (documents, PDFs, images) with management UI, storing files as data URLs.
- **Email Notifications**: Integrates with SendGrid for configurable email notifications on ticket creation, resolution, and CSAT survey distribution.
- **CSAT Management**: Collects customer satisfaction ratings (1-5 stars) with automated thank-you messages, and provides an admin dashboard for analytics and feedback.
- **Export & Analytics**: An admin-only page for exporting conversation data to CSV, with advanced filtering and message analytics.
- **Agent Monitoring Dashboard**: Admin-only page displaying real-time agent activity including: (1) which agent is handling which customer, (2) active chat counts per agent, (3) handling time tracking per conversation and agent, (4) manual chat transfer functionality to reassign conversations to any available agent. When a chat is transferred, the previous agent immediately loses visibility.

## External Dependencies

- **AI Services**: OpenAI API (GPT-5), Google Gemini API (2.5-flash/2.5-pro series), and OpenRouter (provides access to free models like DeepSeek V3).
- **Database**: PostgreSQL via Neon serverless driver, with Drizzle Kit for migrations.
- **UI Libraries**: Radix UI primitives, React Icons, Lucide React, and `date-fns`.
- **Session Management**: `connect-pg-simple` for PostgreSQL session storage.
- **Email Service**: SendGrid for transactional emails.
- **Channel Integration Points**: WhatsApp Business API, Telegram Bot API, Instagram Graph API, Twitter/X API.