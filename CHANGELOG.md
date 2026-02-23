# CHANGELOG — ClawHealth

All notable changes to ClawHealth, documented chronologically.

**Live**: https://app.clawmd.ai
**Repo**: github.com/jeffbander/clawhealth-app
**Branch**: `master` (auto-deploys to Vercel)

---

## [2026-02-22] NanoClaw Patient Memory + Documentation + Dev Database

### Added
- **Separate dev database** — Neon branch `development` (br-flat-snow-aingy0ft)
  - Production: `ep-royal-art-aid9a4ko-pooler` (Vercel)
  - Development: `ep-lingering-cloud-aicwa3gr-pooler` (local `npm run dev`)
  - Copy-on-write from production — isolated but starts with same data
  - `.env.local` points to dev branch; Vercel env vars point to production
- **Neon API key** created (`clawhealth-albert`) for CLI/API access
- **neonctl** installed globally for database management
- **SMS error handling** — graceful fallback when AI agent errors

### Performance
- Attempted Haiku model for faster SMS (~2s) — **reverted** due to model ID issues
- Added parallelized DB queries in AI agent (patient context + conversation history)
- SMS responses: ~5-8s on Sonnet (stable)

---

## [2026-02-22] NanoClaw Patient Memory + Documentation (earlier)

### Added
- **NanoClaw Patient Memory Layer** (`src/lib/patient-memory.ts`)
  - Per-patient SOUL.md, MEMORY.md, and daily interaction logs
  - Vercel Blob storage for production persistence (store: `nanoclaw-patient-memory`)
  - Local filesystem fallback for development
  - AI agent loads memory context into every system prompt
  - Post-interaction logging (fire-and-forget)
  - Nightly memory consolidation cron (`/api/cron/memory-consolidation`, 2 AM UTC)
  - Auto-initialization on patient onboarding
- **CLAUDE.md** — full codebase documentation for AI coding agents
- **README.md** — replaced Next.js boilerplate with real project docs
- **CHANGELOG.md** — this file
- **Production DB seeded** — 5 demo patients + 19 disease templates on Neon

### Fixed
- Patient model uses `agentEnabled` instead of `active` for SMS routing

---

## [2026-02-21] Design Polish + Drug Interactions

### Added
- **Medication Interaction Checker** (`src/lib/med-interactions.ts`)
  - Checks drug-drug interactions across patient medication lists
  - AI agent warns patients about interactions during SMS conversations
  - Dashboard component: `MedInteractions.tsx`
- **Light sidebar design** — white sidebar, Linear/Stripe aesthetic
  - SVG icons replacing emoji
  - Boosted text contrast to white/90

### Changed
- Unknown SMS numbers now receive enrollment link instead of rejection message
- **Safety**: patient-specific instructions can NEVER override emergency escalation triggers

---

## [2026-02-20] Physician Action Center + Patient Timeline

### Added
- **Physician Action Center** (PR #3, merged)
  - `PhysicianActions.tsx` — resolve alerts with clinical notes, message patients via SMS
  - `/api/physician/message` — send SMS + log PHYSICIAN conversation + CCM tracking (+5 min/message)
  - `/api/physician/inbox` — patient inbox with unread/all tabs, lookback periods
  - `inbox/page.tsx` — unified patient message inbox
  - ✉️ Inbox added to sidebar navigation
- **Patient Timeline** (`PatientTimeline.tsx`)
  - Unified chronological event feed (conversations, vitals, alerts, meds, care plans)
  - `/api/patients/[id]/timeline` — aggregated timeline API

---

## [2026-02-19] Three-Tier Prompt System + Dashboard Modernization

### Added
- **Three-Tier Prompt Management** (PR #2, merged)
  - `ConditionTemplate` Prisma model — DB-stored, dashboard-editable disease prompts
  - `encCustomInstructions` on Patient model — per-patient AI overrides (encrypted)
  - `ConditionTemplateEditor.tsx` — sidebar + form editor for disease templates
  - `PatientInstructions.tsx` — editable AI instructions per patient
  - CRUD APIs: `/api/condition-templates`, `/api/condition-templates/[id]`, `/api/patients/[id]/instructions`
  - 6 original templates seeded (HF, AFib, CAD, HTN, Diabetes, Glaucoma)
  - 12 Manus templates imported (CKD, COPD, Thyroid, Obesity, DVT/PE, PAD, etc.)
  - `condition-prompts-db.ts` — DB template loader with condition matching

### Changed
- Dashboard UI modernized — clean card layout, improved patient list, better typography

---

## [2026-02-18] CCM Revenue Engine + Physician Alerts

### Added
- **CCM Revenue Engine** (PR #1, merged)
  - `src/lib/ccm-billing.ts` — CPT code tracking (99490: $64, 99439: $47, 99491: $84)
  - `/api/cron/daily-alerts` — daily patient alert generation (12:00 UTC)
  - `/api/cron/proactive-outreach` — automated patient check-in SMS (14:00 UTC)
  - CCM Revenue Dashboard in analytics
- **Real-time Physician Telegram Alerts** (`src/lib/physician-alert.ts`)
  - Emergency keywords → immediate Telegram notification to Dr. Bander
  - Auto-lock after 3 unresolved emergency escalations in 30 minutes
- **Patient Hero Page** (`/page.tsx`) — phone mockup, trust signals, enrollment CTA
- **Self-Enrollment Flow** (`/enroll`) — 3-step patient registration
- **Condition-Specific Clinical Prompts** — hardcoded fallback templates
- **Rate Limiting** — 10 messages per 5-minute window per phone number
- **Phone Deduplication** — prevents duplicate patient registrations

---

## [2026-02-17] Core Platform + AI Agent

### Added
- **AI Agent** (`src/lib/ai-agent.ts`)
  - Loads patient context from DB, builds condition-specific system prompt
  - Last 10 conversation messages for continuity
  - Emergency keyword detection + escalation
  - Clinical insight extraction (fire-and-forget)
  - Medication adherence auto-update (rolling average)
  - Proactive outreach mode (`__PROACTIVE_OUTREACH__`)
- **EMR Paste Onboarding** (`/api/patients/onboard` + `/dashboard/patients/onboard`)
  - Paste EMR text → AI extracts structured patient record
- **Twilio Integration**
  - `/api/twilio/sms` — inbound SMS webhook
  - `/api/twilio/voice` — inbound voice webhook
  - `/api/twilio/status` — delivery status callback
  - Phone: (929) 412-1499
- **Patient Detail Page** — vitals, meds, conversations, alerts, care plan, CCM minutes
- **Full E2E Test Suite** — 58/60 passing (`tests/full-e2e-test.ts`)

---

## [2026-02-16] HIPAA Scaffold + UX Foundation

### Added
- **HIPAA-Compliant Scaffold**
  - AES-256-GCM encryption for all PHI (`src/lib/encryption.ts`)
  - Prisma schema: Patient, Conversation, Medication, Vital, Alert, AuditLog, CarePlan, Physician
  - HIPAA audit logging (`src/lib/audit.ts`)
  - Clerk authentication + middleware
- **UX Redesign** — converted inline styles to Tailwind CSS
- **Vercel Deployment** — auto-deploys from master, app.clawmd.ai

### Infrastructure
- Next.js 14 App Router + TypeScript
- PostgreSQL via Neon (Prisma ORM)
- Clerk authentication
- Vercel hosting

---

## API Reference

### Patient Communication
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/twilio/sms` | Inbound SMS webhook (Twilio) |
| POST | `/api/twilio/voice` | Inbound voice webhook (Twilio) |
| POST | `/api/twilio/status` | SMS delivery status callback |

### Patient Management
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/patients` | List patients (org-scoped) |
| POST | `/api/patients` | Create patient |
| GET | `/api/patients/[id]` | Get patient detail |
| PATCH | `/api/patients/[id]` | Update patient |
| POST | `/api/patients/onboard` | EMR paste → structured record |
| POST | `/api/patients/enroll` | Patient self-enrollment |
| GET | `/api/patients/me` | Patient self-lookup by phone |
| GET | `/api/patients/[id]/timeline` | Aggregated timeline feed |
| GET | `/api/patients/[id]/interactions` | Conversation history |
| GET | `/api/patients/[id]/instructions` | Per-patient AI instructions |
| PUT | `/api/patients/[id]/instructions` | Update AI instructions |

### Physician
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/physician/message` | Send SMS to patient + log CCM |
| GET | `/api/physician/inbox` | Patient message inbox |
| GET | `/api/physician/me` | Current physician profile |

### Clinical Data
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/POST | `/api/vitals` | Vital signs CRUD |
| GET/POST | `/api/medications` | Medications CRUD |
| GET/POST | `/api/alerts` | Alert management |
| PATCH | `/api/alerts/[id]` | Resolve alert |
| GET/POST | `/api/care-plans` | Care plan CRUD |
| GET | `/api/care-plans/[id]` | Single care plan |

### AI Configuration
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/condition-templates` | List disease templates |
| POST | `/api/condition-templates` | Create template |
| GET | `/api/condition-templates/[id]` | Get template |
| PUT | `/api/condition-templates/[id]` | Update template |
| DELETE | `/api/condition-templates/[id]` | Delete template |

### Cron Jobs
| Method | Endpoint | Schedule | Purpose |
|--------|----------|----------|---------|
| GET | `/api/cron/daily-alerts` | 12:00 UTC | Generate daily alerts |
| GET | `/api/cron/proactive-outreach` | 14:00 UTC | Patient check-in SMS |
| GET | `/api/cron/memory-consolidation` | 02:00 UTC | Distill daily logs → MEMORY.md |

### Other
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/chat` | Web chat interface |
| POST | `/api/voice` | Voice interaction |
| POST | `/api/test/setup` | Test environment setup |

---

## URLs & Endpoints

| URL | Purpose |
|-----|---------|
| https://app.clawmd.ai | Physician portal (Clerk auth) |
| https://app.clawmd.ai/dashboard | Main dashboard |
| https://app.clawmd.ai/enroll | Patient self-enrollment |
| https://clawmd.ai | Marketing/hero page |
| https://abim-quiz.vercel.app | ABIM question bank |
| https://team-hub-ten.vercel.app | Team coordination hub |

## Phone Numbers

| Number | Purpose |
|--------|---------|
| (929) 412-1499 | ClawHealth patient SMS/voice |
| (646) 556-5559 | Jeff's test phone (linked to Mary Johnson) |

## External Services

| Service | Purpose | Dashboard |
|---------|---------|-----------|
| Vercel | Hosting + crons | vercel.com/jeff-banders-projects/clawhealth-app |
| Neon | PostgreSQL (prod + dev branches) | console.neon.tech (project: fragrant-snow-58391828) |
| Clerk | Authentication | dashboard.clerk.com (instance ins_37TuDBxwDJpQWZaPK94QrUbnJde) |
| Twilio | SMS/Voice | console.twilio.com (SID in env vars) |
| Vercel Blob | NanoClaw memory | store_T54oG026q2eR7BMN |
| Telegram | Physician alerts | Bot token in Vercel env |

---

*This changelog is maintained by Albert. Updated after every deployment.*
