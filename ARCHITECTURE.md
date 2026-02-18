# ClawHealth Architecture

## Vision
Patient-owned AI health coordinators — 24/7 AI agents under physician supervision.
Starting vertical: cardiology (Mount Sinai West).

## Stack (HIPAA Dev Team standard)
- **Frontend:** Next.js 14 App Router, Tailwind CSS
- **Auth:** Clerk (MFA enforced, RBAC, HIPAA BAA signed)
- **Database:** Neon DB PostgreSQL (HIPAA BAA, AES-256 at rest)
- **ORM:** Prisma
- **AI:** Anthropic Claude (HIPAA BAA signed)
- **Voice:** ElevenLabs (patient phone calls)
- **Deployment:** Vercel (public layer) + GCP Cloud Run (agent layer)
- **CI/CD:** GitHub Actions

## Domain Structure
- clawmd.ai → marketing (Vercel, already live)
- app.clawmd.ai → physician dashboard + patient portal (Next.js on Vercel)
- agents.clawmd.ai → AI agent runtime (GCP Cloud Run — PRIVATE SERVERS)
- api.clawmd.ai → backend API (Next.js API routes on Vercel)

## Private Server Layer (agents.clawmd.ai)
Why needed:
- Patient AI agents need persistent context loading
- ElevenLabs voice webhooks need always-on endpoint (no cold starts)
- Background health monitoring (vitals alerts, medication reminders)
- Long-running clinical analysis jobs

GCP Cloud Run setup:
- Project: sacred-evening-485804-u0
- Region: us-east1 (data residency near Mount Sinai)
- Service: clawhealth-agents
- Min instances: 1 (no cold start on voice calls)
- HIPAA: GCP HIPAA BAA covers Cloud Run
- Auth: Cloud IAM + Clerk JWT verification

## Database Schema (Neon)
Tables:
- patients (encrypted PHI: name, DOB, MRN, SSN)
- physicians (Clerk org members)
- conversations (encrypted transcript)
- medications (drug, dose, schedule, adherence)
- vitals (BP, HR, weight, glucose — encrypted)
- alerts (triggered by agent, reviewed by physician)
- audit_logs (ALL data access, HIPAA required)
- care_plans (physician-authored, AI-assisted)

## Patient Agent Architecture
Each patient = DB record + Clerk account + conversation history
Agent invocation (stateless, HIPAA compliant):
1. Request hits Cloud Run endpoint
2. Load patient context from Neon (encrypted → decrypt in memory)
3. Build system prompt with patient history, meds, vitals, care plan
4. Call Claude API with context
5. Store response in conversation table (encrypted)
6. Log audit record
7. Return response / trigger alerts if needed

## Voice Flow (ElevenLabs)
Patient calls dedicated number →
ElevenLabs processes speech →
Webhook hits agents.clawmd.ai/voice →
Cloud Run loads patient context →
Claude generates response →
ElevenLabs speaks response →
Conversation stored in DB

## Physician Dashboard Features
- Patient roster with risk stratification
- Real-time alerts (critical vitals, missed meds)
- Conversation review (AI-patient transcripts)
- Care plan management
- CCM billing time tracking
- Population health analytics

## Patient Portal Features
- Chat with their AI coordinator
- Medication schedule and adherence
- Vitals logging
- Appointment reminders
- Care plan viewing
- Emergency escalation button

## HIPAA Compliance
- All PHI encrypted AES-256-GCM at rest
- TLS 1.3 in transit
- Clerk MFA mandatory
- Full audit logging (6-year retention)
- No PHI in logs or URLs
- Business Associate Agreements: Clerk, Neon, Vercel, Anthropic, GCP

## Revenue Model
- Patient subscription: $75/month
- Practice subscription: $300/month (unlimited patients)
- CCM billing support: capture $42-$130/patient/month in CMS reimbursements
