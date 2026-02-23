# ClawHealth

AI-powered patient care coordination for cardiology. HIPAA-compliant.

**Live**: [app.clawmd.ai](https://app.clawmd.ai) | **Marketing**: [clawmd.ai](https://clawmd.ai)

## What It Does

Patients text a phone number → an AI agent responds with personalized clinical guidance → physicians monitor and intervene from a dashboard.

```
Patient (SMS) ──→ Twilio ──→ AI Agent (Claude) ──→ Response
                                    │
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
               PostgreSQL     Vercel Blob     Telegram Alert
            (clinical data)  (agent memory)   (physician)
```

### For Patients
- Text **(929) 412-1499** for medication questions, symptom guidance, vital tracking
- Self-enroll at [app.clawmd.ai/enroll](https://app.clawmd.ai/enroll)
- Emergency keywords automatically alert your physician

### For Physicians
- Dashboard with patient list, risk levels, alerts
- Unified inbox for patient messages
- Resolve alerts with clinical notes
- Message patients directly via SMS
- Edit disease-specific AI templates
- Per-patient AI instruction overrides
- CCM billing tracking (CPT 99490/99439/99491)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Auth | Clerk |
| Database | PostgreSQL (Neon) via Prisma |
| AI | Anthropic Claude Sonnet 4.5 |
| SMS/Voice | Twilio |
| Agent Memory | Vercel Blob (NanoClaw architecture) |
| Encryption | AES-256-GCM (all PHI at rest) |
| Hosting | Vercel |
| Alerts | Telegram Bot API |

## Architecture

### Three-Tier Prompt System
1. **Base prompt** — clinical safety rules, communication guidelines
2. **Disease templates** — 18 condition-specific protocols (HF, AFib, CAD, HTN, CKD, COPD, etc.)
3. **Patient overrides** — per-patient instructions set by physician

### NanoClaw Patient Memory
Each patient gets persistent memory files (OpenClaw-style):
- `SOUL.md` — agent personality, communication preferences
- `MEMORY.md` — accumulated behavioral knowledge, relationship context
- `memory/YYYY-MM-DD.md` — daily interaction logs

Structured data (vitals, meds, alerts, billing) stays in Postgres. Soft knowledge (preferences, behavioral patterns) lives in files. Nightly AI consolidation distills daily logs into long-term memory.

### Safety
- All PHI encrypted with AES-256-GCM
- Emergency keyword detection → immediate physician alert
- Auto-lock after 3 unresolved emergencies in 30 minutes
- HIPAA audit logging on all data access
- Prompt injection resistance tested and validated
- No medical diagnoses — always refers to physician

## Quick Start

```bash
git clone https://github.com/jeffbander/clawhealth-app.git
cd clawhealth-app
npm install
npx vercel env pull .env.local    # Or create .env.local manually
npx prisma generate
npx prisma db push
npx tsx scripts/seed-demo.ts      # Seed 5 demo patients
npm run dev                        # http://localhost:3000
```

See [CLAUDE.md](./CLAUDE.md) for detailed codebase documentation.

## License

Private. © 2026 ClawHealth.
