/**
 * ClawHealth Demo Seed Script
 * Creates fictional demo data — NO real PHI
 *
 * Run: npx tsx scripts/seed.ts
 *
 * Prerequisites:
 *   - DATABASE_URL set in .env or .env.local
 *   - ENCRYPTION_KEY set (32 bytes, hex)
 *   - npx prisma migrate dev (schema applied)
 */

import { PrismaClient } from "@prisma/client";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import * as dotenv from "dotenv";
import * as path from "path";
import * as fs from "fs";

// Load .env.local first, then .env
const envLocal = path.resolve(process.cwd(), ".env.local");
const envFile = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envLocal)) dotenv.config({ path: envLocal });
else if (fs.existsSync(envFile)) dotenv.config({ path: envFile });

// ─── Encryption (inline, avoids import issues) ───────────────────────────────
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    // Use a demo key for seeding if not set
    console.warn("⚠️  ENCRYPTION_KEY not set — using demo key. NOT for production!");
    return Buffer.from("0".repeat(64), "hex");
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return key;
}

function encrypt(plaintext: string): string {
  if (!plaintext) return "";
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function encryptJSON(obj: unknown): string {
  return encrypt(JSON.stringify(obj));
}

// ─── Prisma ──────────────────────────────────────────────────────────────────
const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_URL,
  log: ["error"],
});

// ─── Demo Data ───────────────────────────────────────────────────────────────
const DEMO_ORG_ID = "demo_org_clawhealth";
const DEMO_PHYSICIAN_CLERK_ID = "demo_physician_001";

const DEMO_PATIENTS = [
  {
    clerkUserId: "demo_patient_001",
    firstName: "Mary",
    lastName: "Johnson",
    dateOfBirth: "1957-03-15",
    mrn: "MRN-CW-001",
    phone: "(212) 555-0101",
    email: "mary.johnson@demo.clawhealth.ai",
    address: "123 Central Park West, New York, NY 10023",
    riskLevel: "HIGH",
    primaryDx: "E11",
    conditions: ["Type 2 Diabetes", "Hypertension", "Hyperlipidemia"],
    medications: [
      { drugName: "Metformin", dose: "1000mg", frequency: "Twice daily (BID)", route: "oral", adherenceRate: 78 },
      { drugName: "Lisinopril", dose: "10mg", frequency: "Once daily (QD)", route: "oral", adherenceRate: 85 },
      { drugName: "Atorvastatin", dose: "40mg", frequency: "Once daily at bedtime", route: "oral", adherenceRate: 72 },
      { drugName: "Aspirin", dose: "81mg", frequency: "Once daily (QD)", route: "oral", adherenceRate: 90 },
    ],
    vitals: [
      { type: "BLOOD_PRESSURE_SYSTOLIC" as const, value: "148", unit: "mmHg" },
      { type: "BLOOD_PRESSURE_DIASTOLIC" as const, value: "92", unit: "mmHg" },
      { type: "HEART_RATE" as const, value: "82", unit: "bpm" },
      { type: "GLUCOSE" as const, value: "187", unit: "mg/dL" },
      { type: "WEIGHT" as const, value: "176", unit: "lbs" },
    ],
    carePlan: `CARE PLAN — Mary Johnson (DOB: 1957-03-15)
MRN: MRN-CW-001 | Risk: HIGH | Primary DX: Type 2 Diabetes (E11)

GOALS:
1. HbA1c < 7.5% (current: 8.2%)
2. BP < 130/80 mmHg (current: 148/92)
3. Medication adherence > 85%
4. Weight loss: 10 lbs over 3 months

INTERVENTIONS:
- Daily AI check-ins for glucose logging
- Weekly blood pressure monitoring via patient app
- Monthly phone consultation with care coordinator
- Dietitian referral for carbohydrate management
- Diabetes self-management education (DSME) enrollment

MEDICATIONS:
- Metformin 1000mg BID (adherence 78% — reinforce)
- Lisinopril 10mg QD (consider uptitrating if BP remains elevated)
- Atorvastatin 40mg QHS
- Aspirin 81mg QD

MONITORING SCHEDULE:
- HbA1c: every 3 months
- BMP/CMP: every 6 months
- Ophthalmology: annual
- Podiatry: annual
- Lipid panel: every 6 months

FOLLOW-UP: 4 weeks with Dr. Chen`,
    alerts: [
      { severity: "HIGH" as const, category: "vital", message: "Blood glucose > 180 mg/dL on 3 consecutive readings" },
      { severity: "MEDIUM" as const, category: "medication", message: "Metformin adherence below 80% threshold" },
    ],
    conversations: [
      { role: "AI" as const, content: "Good morning, Mary! How are you feeling today? Don't forget to take your Metformin with breakfast." },
      { role: "PATIENT" as const, content: "Morning! I took it. My blood sugar was 195 this morning — is that bad?" },
      { role: "AI" as const, content: "Thank you for monitoring! 195 mg/dL is a bit elevated for a fasting reading. I've flagged this for Dr. Chen's review. Are you following your meal plan? Let's check in on carbohydrate intake." },
    ],
  },
  {
    clerkUserId: "demo_patient_002",
    firstName: "Robert",
    lastName: "Smith",
    dateOfBirth: "1952-08-22",
    mrn: "MRN-CW-002",
    phone: "(212) 555-0102",
    email: "robert.smith@demo.clawhealth.ai",
    address: "456 Riverside Drive, New York, NY 10025",
    riskLevel: "CRITICAL",
    primaryDx: "I25.10",
    conditions: ["Post-Cardiac Stent", "Heart Failure", "Hypertension", "Hyperlipidemia"],
    medications: [
      { drugName: "Aspirin", dose: "81mg", frequency: "Once daily (QD)", route: "oral", adherenceRate: 95 },
      { drugName: "Clopidogrel", dose: "75mg", frequency: "Once daily (QD)", route: "oral", adherenceRate: 92 },
      { drugName: "Carvedilol", dose: "25mg", frequency: "Twice daily (BID)", route: "oral", adherenceRate: 88 },
      { drugName: "Furosemide", dose: "40mg", frequency: "Once daily (QD)", route: "oral", adherenceRate: 80 },
      { drugName: "Sacubitril/Valsartan", dose: "97/103mg", frequency: "Twice daily (BID)", route: "oral", adherenceRate: 85 },
      { drugName: "Eplerenone", dose: "25mg", frequency: "Once daily (QD)", route: "oral", adherenceRate: 78 },
    ],
    vitals: [
      { type: "BLOOD_PRESSURE_SYSTOLIC" as const, value: "132", unit: "mmHg" },
      { type: "BLOOD_PRESSURE_DIASTOLIC" as const, value: "78", unit: "mmHg" },
      { type: "HEART_RATE" as const, value: "68", unit: "bpm" },
      { type: "WEIGHT" as const, value: "198", unit: "lbs" },
      { type: "OXYGEN_SATURATION" as const, value: "96", unit: "%" },
    ],
    carePlan: `CARE PLAN — Robert Smith (DOB: 1952-08-22)
MRN: MRN-CW-002 | Risk: CRITICAL | Primary DX: Atherosclerotic Heart Disease (I25.10)
Post-PCI (drug-eluting stent, LAD) — 8 months ago

CRITICAL MONITORING:
- Dual antiplatelet therapy (DAPT) — must NOT miss doses
- Daily weight monitoring (>2 lbs gain → notify immediately)
- Daily BP and HR monitoring

GOALS:
1. LVEF > 40% at 12-month echo (current 35%)
2. No HF hospitalizations
3. DAPT compliance 100% through month 12
4. BNP trending down (current: 580 pg/mL)

INTERVENTIONS:
- Daily AI check-ins for symptom reporting
- Weight trend monitoring with automated alert at +2 lbs
- Weekly RN phone check-in
- Cardiology follow-up every 4 weeks
- Cardiac rehab enrollment (3x/week)

MEDICATIONS:
- DAPT: Aspirin 81mg + Clopidogrel 75mg (critical — 12 months minimum)
- Carvedilol 25mg BID (heart failure/BP)
- Furosemide 40mg QD (volume management)
- Sacubitril/Valsartan 97/103mg BID (HFrEF)
- Eplerenone 25mg QD (aldosterone antagonist)

RED FLAGS — Immediate Escalation:
- Weight gain > 2 lbs overnight
- SOB at rest or minimal exertion
- Chest pain or pressure
- BP systolic > 160 or < 90
- HR < 50 or > 110
- O2 sat < 92%

FOLLOW-UP: 2 weeks with Dr. Chen (urgent)`,
    alerts: [
      { severity: "CRITICAL" as const, category: "vital", message: "Weight increased 3.2 lbs in 24 hours — possible fluid retention" },
      { severity: "HIGH" as const, category: "symptom", message: "Patient reports mild dyspnea on exertion — monitoring" },
    ],
    conversations: [
      { role: "AI" as const, content: "Good morning, Robert! Please log your weight and blood pressure when you wake up. It's very important for Dr. Chen to track your fluid balance." },
      { role: "PATIENT" as const, content: "Just weighed myself. 201 lbs. That's up 3 pounds from yesterday. Also feeling a little short of breath." },
      { role: "AI" as const, content: "⚠️ Robert, I'm flagging this immediately for Dr. Chen. A 3 lb weight gain overnight combined with shortness of breath are important symptoms that need urgent evaluation. Dr. Chen or their nurse will contact you within the hour. If you feel significantly worse, call 911 or go to the nearest ER." },
    ],
  },
  {
    clerkUserId: "demo_patient_003",
    firstName: "Linda",
    lastName: "Davis",
    dateOfBirth: "1966-11-08",
    mrn: "MRN-CW-003",
    phone: "(212) 555-0103",
    email: "linda.davis@demo.clawhealth.ai",
    address: "789 Broadway, New York, NY 10003",
    riskLevel: "HIGH",
    primaryDx: "I50.9",
    conditions: ["Heart Failure", "Atrial Fibrillation", "Hypertension"],
    medications: [
      { drugName: "Apixaban", dose: "5mg", frequency: "Twice daily (BID)", route: "oral", adherenceRate: 88 },
      { drugName: "Metoprolol Succinate", dose: "100mg", frequency: "Once daily (QD)", route: "oral", adherenceRate: 82 },
      { drugName: "Empagliflozin", dose: "10mg", frequency: "Once daily (QD)", route: "oral", adherenceRate: 75 },
      { drugName: "Spironolactone", dose: "25mg", frequency: "Once daily (QD)", route: "oral", adherenceRate: 70 },
      { drugName: "Torsemide", dose: "20mg", frequency: "Once daily (QD)", route: "oral", adherenceRate: 85 },
    ],
    vitals: [
      { type: "BLOOD_PRESSURE_SYSTOLIC" as const, value: "128", unit: "mmHg" },
      { type: "BLOOD_PRESSURE_DIASTOLIC" as const, value: "80", unit: "mmHg" },
      { type: "HEART_RATE" as const, value: "74", unit: "bpm" },
      { type: "WEIGHT" as const, value: "156", unit: "lbs" },
      { type: "OXYGEN_SATURATION" as const, value: "97", unit: "%" },
    ],
    carePlan: `CARE PLAN — Linda Davis (DOB: 1966-11-08)
MRN: MRN-CW-003 | Risk: HIGH | Primary DX: Heart Failure (I50.9)
Comorbidities: Atrial Fibrillation, Hypertension

GOALS:
1. Maintain sinus rhythm or rate-controlled AFib (HR 60-80 bpm)
2. Stroke prevention — Apixaban adherence > 95% (CRITICAL)
3. Reduce HF hospitalizations to 0 in 12 months
4. LVEF improvement to > 45% at 6-month echo
5. 6-minute walk test improvement

STROKE RISK (CHA₂DS₂-VASc score: 4):
- Apixaban 5mg BID — NEVER MISS DOSES
- INR not required (DOAC)

INTERVENTIONS:
- Daily AI monitoring for AFib symptoms (palpitations, fatigue, SOB)
- Daily weight and BP logging
- Monthly Holter monitor review
- Cardiac MRI at 6 months
- Electrophysiology consultation for ablation candidacy

MEDICATIONS:
- Apixaban 5mg BID (anticoagulation — critical for stroke prevention)
- Metoprolol Succinate 100mg QD (rate control)
- Empagliflozin 10mg QD (HFrEF + cardioprotection)
- Spironolactone 25mg QD (aldosterone antagonist)
- Torsemide 20mg QD (diuresis)

FOLLOW-UP: 6 weeks with Dr. Chen | Electrophysiology: 3 months`,
    alerts: [
      { severity: "MEDIUM" as const, category: "medication", message: "Spironolactone adherence below 75% — reinforcement needed" },
    ],
    conversations: [
      { role: "AI" as const, content: "Hi Linda! Just checking in. Have you taken your Apixaban today? It's very important for stroke prevention with your AFib." },
      { role: "PATIENT" as const, content: "Yes, took it this morning. Feeling okay today, no palpitations." },
      { role: "AI" as const, content: "Wonderful! No palpitations is great news. Please remember to log your weight and blood pressure when you get a chance. Your next appointment with Dr. Chen is in 3 weeks — anything you'd like me to note for that visit?" },
    ],
  },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🌱 ClawHealth Demo Seed");
  console.log("=".repeat(50));

  // 1. Upsert demo physician
  console.log("\n👨‍⚕️ Creating demo physician…");
  const physician = await prisma.physician.upsert({
    where: { clerkUserId: DEMO_PHYSICIAN_CLERK_ID },
    create: {
      clerkUserId: DEMO_PHYSICIAN_CLERK_ID,
      organizationId: DEMO_ORG_ID,
      encName: encrypt("Dr. Michael Chen"),
      specialty: "Cardiology",
      npi: "1234567890",
    },
    update: {
      organizationId: DEMO_ORG_ID,
      specialty: "Cardiology",
    },
  });
  console.log(`   ✅ Physician: ${physician.id} (Dr. Michael Chen, Cardiology)`);

  // 2. Create patients
  for (const demo of DEMO_PATIENTS) {
    console.log(`\n👤 Creating patient: ${demo.firstName} ${demo.lastName}…`);

    // Upsert patient
    const existing = await prisma.patient.findFirst({ where: { encMrn: encrypt(demo.mrn) } }).catch(() => null);

    let patient;
    try {
      // Try by clerkUserId (unique)
      patient = await prisma.patient.upsert({
        where: { clerkUserId: demo.clerkUserId },
        create: {
          clerkUserId: demo.clerkUserId,
          organizationId: DEMO_ORG_ID,
          physicianId: physician.id,
          encMrn: encrypt(demo.mrn),
          encFirstName: encrypt(demo.firstName),
          encLastName: encrypt(demo.lastName),
          encDateOfBirth: encrypt(demo.dateOfBirth),
          encPhone: encrypt(demo.phone),
          encEmail: encrypt(demo.email),
          encAddress: encrypt(demo.address),
          riskLevel: demo.riskLevel,
          primaryDx: demo.primaryDx,
          encConditions: encryptJSON(demo.conditions),
          lastInteraction: new Date(Date.now() - Math.random() * 86400000 * 3),
          createdBy: DEMO_PHYSICIAN_CLERK_ID,
        },
        update: {
          riskLevel: demo.riskLevel,
          primaryDx: demo.primaryDx,
          lastInteraction: new Date(Date.now() - Math.random() * 86400000 * 3),
        },
      });
    } catch (e) {
      console.error(`   ❌ Failed to upsert patient: ${e}`);
      continue;
    }

    console.log(`   ✅ Patient: ${patient.id}`);

    // Medications
    await prisma.medication.deleteMany({ where: { patientId: patient.id } });
    for (const med of demo.medications) {
      await prisma.medication.create({
        data: {
          patientId: patient.id,
          drugName: med.drugName,
          dose: med.dose,
          frequency: med.frequency,
          route: med.route,
          prescribedBy: physician.id,
          startDate: new Date(Date.now() - 90 * 86400000),
          adherenceRate: med.adherenceRate,
          lastTaken: new Date(Date.now() - Math.random() * 86400000 * 2),
          active: true,
        },
      });
    }
    console.log(`   💊 ${demo.medications.length} medications created`);

    // Vitals
    await prisma.vital.deleteMany({ where: { patientId: patient.id } });
    for (const vital of demo.vitals) {
      // Create 5 readings over the last 7 days
      for (let i = 0; i < 5; i++) {
        const jitter = (Math.random() - 0.5) * 10;
        const rawValue = parseFloat(vital.value) + jitter;
        await prisma.vital.create({
          data: {
            patientId: patient.id,
            type: vital.type,
            encValue: encrypt(rawValue.toFixed(1)),
            unit: vital.unit,
            recordedAt: new Date(Date.now() - i * 86400000 - Math.random() * 43200000),
            source: i % 2 === 0 ? "patient_app" : "device",
          },
        });
      }
    }
    console.log(`   📊 ${demo.vitals.length * 5} vital readings created`);

    // Care plan
    await prisma.carePlan.updateMany({ where: { patientId: patient.id }, data: { active: false } });
    await prisma.carePlan.create({
      data: {
        patientId: patient.id,
        physicianId: physician.id,
        encContent: encrypt(demo.carePlan),
        version: 1,
        active: true,
      },
    });
    console.log(`   📋 Care plan created`);

    // Alerts
    await prisma.alert.deleteMany({ where: { patientId: patient.id } });
    for (const alert of demo.alerts) {
      await prisma.alert.create({
        data: {
          patientId: patient.id,
          severity: alert.severity,
          category: alert.category,
          encMessage: encrypt(alert.message),
          triggerSource: "ai_agent",
          resolved: false,
        },
      });
    }
    console.log(`   🔔 ${demo.alerts.length} alerts created`);

    // Conversations
    await prisma.conversation.deleteMany({ where: { patientId: patient.id } });
    for (let i = 0; i < demo.conversations.length; i++) {
      const conv = demo.conversations[i];
      await prisma.conversation.create({
        data: {
          patientId: patient.id,
          role: conv.role,
          encContent: encrypt(conv.content),
          createdAt: new Date(Date.now() - (demo.conversations.length - i) * 300000),
        },
      });
    }
    console.log(`   💬 ${demo.conversations.length} conversations created`);
  }

  console.log("\n" + "=".repeat(50));
  console.log("✅ Seed complete!\n");
  console.log("Demo credentials:");
  console.log(`  Org ID:        ${DEMO_ORG_ID}`);
  console.log(`  Physician ID:  ${physician.id}`);
  console.log(`  (Clerk auth not seeded — use Clerk Dashboard to create users)`);
  console.log("\nPatients created:");
  DEMO_PATIENTS.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.firstName} ${p.lastName} (${p.mrn}) — ${p.riskLevel}`);
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
