# Omnichannel Customer Support Platform

## Overview

An omnichannel customer support platform that unifies conversations from multiple channels (WhatsApp, Telegram, Instagram, Twitter, Website) into a single inbox. The system features AI-powered automated responses with intelligent escalation to human agents, comprehensive ticket management, and real-time analytics. Built with a focus on information clarity and rapid conversation processing, inspired by industry leaders like Intercom and Zendesk.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework & Build System:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server with HMR support
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and caching

**UI Component Strategy:**
- Shadcn/ui component library with Radix UI primitives for accessibility
- Tailwind CSS for utility-first styling with custom design tokens
- Theme system supporting light/dark modes with persistent preferences
- Design approach follows Intercom/Zendesk patterns prioritizing information density and productivity

**State Management:**
- React Query for all server state with infinite stale time and disabled auto-refetch
- Local component state using React hooks
- WebSocket integration for real-time updates that trigger query invalidation
- Custom hooks pattern for reusable logic (useWebSocket, useToast, useIsMobile)

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript running on Node.js
- HTTP server wrapped with WebSocket server for real-time bidirectional communication
- RESTful API design with conventional CRUD operations
- Middleware chain for JSON parsing, logging, and error handling

**Real-time Communication:**
- WebSocket server (ws library) on `/ws` path for live message broadcasting
- Automatic reconnection logic on client side
- Message-based protocol with typed events (message, status_update, escalation)
- Broadcasts trigger React Query cache invalidation for reactive UI updates

**Data Layer:**
- Drizzle ORM with PostgreSQL dialect for type-safe database operations
- Schema-first approach using Drizzle's table definitions
- Zod schema integration for runtime validation via drizzle-zod
- In-memory storage implementation (MemStorage) as abstraction layer, designed to be swapped with database implementation

**Database Schema Design:**
- `conversations` table: Tracks customer conversations across channels with status workflow
- `messages` table: Stores all messages with sender type (customer/ai/agent)
- `agents` table: Manages support agents with status and workload tracking
- `tickets` table: Escalated issues with priority levels and SLA tracking (TAT - Turn Around Time)
- `ai_settings` table: Configurable AI provider settings and knowledge base

### AI Integration Layer

**Multi-Provider Architecture:**
- Abstraction layer supporting OpenAI, Google Gemini, and OpenRouter
- Provider-agnostic response generation with unified interface
- Configurable system prompts and knowledge base injection
- Default model: GPT-5 for OpenAI, Gemini 2.5 series for Google

**AI Response Flow:**
1. Customer message received via WebSocket or API
2. AI settings fetched to determine active provider and configuration
3. Context assembled from system prompt and knowledge base
4. Provider-specific API called with conversation context
5. Response generated and sent back through message pipeline
6. Automatic escalation triggers if AI cannot resolve

**Escalation Logic:**
- AI-to-agent handoff when conversation cannot be resolved automatically
- Available agent selection based on current workload and status
- Ticket creation for complex issues requiring follow-up
- Status transitions: open → assigned → resolved/ticket

### External Dependencies

**AI Services:**
- OpenAI API (GPT-5 model) - Primary AI response generation
- Google Gemini API (2.5-flash/2.5-pro series) - Alternative AI provider
- API keys configured via environment variables (OPENAI_API_KEY, GEMINI_API_KEY)

**Database:**
- PostgreSQL via Neon serverless driver (@neondatabase/serverless)
- Connection string from DATABASE_URL environment variable
- Drizzle Kit for schema migrations in `./migrations` directory

**UI Libraries:**
- Radix UI primitives for 20+ accessible components (dialog, dropdown, popover, etc.)
- React Icons (react-icons/si) for social media channel badges
- Lucide React for general iconography
- date-fns for timestamp formatting and relative time display

**Session Management:**
- connect-pg-simple for PostgreSQL session store
- Express session middleware (implied but not shown in files)

**Development Tools:**
- Replit-specific plugins for runtime error overlay and dev banner
- ESBuild for production bundling with ESM output
- TypeScript with strict mode and path aliases (@/, @shared, @assets)

**Channel Integration Points:**
- WhatsApp, Telegram, Instagram, Twitter, Website chat widget (integration endpoints not implemented in shown code)
- Unified message normalization layer to abstract channel-specific formats
- Channel type stored with each conversation for routing and display