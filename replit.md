# Omnichannel Customer Support Platform

## Overview

An omnichannel customer support platform that unifies conversations from multiple channels (WhatsApp, Telegram, Instagram, Twitter, Website) into a single inbox. The system features role-based authentication (Admin/Agent), AI-powered automated responses with intelligent escalation to human agents, comprehensive ticket management, knowledge base with file uploads, and real-time analytics. Built with a focus on information clarity and rapid conversation processing, inspired by industry leaders like Intercom and Zendesk.

## Recent Updates (October 15, 2025)

### Smart Escalation System ✨ NEW
- ✅ **AI-First Response**: All customer messages get AI response first (if AI enabled)
- ✅ **Automatic Escalation Detection**: AI detects when human help is needed via keyword analysis
- ✅ **Load-Balanced Agent Assignment**: Finds available agents and assigns to least loaded agent
- ✅ **Automatic Ticket Creation**: Creates ticket with TAT when no agents available
- ✅ **Agent Workload Tracking**: Accurately tracks and updates agent activeConversations count
- ✅ **Escalation Flow**: Customer → AI → Available Agent OR Ticket (24hr TAT default)

### Enhanced Channel Integration ✨ NEW
- ✅ **Platform-Specific Authentication**: Different auth methods per channel
  - Telegram & WhatsApp: Simple API token
  - Instagram (Meta): App ID + App Secret
  - Twitter/X: Client ID + Client Secret (OAuth2)
- ✅ **Auto-Webhook Registration**: Telegram webhook auto-registers when token saved
- ✅ **Improved Error Logging**: Detailed logs for webhook delivery and AI responses
- ✅ **Multi-Channel AI Support**: AI auto-responds on all channels (Telegram, Web, etc.)

### Authentication & Authorization
- ✅ **Role-Based Access Control**: Implemented admin and agent roles with different permission levels
- ✅ **Protected Routes**: Frontend routes protected with role-based access checks
- ✅ **Server-Side Authorization**: Backend endpoints secured with requireAdmin middleware
- ✅ **Session Management**: Passport.js with express-session for secure authentication
- ✅ **Login/Signup Pages**: User registration with role selection (admin/agent)

### Channel Integration (Previous)
- ✅ **Web Chat Widget**: Fully functional chat widget at `/widget` for website embedding
- ✅ **Channel Setup Guide**: Instructions for WhatsApp, Telegram, Instagram, Twitter integration
- ✅ **Embeddable Widget**: Copy-paste embed code for any website
- ✅ **Real-time Messaging**: WebSocket-powered live chat with auto-reconnect

### Knowledge Base
- ✅ **File Upload System**: Upload documents, PDFs, images, and other files (max 5MB)
- ✅ **File Management UI**: View, download, and delete knowledge base files
- ✅ **Base64 Storage**: Files stored as data URLs in memory storage
- ✅ **User Tracking**: Track who uploaded each file

### Ticket Management
- ✅ **Create Ticket Dialog**: Form with validation for creating support tickets
- ✅ **Tab Filtering**: Filter tickets by status (all, open, in_progress, resolved)
- ✅ **Ticket Counts**: Display count for each status tab
- ✅ **Priority & TAT**: Set ticket priority and turn-around time

### Data Management
- ✅ **Clean State**: Removed all demo/mock data
- ✅ **Production Ready**: Starts with empty state, real data only from user interactions
- ✅ **Empty AI Settings**: AI configuration starts uninitialized until user configures

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
- `users` table: Authentication with username, password hash, role (admin/agent), and profile info
- `knowledge_files` table: Uploaded files with name, type, size, url (base64), and uploader tracking

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
- **Web Chat Widget**: Fully functional at `/widget` - embeddable on any website with copy-paste code
- **WhatsApp Business**: Setup guide provided - requires WhatsApp Business API access
- **Telegram Bot**: Setup guide provided - requires bot creation via @BotFather
- **Instagram DM**: Setup guide provided - requires Facebook App with Instagram product
- **Twitter/X DM**: Setup guide provided - requires X Developer account
- Unified message normalization layer to abstract channel-specific formats
- Channel type stored with each conversation for routing and display

## Access Control

### Admin Role
Full platform access including:
- Agents management (view, create, update status)
- Analytics dashboard
- AI settings configuration
- All agent capabilities

### Agent Role
Limited access including:
- Inbox/Conversations
- Channels setup
- Tickets (view, create, update)
- Knowledge Base (upload, view, delete files)

## Key Routes

### Public Routes
- `/auth` - Login/signup page with role selection
- `/widget` - Embeddable chat widget for customers

### Protected Routes (Authentication Required)
- `/` or `/conversations` - Unified inbox (all users)
- `/channels` - Channel integration setup (all users)
- `/tickets` - Ticket management (all users)
- `/knowledge-base` - File upload and management (all users)
- `/agents` - Agent management (**admin only**)
- `/analytics` - Analytics dashboard (**admin only**)
- `/settings` - AI settings and configuration (**admin only**)