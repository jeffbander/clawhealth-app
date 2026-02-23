# CLAUDE.md — ClawHealth Codebase Guide

## What This Is

ClawHealth is a HIPAA-compliant AI patient care coordination platform for cardiology. Patients text a Twilio number, an AI agent (Claude Sonnet) responds with personalized clinical guidance, and physicians monitor everything from a dashboard.

**Live**: https://app.clawmd.ai
**Repo**: github.com/jeffbander/clawhealth-app

## Tech Stack

- **Framework**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Auth**: Clerk (physician login)
- **Database**: PostgreSQL via Neon (Prisma ORM)
- **AI**: Anthropic Claude Sonnet 4.5 (patient conversations + clinical insight extraction)
- **SMS/Voice**: Twilio ((929) 412-1499)
- **Storage**: Vercel Blob (NanoClaw patient memory files)
- **Hosting**: Vercel (auto-deploys from `master`)
- **Encryption**: AES-256-GCM for all PHI at rest

## Architecture Overview

```
Patient (SMS) → Twilio → /api/twilio/sms → AI Agent → TwiML Response
                                              ↓
                              ┌────────────────┼────────────────┐
                              ↓                ↓                ↓
                         Postgres DB     Vercel Blob      Physician Alert
                      (clinical data)  (NanoClaw memory)   (Telegram)
```

### Three-Tier Prompt Hierarchy

Patient-specific instructions > Disease templates (DB) > Base system prompt

The AI agent (`src/lib/ai-agent.ts`) loads context in this order:
1. Patient data from DB (meds, vitals, alerts, care plan)
2. Disease-specific templates matched to patient conditions
3. Per-patient custom instructions (encrypted, physician-editable)
4. NanoClaw memory files (SOUL.md, MEMORY.md, daily logs)
5. Last 10 conversation messages for continuity

### NanoClaw Patient Memory (Hybrid Storage)

Each patient gets OpenClaw-style memory files stored in Vercel Blob:
- `SOUL.md` — agent personality, communication preferences, condition context
- `MEMORY.md` — accumulated soft knowledge (behavioral patterns, preferences)
- `memory/YYYY-MM-DD.md` — daily interaction logs

**Rule**: Structured clinical data → Postgres. Agent personality/reasoning → files.

Memory consolidation runs nightly (2 AM UTC cron) — AI distills daily logs into MEMORY.md.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── twilio/sms/          # Inbound SMS webhook (main patient interaction)
│   │   ├── twilio/voice/        # Inbound voice webhook
│   │   ├── twilio/status/       # Delivery status callback
│   │   ├── patients/            # CRUD, onboard (EMR paste), enroll
│   │   ├── physician/           # Inbox, message patient, physician profile
│   │   ├── condition-templates/ # Disease template CRUD
│   │   ├── cron/                # daily-alerts, proactive-outreach, memory-consolidation
│   │   ├── alerts/              # Alert management
│   │   ├── vitals/              # Vital signs
│   │   ├── medications/         # Medication management
│   │   └── care-plans/          # Care plan CRUD
│   ├── dashboard/               # Physician portal (Clerk-protected)
│   │   ├── page.tsx             # Home dashboard
│   │   ├── patients/            # Patient list, detail, onboard
│   │   ├── inbox/               # Physician message inbox
│   │   ├── alerts/              # Alert management
│   │   ├── analytics/           # CCM analytics
│   │   ├── settings/            # Condition template editor
│   │   └── layout.tsx           # Sidebar nav
│   ├── patient/                 # Patient-facing pages (chat, vitals, meds)
│   ├── enroll/                  # Self-enrollment flow
│   └── page.tsx                 # Hero/landing page
├── lib/
│   ├── ai-agent.ts              # ⭐ Core AI agent — loads context, generates responses
│   ├── patient-memory.ts        # NanoClaw memory layer (Vercel Blob + local fallback)
│   ├── encryption.ts            # AES-256-GCM encrypt/decrypt for PHI
│   ├── twilio.ts                # Twilio helpers (webhook validation, TwiML, phone lookup)
│   ├── physician-alert.ts       # Telegram alerts + auto-lock (3 emergencies in 30 min)
│   ├── ccm-billing.ts           # CCM revenue tracking (CPT 99490/99439/99491)
│   ├── condition-prompts-db.ts  # DB-backed disease template loader
│   ├── condition-prompts.ts     # Hardcoded fallback templates
│   ├── med-interactions.ts      # Drug interaction checker
│   ├── audit.ts                 # HIPAA audit logging
│   └── prisma.ts                # Prisma client singleton
├── middleware.ts                # Clerk auth middleware
prisma/
├── schema.prisma               # 9 models: Patient, Conversation, Medication, Vital, Alert, etc.
├── seed-condition-templates.ts  # 6 base templates
├── import-manus-templates.ts   # 13 additional disease templates
scripts/
├── seed-demo.ts                # 5 demo patients with full clinical data
tests/
├── full-e2e-test.ts            # 58/60 passing E2E tests
```

## Key Models (Prisma)

| Model | Purpose |
|-------|---------|
| `Patient` | Core patient record. PHI encrypted (encFirstName, encPhone, etc.) |
| `Conversation` | All messages (PATIENT, AI, PHYSICIAN roles). Content encrypted. |
| `Medication` | Active medications with adherence tracking |
| `Vital` | Vital signs (BP, HR, weight, glucose). Values encrypted. |
| `Alert` | Clinical alerts with severity (LOW/MEDIUM/HIGH/CRITICAL) |
| `ConditionTemplate` | Disease-specific AI prompt templates (18 active) |
| `CarePlan` | Physician-authored care plans. Content encrypted. |
| `AuditLog` | HIPAA-compliant audit trail |
| `Physician` | Clerk user → physician mapping |

## Environment Variables

### Required (Production)
```
DATABASE_URL          # Neon Postgres connection string
DIRECT_URL            # Neon direct connection (for migrations)
ENCRYPTION_KEY        # 32-byte hex key for AES-256-GCM PHI encryption
ANTHROPIC_API_KEY     # Claude API key
CLERK_SECRET_KEY      # Clerk backend key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
TWILIO_ACCOUNT_SID    # Twilio credentials
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER   # +19294121499
BLOB_READ_WRITE_TOKEN # Vercel Blob (auto-set when store is linked)
CRON_SECRET           # Vercel cron authentication
```

### Optional
```
PHYSICIAN_TELEGRAM_ID    # Jeff's Telegram chat ID for alerts
TELEGRAM_BOT_TOKEN       # OpenClaw bot token for physician alerts
ELEVENLABS_API_KEY       # Voice synthesis (future)
NEXT_PUBLIC_APP_URL      # https://app.clawmd.ai
```

## Common Tasks

### Run locally
```bash
npm install
npx vercel env pull .env.local   # Pull dev env vars
npx prisma generate
npx prisma db push               # Sync schema to dev DB
npm run dev                       # http://localhost:3000
```

### Seed demo data
```bash
npx tsx scripts/seed-demo.ts                    # 5 patients
npx tsx prisma/seed-condition-templates.ts       # 6 base templates
npx tsx prisma/import-manus-templates.ts         # 13 more templates
```

### Run tests
```bash
npm run test:e2e    # 58/60 passing
```

### Deploy
Push to `master` → Vercel auto-deploys to app.clawmd.ai

### Database migrations
```bash
npx prisma db push          # Dev: push schema changes
npx prisma migrate dev      # Dev: create migration
npx prisma migrate deploy   # Prod: apply migrations
```

## Critical Safety Rules

1. **All PHI must be encrypted** — use `encryptPHI()` / `decryptPHI()` from `src/lib/encryption.ts`
2. **Never log decrypted PHI** — decrypt in memory only, never to console/files
3. **Emergency keywords trigger escalation** — chest pain, syncope, suicide → immediate physician alert
4. **Auto-lock after 3 emergencies** — 3+ unresolved escalations in 30 min → account disabled
5. **Audit everything** — use `logAudit()` for all data access and mutations
6. **No medical diagnoses** — AI provides guidance, always refers to physician
7. **Patient identity = phone number** — no login required for patients, registered phone = identity

## CCM Billing

ClawHealth tracks Chronic Care Management (CCM) minutes for Medicare reimbursement:
- **CPT 99490**: First 20 min ($64/month)
- **CPT 99439**: Each additional 20 min ($47/month)
- **CPT 99491**: Complex CCM first 30 min ($84/month)

Every AI interaction and physician message logs CCM minutes automatically.

## Domain Architecture

- `clawmd.ai` → Marketing/hero page (separate Vercel project: `clawmd-hero`)
- `app.clawmd.ai` → Physician portal + patient API (this repo)

## Cron Jobs (vercel.json)

| Path | Schedule | Purpose |
|------|----------|---------|
| `/api/cron/daily-alerts` | 12:00 UTC | Generate daily patient alerts |
| `/api/cron/proactive-outreach` | 14:00 UTC | Send check-in SMS to patients |
| `/api/cron/memory-consolidation` | 02:00 UTC | Distill daily logs → MEMORY.md |
