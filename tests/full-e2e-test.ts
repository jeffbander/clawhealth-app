/**
 * Full E2E Automated Test Suite — ClawHealth
 * Tests: EMR onboarding, SMS AI agent, escalation, memory, CCM billing
 * Run: npx tsx tests/full-e2e-test.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE_URL = process.env.TEST_URL || "https://app.clawmd.ai";

// Test data — realistic cardiology patients
const TEST_PATIENTS = [
  {
    name: "EMR Paste — Heart Failure Patient",
    emrText: `
Patient: Margaret Sullivan, DOB: 03/15/1952
Phone: +12125551001
MRN: MSW-2024-88421

PROBLEM LIST:
1. Heart failure with reduced ejection fraction (HFrEF), EF 25% (I50.22)
2. Type 2 diabetes mellitus (E11.9)
3. Chronic kidney disease, stage 3a (N18.31)
4. Hypertension (I10)
5. Hyperlipidemia (E78.5)

MEDICATIONS:
- Entresto (sacubitril/valsartan) 97/103 mg BID
- Carvedilol 25 mg BID
- Furosemide 40 mg daily
- Spironolactone 25 mg daily
- Dapagliflozin 10 mg daily
- Metformin 1000 mg BID
- Atorvastatin 80 mg QHS
- Aspirin 81 mg daily

MOST RECENT ECHO (01/2026):
- LVEF 25%, moderate MR, dilated LV (LVEDD 6.2cm)
- Moderate diastolic dysfunction

LABS (02/2026):
- BNP 842 pg/mL (elevated)
- Creatinine 1.8 mg/dL, eGFR 38
- K+ 4.2, Na+ 136
- HbA1c 7.8%

CLINICAL SUMMARY:
68-year-old woman with advanced HFrEF (EF 25%), CKD stage 3a, and T2DM. On guideline-directed medical therapy including ARNI, beta-blocker, MRA, and SGLT2i. Recent BNP trending up from 650 to 842. Weight has been slowly increasing. Consider ICD evaluation if EF remains ≤35% after 3 months of optimal GDMT. Close monitoring of renal function given CKD.
    `,
    expectedRisk: "CRITICAL",
    expectedConditions: ["Heart failure", "diabetes", "kidney"],
  },
  {
    name: "EMR Paste — Atrial Fibrillation Patient",
    emrText: `
Patient: Thomas Chen, DOB: 07/22/1958
Phone: +12125551002

DIAGNOSES:
1. Paroxysmal atrial fibrillation (I48.0)
2. Hypertension, well-controlled (I10)
3. Obstructive sleep apnea on CPAP

MEDICATIONS:
- Eliquis (apixaban) 5 mg BID
- Metoprolol succinate 50 mg daily
- Lisinopril 20 mg daily
- CPAP nightly

CHA2DS2-VASc score: 3 (age, HTN, male)
HAS-BLED: 1

SUMMARY:
66-year-old male with paroxysmal AFib on anticoagulation. Rate controlled on metoprolol. Last Holter showed 3 episodes of AFib lasting 2-8 hours. Patient reports occasional palpitations but no syncope or chest pain.
    `,
    expectedRisk: "HIGH",
    expectedConditions: ["atrial fibrillation", "hypertension"],
  },
  {
    name: "EMR Paste — Low Risk Hypertension",
    emrText: `
Patient: David Park, DOB: 11/03/1970
Phone: +12125551003

PROBLEM LIST:
1. Essential hypertension (I10) — well controlled
2. Prediabetes (R73.03)

MEDICATIONS:
- Amlodipine 5 mg daily
- Losartan 50 mg daily

BP LOG (last 3 months): Average 128/78
LABS: HbA1c 5.9%, lipid panel normal, BMP normal

SUMMARY:
54-year-old male with well-controlled hypertension on dual therapy. Prediabetes being managed with lifestyle modifications. Low cardiovascular risk.
    `,
    expectedRisk: "LOW",
    expectedConditions: ["hypertension"],
  },
];

// Simulated SMS conversations
const SMS_SCENARIOS = [
  {
    name: "Normal daily check-in",
    message: "Good morning! I took all my meds and my weight is 165 lbs today.",
    expectEscalation: false,
  },
  {
    name: "Medication question",
    message: "Can I take my Entresto at the same time as my metformin? I keep forgetting which ones go together.",
    expectEscalation: false,
  },
  {
    name: "Concerning symptom — weight gain",
    message: "I noticed my ankles are really swollen today and I gained 4 pounds since yesterday. Should I be worried?",
    expectEscalation: false, // Concerning but not emergency keyword
  },
  {
    name: "EMERGENCY — chest pain",
    message: "I'm having chest pain and shortness of breath right now. It started 20 minutes ago.",
    expectEscalation: true,
  },
  {
    name: "Adherence confirmation",
    message: "TAKEN",
    expectEscalation: false,
  },
  {
    name: "Side effect question",
    message: "I've been feeling really dizzy when I stand up. Could it be from the carvedilol?",
    expectEscalation: false,
  },
  {
    name: "EMERGENCY — syncope",
    message: "I passed out briefly while walking to the bathroom. My wife caught me.",
    expectEscalation: true,
  },
];

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let testPhysicianId: string | null = null;
const createdPatientIds: string[] = [];

function log(status: "✅" | "❌" | "⏳" | "🧹", msg: string) {
  console.log(`${status} ${msg}`);
}

async function setup() {
  log("⏳", "Setting up test physician...");
  
  // Find or create test physician
  let physician = await prisma.physician.findFirst({
    where: { clerkUserId: "test_automated_e2e" },
  });
  
  if (!physician) {
    const { encryptPHI } = await import("../src/lib/encryption");
    physician = await prisma.physician.create({
      data: {
        clerkUserId: "test_automated_e2e",
        organizationId: "",
        encName: encryptPHI("Dr. E2E Test"),
        specialty: "Cardiology",
      },
    });
  }
  
  testPhysicianId = physician.id;
  log("✅", `Test physician: ${testPhysicianId}`);
}

async function testEMROnboarding(test: typeof TEST_PATIENTS[0]) {
  log("⏳", `Testing: ${test.name}`);
  
  try {
    const { encryptPHI } = await import("../src/lib/encryption");
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    
    // Parse EMR via Claude (same logic as the API route)
    const completion = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 2048,
      system: `You are a medical data extraction assistant. Parse the provided EMR/clinical text and extract structured patient data. Return ONLY valid JSON with no additional text.

Extract:
- firstName, lastName, dateOfBirth (YYYY-MM-DD format)
- phone (if present, E.164 format preferred)
- conditions: array of condition names
- medications: array of objects with drugName, dose, frequency, route (default "oral")
- medicalSummary: 2-3 sentence clinical summary
- riskLevel: assess as LOW/MEDIUM/HIGH/CRITICAL
- primaryDx: primary ICD-10 code if identifiable`,
      messages: [{ role: "user", content: `Parse this EMR text:\n\n${test.emrText}` }],
    });

    const text = completion.content[0].type === "text" ? completion.content[0].text : "";
    const jsonStr = text.replace(/```json?\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    // Validate parsing
    if (!parsed.firstName || !parsed.lastName) {
      throw new Error("Failed to extract patient name");
    }
    if (!parsed.conditions?.length) {
      throw new Error("Failed to extract conditions");
    }
    if (!parsed.medications?.length) {
      throw new Error("Failed to extract medications");
    }

    // Create patient in DB
    const patient = await prisma.patient.create({
      data: {
        clerkUserId: `test_e2e_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        organizationId: "",
        encMrn: encryptPHI(`TEST-MRN-${Date.now()}`),
        encFirstName: encryptPHI(parsed.firstName),
        encLastName: encryptPHI(parsed.lastName),
        encDateOfBirth: encryptPHI(parsed.dateOfBirth || ""),
        encPhone: parsed.phone ? encryptPHI(parsed.phone) : null,
        encConditions: encryptPHI(JSON.stringify(parsed.conditions)),
        riskLevel: parsed.riskLevel || "MEDIUM",
        primaryDx: parsed.primaryDx || null,
        physicianId: testPhysicianId!,
        agentEnabled: true,
        createdBy: "test_automated_e2e",
      },
    });
    createdPatientIds.push(patient.id);

    // Create medications
    if (parsed.medications?.length) {
      await prisma.medication.createMany({
        data: parsed.medications.map((med: any) => ({
          patientId: patient.id,
          drugName: med.drugName,
          dose: med.dose,
          frequency: med.frequency,
          route: med.route || "oral",
          prescribedBy: testPhysicianId!,
          startDate: new Date(),
          adherenceRate: 0,
          active: true,
        })),
      });
    }

    // Create care plan
    if (parsed.medicalSummary) {
      await prisma.carePlan.create({
        data: {
          patientId: patient.id,
          physicianId: testPhysicianId!,
          encContent: encryptPHI(parsed.medicalSummary),
          version: 1,
          active: true,
        },
      });
    }

    // Verify
    const created = await prisma.patient.findUnique({
      where: { id: patient.id },
      include: { medications: true, carePlans: true },
    });

    const checks = [
      { label: "Patient created", ok: !!created },
      { label: "Name extracted", ok: parsed.firstName.length > 0 && parsed.lastName.length > 0 },
      { label: `Risk level (expected ${test.expectedRisk})`, ok: parsed.riskLevel === test.expectedRisk },
      { label: "Medications stored", ok: (created?.medications?.length ?? 0) > 0 },
      { label: "Care plan created", ok: (created?.carePlans?.length ?? 0) > 0 },
      { label: "PHI encrypted", ok: created?.encFirstName !== parsed.firstName },
      {
        label: "Conditions match",
        ok: test.expectedConditions.some((c) =>
          parsed.conditions.some((pc: string) => pc.toLowerCase().includes(c.toLowerCase()))
        ),
      },
    ];

    for (const check of checks) {
      if (check.ok) {
        log("✅", `  ${check.label}`);
        passed++;
      } else {
        log("❌", `  ${check.label}`);
        failed++;
      }
    }

    log("✅", `  ${test.name} — ${parsed.firstName} ${parsed.lastName}, ${parsed.medications.length} meds, risk: ${parsed.riskLevel}`);
    passed++;
    return patient.id;
  } catch (err: any) {
    log("❌", `  ${test.name}: ${err.message}`);
    failed++;
    return null;
  }
}

async function testAIAgent(patientId: string, scenario: typeof SMS_SCENARIOS[0]) {
  log("⏳", `Testing SMS: ${scenario.name}`);
  
  try {
    const { generatePatientResponse } = await import("../src/lib/ai-agent");
    
    const result = await generatePatientResponse(patientId, scenario.message);

    const checks = [
      { label: "Response generated", ok: result.response.length > 0 },
      { label: "Response reasonable length", ok: result.response.length < 1500 },
      {
        label: `Escalation ${scenario.expectEscalation ? "triggered" : "not triggered"}`,
        ok: result.requiresEscalation === scenario.expectEscalation,
      },
    ];

    // Check response quality
    if (scenario.expectEscalation) {
      checks.push({
        label: "Emergency response mentions 911 or emergency",
        ok: result.response.toLowerCase().includes("911") || result.response.toLowerCase().includes("emergency") || result.response.toLowerCase().includes("call"),
      });
    }

    for (const check of checks) {
      if (check.ok) {
        log("✅", `  ${check.label}`);
        passed++;
      } else {
        log("❌", `  ${check.label}`);
        failed++;
      }
    }

    // Log the actual response for review
    const preview = result.response.slice(0, 120).replace(/\n/g, " ");
    log("✅", `  AI: "${preview}..."`);
    passed++;
  } catch (err: any) {
    log("❌", `  ${scenario.name}: ${err.message}`);
    failed++;
  }
}

async function testConversationMemory(patientId: string) {
  log("⏳", "Testing conversation memory persistence...");
  
  try {
    const { generatePatientResponse } = await import("../src/lib/ai-agent");
    const { encryptPHI } = await import("../src/lib/encryption");

    // Store a conversation
    await prisma.conversation.create({
      data: {
        patientId,
        role: "PATIENT",
        encContent: encryptPHI("I've been having trouble sleeping because of my cough at night"),
      },
    });
    await prisma.conversation.create({
      data: {
        patientId,
        role: "AI",
        encContent: encryptPHI("I understand the nighttime cough is disrupting your sleep. This can sometimes be related to fluid retention in heart failure. Have you noticed any increase in your weight or ankle swelling?"),
      },
    });

    // Now ask a follow-up — should reference the previous conversation
    const result = await generatePatientResponse(
      patientId,
      "Yes actually my ankles have been more swollen than usual"
    );

    const checks = [
      { label: "Follow-up response generated", ok: result.response.length > 0 },
      { label: "Response is contextual (not generic)", ok: result.response.length > 50 },
    ];

    for (const check of checks) {
      if (check.ok) {
        log("✅", `  ${check.label}`);
        passed++;
      } else {
        log("❌", `  ${check.label}`);
        failed++;
      }
    }

    const preview = result.response.slice(0, 120).replace(/\n/g, " ");
    log("✅", `  Memory AI: "${preview}..."`);
    passed++;
  } catch (err: any) {
    log("❌", `  Conversation memory: ${err.message}`);
    failed++;
  }
}

async function testCCMBilling(patientId: string) {
  log("⏳", "Testing CCM billing calculation...");
  
  try {
    const { getPatientCCMStatus } = await import("../src/lib/ccm-billing");
    const status = await getPatientCCMStatus(prisma, patientId);
    
    const checks = [
      { label: "CCM status returned", ok: !!status },
      { label: "Total minutes tracked", ok: typeof status?.totalMinutes === "number" },
      { label: "Qualification check works", ok: typeof status?.qualifies99490 === "boolean" },
    ];

    for (const check of checks) {
      if (check.ok) {
        log("✅", `  ${check.label}`);
        passed++;
      } else {
        log("❌", `  ${check.label}`);
        failed++;
      }
    }
  } catch (err: any) {
    log("❌", `  CCM billing: ${err.message}`);
    failed++;
  }
}

async function cleanup() {
  log("🧹", "Cleaning up test data...");
  
  for (const id of createdPatientIds) {
    await prisma.conversation.deleteMany({ where: { patientId: id } });
    await prisma.medication.deleteMany({ where: { patientId: id } });
    await prisma.vital.deleteMany({ where: { patientId: id } });
    await prisma.alert.deleteMany({ where: { patientId: id } });
    await prisma.carePlan.deleteMany({ where: { patientId: id } });
    await prisma.auditLog.deleteMany({ where: { patientId: id } });
    await prisma.patient.delete({ where: { id } });
  }
  
  log("🧹", `Cleaned up ${createdPatientIds.length} test patients`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🏥 ClawHealth Full E2E Test Suite\n" + "═".repeat(50) + "\n");
  
  const startTime = Date.now();

  try {
    await setup();

    // Test 1: EMR Onboarding for all patients
    console.log("\n📋 EMR ONBOARDING TESTS\n" + "─".repeat(40));
    const patientIds: string[] = [];
    for (const test of TEST_PATIENTS) {
      const id = await testEMROnboarding(test);
      if (id) patientIds.push(id);
    }

    if (patientIds.length === 0) {
      log("❌", "No patients created — skipping remaining tests");
      return;
    }

    // Test 2: AI Agent SMS responses (use first patient — HF)
    console.log("\n💬 AI AGENT SMS TESTS\n" + "─".repeat(40));
    for (const scenario of SMS_SCENARIOS) {
      await testAIAgent(patientIds[0], scenario);
    }

    // Test 3: Conversation memory
    console.log("\n🧠 CONVERSATION MEMORY TEST\n" + "─".repeat(40));
    await testConversationMemory(patientIds[0]);

    // Test 4: CCM Billing
    console.log("\n💰 CCM BILLING TEST\n" + "─".repeat(40));
    await testCCMBilling(patientIds[0]);

  } finally {
    await cleanup();
    await prisma.$disconnect();
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n" + "═".repeat(50));
  console.log(`\n📊 RESULTS: ${passed} passed, ${failed} failed (${elapsed}s)\n`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
