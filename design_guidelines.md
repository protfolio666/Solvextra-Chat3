# Omnichannel Customer Support Platform - Design Guidelines

## Design Approach: Reference-Based (Intercom/Zendesk) + Utility System

**Selected References:** Intercom and Zendesk Chat - industry leaders in unified inbox experiences with seamless agent handoff, optimized for productivity and information density.

**Core Principles:**
- Information clarity over decoration
- Rapid conversation processing
- Real-time status visibility
- Channel-agnostic unified experience

---

## Color System (User-Specified)

### Primary Palette
- **Primary Blue:** #1F73B7 (professional, trust)
- **Success Green:** #00C851 (resolved, available)
- **Agent Purple:** #6C5CE7 (human agent presence)
- **Alert Red:** #FF6B6B (escalation, urgent)

### Neutrals
- **Background:** #F8F9FA (light grey, main canvas)
- **Text Primary:** #212529 (dark grey, high contrast)
- **Text Secondary:** #6C757D (muted for metadata)
- **Border:** #DEE2E6 (subtle separation)
- **Surface:** #FFFFFF (cards, panels)

### Status Indicators
- **AI Response:** #1F73B7 20% opacity background
- **Agent Active:** #6C5CE7 with pulse animation
- **Pending:** #FFC107 (warning amber)
- **Offline:** #6C757D (neutral grey)

---

## Typography

**Primary Font:** Inter (clean, readable at small sizes)
**Secondary Font:** Source Sans Pro (conversation content)

### Hierarchy
- **Dashboard Headers:** Inter 24px/32px, weight 600
- **Conversation Names:** Inter 16px/24px, weight 500
- **Message Content:** Source Sans Pro 15px/22px, weight 400
- **Metadata/Timestamps:** Inter 13px/18px, weight 400
- **Agent Names:** Inter 14px/20px, weight 500
- **Channel Tags:** Inter 12px/16px, weight 600, uppercase

---

## Layout Architecture

### Unified Inbox Structure (Desktop)
```
[Sidebar: 240px] | [Conversation List: 360px] | [Active Chat: flex-1] | [Details Panel: 280px]
```

### Spacing System
**Tailwind Units:** 2, 3, 4, 6, 8, 12, 16 (consistent rhythm)
- Component padding: p-4 to p-6
- Section spacing: space-y-4 to space-y-6
- Container margins: mx-4 to mx-8

### Grid Patterns
- **Channel Icons:** 4-column grid (md:grid-cols-4) with equal spacing
- **Agent Cards:** 3-column grid (lg:grid-cols-3)
- **Ticket Lists:** Single column with dividers
- **Analytics Cards:** 2-4 column responsive grid

---

## Component Library

### Navigation & Sidebar
- **Logo Area:** 56px height with primary blue background
- **Nav Items:** 40px height, rounded-lg on hover, icon + label
- **Active State:** Primary blue background (10% opacity) + bold text
- **Channel Filters:** Chip-style buttons with channel-specific colors

### Conversation List Panel
- **Conversation Card:** 80px height, hover: #F8F9FA background
- **Channel Badge:** 20px circular icon, positioned top-right
- **Unread Indicator:** 8px dot, success green
- **Preview Text:** 2-line truncation, text-secondary
- **Timestamp:** Absolute positioned top-right, 12px text

### Chat Interface
- **Message Bubbles:**
  - AI: Left-aligned, #F8F9FA background, #1F73B7 accent border-l-4
  - Agent: Left-aligned, #6C5CE7 10% background, agent avatar
  - Customer: Right-aligned, #1F73B7 background, white text
  - Padding: px-4 py-3, max-width: 70%, rounded-2xl
  
- **Input Area:** 
  - Fixed bottom, 64px height, white background
  - Shadow-lg for elevation
  - Quick replies as chips above input
  - Attachment/emoji icons inline

### Status & Indicators
- **Agent Status Dot:** 10px circle, positioned on avatar
  - Available: #00C851, with subtle pulse
  - Busy: #FFC107
  - Offline: #6C757D
  
- **Typing Indicator:** 3 animated dots, #6C757D, 8px each

### Escalation System
- **Alert Banner:** Full-width, #FF6B6B background, white text, 48px height
- **Escalate Button:** #FF6B6B background, white text, prominent in chat header
- **Agent Assignment Card:** Purple border-l-4, agent avatar + name + status

### Configuration Panel
- **AI Provider Tabs:** Segmented control, 40px height
- **Settings Cards:** White background, border, rounded-lg, p-6
- **API Key Input:** Monospace font, password field, copy button

---

## Responsive Behavior (Mobile-First)

### Breakpoints
- Mobile: < 768px (single panel view)
- Tablet: 768px - 1024px (2-panel: list + chat)
- Desktop: > 1024px (full 4-panel layout)

### Mobile Adaptations
- **Bottom Navigation:** 64px height, 5 primary actions
- **Slide-out Panels:** Conversation list overlays chat
- **Floating Action Button:** Fixed bottom-right, #1F73B7, 56px diameter
- **Compact Headers:** 48px height, hamburger menu

---

## Interaction Patterns

### Real-Time Updates
- **New Message:** Smooth scroll-to-bottom, subtle fade-in
- **Agent Join:** Toast notification, top-right, 4s duration
- **Status Change:** Color transition, 200ms ease

### Data Visualization
- **Response Time Chart:** Line graph, #1F73B7 stroke
- **Volume Metrics:** Donut charts with brand colors
- **TAT Tracking:** Progress bars, color-coded by urgency

### Micro-interactions (Minimal)
- **Button Hover:** Subtle darkening (10%)
- **Card Hover:** Lift effect (shadow-md to shadow-lg)
- **Channel Badge:** Scale 1.05 on hover

---

## Channel-Specific Styling

- **WhatsApp:** #25D366 accent (green)
- **Telegram:** #0088CC accent (blue)
- **Instagram:** Linear gradient #833AB4 to #FD1D1D
- **Twitter:** #1DA1F2 accent (blue)
- **Website:** #1F73B7 (primary)

Badges display as 24px circular icons with white channel logo on colored background

---

## Accessibility

- **Focus States:** 2px solid #1F73B7 outline, 2px offset
- **Minimum Touch Targets:** 44px × 44px
- **Contrast Ratios:** WCAG AA compliant (4.5:1 text, 3:1 UI)
- **Screen Reader:** ARIA labels on all interactive elements
- **Keyboard Navigation:** Full support with visible focus indicators

---

**No Custom Illustrations Required** - Focus on functional clarity with iconography from Heroicons (outline style for navigation, solid for status indicators)