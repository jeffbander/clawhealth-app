# ClawHealth Dashboard Modernization Spec

## Current State
The dashboard at `src/app/dashboard/` is functional but visually dated. Needs a modern healthcare SaaS look.

## Design System

### Colors
- **Primary**: `#212070` (deep indigo/navy — keep this, it's the brand)
- **Accent**: `#06ABEB` (bright cyan — keep)
- **Gradient**: `linear-gradient(135deg, #212070, #06ABEB)` — used for avatars, hero elements
- **Background**: `#f8fafc` (light cool gray, NOT pure white)
- **Card BG**: `#ffffff` with `border: 1px solid #e2e8f0`, `border-radius: 16px`, `box-shadow: 0 1px 3px rgba(0,0,0,0.04)`
- **Success**: `#10b981` (emerald)
- **Warning**: `#f59e0b` (amber)
- **Danger**: `#ef4444` (red)
- **Text Primary**: `#0f172a`
- **Text Secondary**: `#64748b`
- **Text Muted**: `#94a3b8`

### Typography
- Font: Inter (already loaded via Tailwind)
- Headings: `font-semibold` or `font-bold`, larger sizes
- Body: `text-sm` (14px) for most content
- Use `tracking-tight` on headings

### Spacing & Layout
- 16px border-radius on cards (rounded-2xl)
- 24px padding inside cards
- 20px gaps between cards
- Sidebar: keep dark navy, but make it sleeker — icons + text, active state with left accent bar

## Pages to Modernize

### 1. Dashboard Home (`/dashboard/page.tsx`)
Modern overview dashboard:
- **Top row**: 4 KPI cards (Total Patients, Active Alerts, CCM Revenue This Month, AI Conversations Today)
- **Each KPI card**: Large number, small label, subtle icon, optional trend indicator
- **Middle row**: Patient list preview (top 5 by risk) + Alert feed (latest 5)
- **Bottom row**: CCM billing status summary

### 2. Patients List (`/dashboard/patients/page.tsx`)
- Clean table with avatar initials, name, risk badge, conditions tags, last interaction, CCM minutes
- Search/filter bar at top
- Hover states on rows
- Risk level color-coded left border on each row

### 3. Patient Detail (`/dashboard/patients/[id]/page.tsx`)
Already decent but modernize:
- Bigger, bolder patient header with gradient avatar
- Tab-based layout instead of vertical scroll: Overview | Medications | Vitals | Conversations | AI Instructions
- Better medication cards with pill icons
- Conversation history styled like a chat interface (bubbles)

### 4. Sidebar (`SidebarNav.tsx`)
- Slim dark sidebar with icon + label
- Active state: left accent border (cyan) + slightly lighter bg
- Hover: subtle lighten
- ClawHealth logo at top
- User avatar/name at bottom
- Collapse to icon-only on mobile

### 5. Settings (`/dashboard/settings/page.tsx`)
Already has the ConditionTemplateEditor — just make the page wrapper consistent with new design.

## Implementation Rules
- Use Tailwind CSS classes exclusively (already configured)
- Keep all existing functionality — this is a VISUAL upgrade only
- Don't break any API calls or data fetching
- Server components where possible, client components only for interactivity
- Keep all existing imports (Clerk, Prisma, encryption, etc.)
- Maintain HIPAA compliance — never log PHI

## Files to Modify
- `src/app/dashboard/page.tsx` — full redesign
- `src/app/dashboard/patients/page.tsx` — table modernization  
- `src/app/dashboard/patients/[id]/page.tsx` — tabs + chat UI
- `src/app/dashboard/SidebarNav.tsx` — sleek sidebar
- `src/app/dashboard/layout.tsx` — background color, layout adjustments
- `src/app/dashboard/settings/page.tsx` — consistent wrapper

## Branch
Work on existing branch: `feature/prompt-management`

## Build Check
After all changes, run `npx next build` to verify no TypeScript errors.
