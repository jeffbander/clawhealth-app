You are working in the ClawHealth repository. Read ARCHITECTURE.md first — that is the full system design.

Your mission: Bootstrap the complete ClawHealth Next.js application using the HIPAA Dev Team standards.

PHASE 1 - Project Setup:
1. Run: npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --yes
2. Install dependencies:
   npm install @clerk/nextjs @prisma/client prisma zod @anthropic-ai/sdk pino
   npm install -D @types/node

PHASE 2 - Database Schema:
Create prisma/schema.prisma with these models:
- Patient (id, clerkUserId, mrn encrypted, firstName encrypted, lastName encrypted, dateOfBirth encrypted, conditions Json, organizationId, createdAt, updatedAt, createdBy)
- Physician (id, clerkUserId, npi, specialty, organizationId, createdAt)  
- Conversation (id, patientId, role enum[PATIENT/AI/PHYSICIAN], encryptedContent, timestamp, audioUrl)
- Medication (id, patientId, drugName, dose, schedule, adherenceRate Float, lastTaken DateTime)
- Vital (id, patientId, type String, encryptedValue, recordedAt, source String)
- Alert (id, patientId, severity enum[LOW/MEDIUM/HIGH/CRITICAL], message, resolved Boolean, resolvedBy, createdAt)
- AuditLog (id, userId, action, resource, resourceId, ipAddress, userAgent, timestamp)
- CarePlan (id, patientId, physicianId, encryptedContent, version Int, createdAt, updatedAt)

PHASE 3 - Core File Structure:
Create these files:

src/lib/encryption.ts - AES-256-GCM encrypt/decrypt for PHI
src/lib/audit.ts - Audit logging functions (logAccess, logCreate, logUpdate, logDelete)
src/lib/ai-agent.ts - Patient AI agent: loadPatientContext() + generateResponse()
src/middleware.ts - Clerk auth middleware protecting /dashboard and /patient routes

src/app/layout.tsx - Root layout with ClerkProvider, Inter font
src/app/page.tsx - Marketing landing (redirect to app.clawmd.ai or show hero if on clawmd.ai)
src/app/sign-in/[[...sign-in]]/page.tsx - Clerk sign-in
src/app/sign-up/[[...sign-up]]/page.tsx - Clerk sign-up

src/app/dashboard/layout.tsx - Physician dashboard layout with sidebar nav
src/app/dashboard/page.tsx - Patient roster with risk cards + alerts panel
src/app/dashboard/patients/[id]/page.tsx - Individual patient: vitals, meds, conversation history, care plan
src/app/dashboard/alerts/page.tsx - All active alerts sortable by severity

src/app/patient/layout.tsx - Patient portal layout  
src/app/patient/page.tsx - Patient home: medication schedule today + vitals log + chat button
src/app/patient/chat/page.tsx - Chat interface with AI coordinator

src/app/api/patients/route.ts - GET list, POST create (Clerk auth + audit log)
src/app/api/patients/[id]/route.ts - GET, PUT, DELETE patient (auth + audit)
src/app/api/chat/route.ts - POST: load patient context → call Claude → save conversation → return response
src/app/api/vitals/route.ts - POST new vital, GET history
src/app/api/medications/route.ts - CRUD medications
src/app/api/alerts/route.ts - GET alerts, PATCH resolve
src/app/api/voice/route.ts - ElevenLabs webhook handler

PHASE 4 - Environment:
Create .env.example with all required vars:
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
DATABASE_URL=
DIRECT_URL=
ANTHROPIC_API_KEY=
ENCRYPTION_KEY= (32-byte hex for AES-256)
ELEVENLABS_API_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard

PHASE 5 - GCP Cloud Run Config:
Create Dockerfile for the agent service:
- Node 20 Alpine
- Copies the Next.js standalone build
- PORT env var
- EXPOSE 8080

Create cloudbuild.yaml for GCP Cloud Build CI/CD

Create gcp/cloud-run.yaml with Cloud Run service definition:
- Service name: clawhealth-agents
- Region: us-east1  
- Min instances: 1
- Memory: 1Gi
- CPU: 1
- Auth: require Clerk JWT

PHASE 6 - GitHub Actions:
Create .github/workflows/deploy.yml:
- On push to main: run tests, build, deploy to Vercel
- On push to main: also build Docker image and deploy to Cloud Run

After completing all phases, run:
git add -A && git commit -m "feat: complete ClawHealth HIPAA-compliant app scaffold" && git push

Then run this exact command to notify:
openclaw system event --text "ClawHealth scaffold complete: Next.js + Clerk + Prisma + GCP Cloud Run config all built. Ready for API keys and Neon DB setup." --mode now

IMPORTANT HIPAA RULES (from HIPAA Dev Team):
- NEVER log PHI in console or pino logger
- ALL PHI fields use AES-256-GCM encrypt/decrypt from src/lib/encryption.ts
- ALL endpoints require Clerk auth middleware
- ALWAYS write to AuditLog table on any PHI access
- Parameterized queries only (Prisma handles this)
- No PHI in URLs or query params
