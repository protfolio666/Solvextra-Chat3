# Omnichannel Customer Support Platform

## Overview

This omnichannel customer support platform unifies customer conversations from various channels (WhatsApp, Telegram, Instagram, Twitter, Website) into a single inbox. It features role-based authentication (Admin/Agent), AI-powered automated responses with intelligent escalation, comprehensive ticket management, a knowledge base with file upload capabilities, and real-time analytics. The platform aims to enhance information clarity, accelerate conversation processing, and improve customer satisfaction through features like CSAT rating collection, email notifications, and data export. It is inspired by leading industry solutions to provide an efficient and comprehensive customer support experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built with React 18 and TypeScript, utilizing Vite for development and bundling. It employs Wouter for client-side routing and TanStack Query for server state management. UI components are crafted using Shadcn/ui with Radix UI primitives for accessibility, styled with Tailwind CSS, and support light/dark modes. The design prioritizes information density and user productivity, drawing inspiration from platforms like Intercom and Zendesk. Real-time updates are handled via WebSocket integration with React Query.

### Backend Architecture

The backend is developed with Express.js, TypeScript, and Node.js, featuring a RESTful API and a WebSocket server for real-time communication. Drizzle ORM with PostgreSQL manages type-safe database operations, complemented by Zod for runtime validation. An in-memory storage layer (MemStorage) abstracts data handling. The database schema includes tables for `conversations`, `messages`, `agents`, `tickets` (with unique sequential IDs), `ai_settings`, `users`, `knowledge_files`, `email_settings`, `email_replies` (customer email responses with attachments), and `csat_ratings`, along with a PostgreSQL sequence for ticket numbering.

### AI Integration Layer

The platform features a multi-provider AI architecture supporting OpenAI, Google Gemini, and OpenRouter (including models like DeepSeek V3), with a unified interface for response generation. It includes configurable system prompts and knowledge base injection. The AI automatically incorporates metadata from uploaded knowledge files (filenames and upload dates) into its context to reference available resources. The AI handles initial customer interactions, with an intelligent escalation system for human agent intervention or ticket creation with defined Turn Around Times (TATs). The AI also supports auto-closure of chats based on customer satisfaction and inactivity, along with CSAT survey distribution.

### System Features

-   **Authentication & Authorization**: Role-Based Access Control (Admin/Agent) with protected routes and server-side authorization using Passport.js.
-   **Channel Integration**: Supports Web Chat Widget, WhatsApp, Telegram, Instagram, and Twitter with dual configuration (UI + environment variables for cloud deployment). Auto-registers Telegram webhooks on startup when configured via environment variables.
-   **Agent Status Management**: 5-tier status system (Available, Break, Training, Floor Support, Not Available) with self-service controls for agents and admin override capabilities. Only "available" agents receive auto-assignments and can accept chats.
-   **Auto-Assignment & Escalation**: A 30-second "pending_acceptance" window for escalated chats, allowing available agents to accept (first-accept-first-serve) with sound notifications. Chats are hidden from agents after the window but remain visible to admins.
-   **Chat Transfer**: Admins can manually transfer chats between agents with visual warnings when assigning to non-available agents, instantly updating agent visibility.
-   **AI Conversation Memory**: AI maintains context of the last 5 messages for coherent multi-turn dialogues across all providers.
-   **Ticket Management**: Comprehensive system for creating, editing, and managing tickets with unique IDs, priority, TAT, and status. Complete audit trail tracking all ticket lifecycle events including creation details, status changes, and email interactions.
-   **Email Reply Capture**: Webhook integration with SendGrid Inbound Parse to capture customer email replies with image attachments. Replies are stored in the database and displayed in the ticket audit trail with attachment previews.
-   **Knowledge Base**: Supports file uploads (documents, PDFs, images) as data URLs with a management UI.
-   **Email Notifications**: Integrates with SendGrid for configurable email notifications on ticket events and CSAT surveys. Supports custom resolution emails with agent-written messages.
-   **CSAT Management**: Collects 1-5 star customer satisfaction ratings with automated thank-you messages and provides an admin dashboard for analytics.
-   **Export & Analytics**: Admin-only feature for exporting conversation data to CSV with filtering and message analytics.
-   **Agent Monitoring Dashboard**: Admin-only page providing real-time agent activity, including active chat counts, handling time, and manual chat transfer functionality.
-   **Admin Controls**: Admins can override agent status and reset agent passwords directly from the agents management page.

## External Dependencies

-   **AI Services**: OpenAI API (GPT-5), Google Gemini API (2.5-flash/2.5-pro series), OpenRouter (e.g., DeepSeek V3).
-   **Database**: PostgreSQL via Neon serverless driver, utilizing Drizzle Kit for migrations.
-   **UI Libraries**: Radix UI primitives, React Icons, Lucide React, `date-fns`.
-   **Session Management**: `connect-pg-simple` for PostgreSQL session storage.
-   **Email Service**: SendGrid for transactional emails.
-   **Channel Integration Points**: WhatsApp Business API, Telegram Bot API, Instagram Graph API, Twitter/X API.