/**
 * Seed realistic demo data for ClawHealth
 * Creates patients with full clinical histories, vitals, meds, conversations, alerts
 * Run: npx tsx scripts/seed-demo.ts
 */
import { PrismaClient } from "@prisma/client";
import { createCipheriv, randomBytes } from "crypto";

const prisma = new PrismaClient();

// Encryption matching src/lib/encryption.ts
const KEY = Buffer.from(process.env.PHI_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || "", "hex");
function encryptPHI(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

// Clerk user ID for the test account
const CLERK_USER_ID = "user_39x8yCTmOz97lPqXPwBnGlnaY1g";
const ORG_ID = "org_demo";

// Realistic cardiology patients
const PATIENTS = [
  {
    firstName: "Mary", lastName: "Johnson", dob: "1958-03-22", mrn: "MSW-2024-001847",
    phone: "(212) 555-0147", email: "mary.j@gmail.com",
    address: "425 West 59th Street, Apt 12B, New York, NY 10019",
    riskLevel: "CRITICAL", primaryDx: "I50.9",
    conditions: ["Heart Failure", "Type 2 Diabetes", "Hypertension", "Chronic Kidney Disease"],
    meds: [
      { drug: "Lisinopril", dose: "20mg", freq: "daily", adherence: 62 },
      { drug: "Metoprolol Succinate", dose: "50mg", freq: "daily", adherence: 78 },
      { drug: "Furosemide", dose: "40mg", freq: "daily", adherence: 55 },
      { drug: "Metformin", dose: "1000mg", freq: "twice daily", adherence: 71 },
      { drug: "Empagliflozin", dose: "10mg", freq: "daily", adherence: 85 },
    ],
    vitals: [
      { type: "BLOOD_PRESSURE_SYSTOLIC", values: [158, 162, 155, 148, 151, 145, 142] },
      { type: "BLOOD_PRESSURE_DIASTOLIC", values: [94, 98, 92, 88, 90, 86, 85] },
      { type: "HEART_RATE", values: [88, 92, 85, 90, 82, 78, 80] },
      { type: "WEIGHT", values: [187, 189, 191, 190, 188, 186, 185] },
      { type: "GLUCOSE", values: [182, 195, 178, 165, 172, 158, 162] },
      { type: "OXYGEN_SATURATION", values: [94, 93, 95, 94, 96, 95, 96] },
    ],
    conversations: [
      { role: "AI", content: "Good morning Mary! This is your ClawHealth coordinator. How are you feeling today? Have you taken your morning medications?" },
      { role: "PATIENT", content: "Not great. I've been more short of breath going up stairs and my ankles are swollen again" },
      { role: "AI", content: "I'm sorry to hear that, Mary. Increased shortness of breath and ankle swelling can be signs of fluid retention. Have you been taking your Furosemide (water pill) daily? Also, what was your weight this morning?" },
      { role: "PATIENT", content: "I forgot the water pill yesterday. Weight is 191 which is up from last week" },
      { role: "AI", content: "Thank you for letting me know. A 3-pound weight gain along with swelling and shortness of breath is concerning. I'm flagging this for Dr. Bander's review. In the meantime, please take your Furosemide today and try to limit salt intake. Can you check your blood pressure for me?" },
      { role: "PATIENT", content: "It's 158/94" },
      { role: "AI", content: "Your blood pressure is elevated. I've notified Dr. Bander about your symptoms — the weight gain, swelling, shortness of breath, and elevated BP. He may want to adjust your medications. Please call 911 if you experience chest pain, severe difficulty breathing, or feel faint. I'll check in with you again this evening." },
    ],
    alerts: [
      { severity: "CRITICAL", category: "symptom", message: "Patient reports worsening dyspnea on exertion and bilateral ankle edema. Weight up 3 lbs in 7 days. BP 158/94. Possible HF decompensation." },
      { severity: "HIGH", category: "medication", message: "Furosemide adherence dropped to 55%. Patient missed dose yesterday. Correlates with fluid retention symptoms." },
    ],
  },
  {
    firstName: "Robert", lastName: "Chen", dob: "1965-11-08", mrn: "MSW-2024-002391",
    phone: "(917) 555-0283", email: "rchen65@outlook.com",
    address: "88 Greenwich Street, New York, NY 10006",
    riskLevel: "HIGH", primaryDx: "I48.91",
    conditions: ["Atrial Fibrillation", "Hypertension", "Hyperlipidemia", "Post-Cardiac Stent"],
    meds: [
      { drug: "Eliquis (Apixaban)", dose: "5mg", freq: "twice daily", adherence: 92 },
      { drug: "Metoprolol Succinate", dose: "100mg", freq: "daily", adherence: 88 },
      { drug: "Atorvastatin", dose: "80mg", freq: "daily", adherence: 95 },
      { drug: "Amlodipine", dose: "10mg", freq: "daily", adherence: 90 },
      { drug: "Aspirin", dose: "81mg", freq: "daily", adherence: 97 },
    ],
    vitals: [
      { type: "BLOOD_PRESSURE_SYSTOLIC", values: [132, 128, 135, 130, 126, 124, 128] },
      { type: "BLOOD_PRESSURE_DIASTOLIC", values: [82, 78, 84, 80, 76, 74, 78] },
      { type: "HEART_RATE", values: [72, 68, 110, 75, 70, 66, 72] },
      { type: "WEIGHT", values: [195, 195, 194, 195, 194, 193, 194] },
    ],
    conversations: [
      { role: "AI", content: "Hi Robert! Time for your daily check-in. How's the heart rhythm feeling today? Any palpitations?" },
      { role: "PATIENT", content: "Had some fluttering yesterday evening but it resolved after about 30 minutes. Took my meds on time." },
      { role: "AI", content: "Good that it resolved on its own and that you're staying on top of your medications. A 30-minute episode of palpitations is worth noting. Was it associated with any dizziness, chest pain, or shortness of breath?" },
      { role: "PATIENT", content: "No other symptoms. I was just watching TV when it started" },
      { role: "AI", content: "That's reassuring. I'll log this episode for Dr. Bander. Since it was brief and without other symptoms, continue your current regimen. If episodes become more frequent or last longer than an hour, please contact us immediately. Your next cardiology follow-up is in 2 weeks." },
    ],
    alerts: [
      { severity: "MEDIUM", category: "symptom", message: "Patient reports 30-minute palpitation episode. No associated symptoms. Self-resolved. AFib breakthrough on rate control." },
    ],
  },
  {
    firstName: "Linda", lastName: "Washington", dob: "1972-07-14", mrn: "MSW-2024-003158",
    phone: "(646) 555-0391", email: "lwashington72@yahoo.com",
    address: "1560 Amsterdam Avenue, Apt 4D, New York, NY 10031",
    riskLevel: "HIGH", primaryDx: "I25.10",
    conditions: ["Coronary Artery Disease", "Type 2 Diabetes", "Obesity", "Hypertension"],
    meds: [
      { drug: "Atorvastatin", dose: "40mg", freq: "daily", adherence: 45 },
      { drug: "Metformin", dose: "1500mg", freq: "twice daily", adherence: 52 },
      { drug: "Lisinopril", dose: "10mg", freq: "daily", adherence: 48 },
      { drug: "Aspirin", dose: "81mg", freq: "daily", adherence: 60 },
      { drug: "Semaglutide", dose: "0.5mg", freq: "weekly", adherence: 38 },
    ],
    vitals: [
      { type: "BLOOD_PRESSURE_SYSTOLIC", values: [148, 152, 145, 150, 155, 142, 148] },
      { type: "BLOOD_PRESSURE_DIASTOLIC", values: [92, 95, 90, 93, 96, 88, 92] },
      { type: "HEART_RATE", values: [78, 82, 76, 80, 84, 75, 79] },
      { type: "WEIGHT", values: [242, 243, 244, 242, 241, 240, 241] },
      { type: "GLUCOSE", values: [210, 225, 198, 215, 230, 205, 218] },
    ],
    conversations: [
      { role: "AI", content: "Hi Linda, this is your ClawHealth coordinator. I noticed you haven't logged your medications for the past 3 days. Is everything okay?" },
      { role: "PATIENT", content: "Sorry I've been busy with work. The pills make me feel nauseous so I skip them sometimes" },
      { role: "AI", content: "I understand, Linda. Nausea is a common side effect, especially with Metformin. There are ways to manage this — taking it with food can help significantly. Your medication adherence has been declining, and with your diabetes and heart disease, consistent treatment is really important. Would you like me to flag the nausea for Dr. Bander? He may be able to switch to an extended-release formulation." },
      { role: "PATIENT", content: "Yes please. Also my blood sugar has been high lately" },
      { role: "AI", content: "I see your recent glucose readings have been averaging around 215 mg/dL, which is above target. This is likely related to the missed medications. I'm escalating this to Dr. Bander with a recommendation to review your diabetes management plan. In the meantime, please try to take your Metformin with meals, and your Semaglutide injection is due this Friday." },
    ],
    alerts: [
      { severity: "HIGH", category: "medication", message: "Critically low medication adherence: Semaglutide 38%, Atorvastatin 45%, Lisinopril 48%. Patient reports nausea as barrier. Needs medication review." },
      { severity: "HIGH", category: "labs", message: "Average glucose 215 mg/dL (target <180). A1C likely above 9%. Diabetes management plan review recommended." },
      { severity: "MEDIUM", category: "vitals", message: "Blood pressure consistently above 140/90 despite antihypertensive therapy. Likely related to adherence issues." },
    ],
  },
  {
    firstName: "James", lastName: "Petrov", dob: "1980-01-30", mrn: "MSW-2024-004022",
    phone: "(347) 555-0517", email: "jpetrov80@gmail.com",
    address: "312 East 23rd Street, New York, NY 10010",
    riskLevel: "MEDIUM", primaryDx: "I10",
    conditions: ["Hypertension", "Hyperlipidemia"],
    meds: [
      { drug: "Losartan", dose: "50mg", freq: "daily", adherence: 94 },
      { drug: "Rosuvastatin", dose: "20mg", freq: "daily", adherence: 91 },
    ],
    vitals: [
      { type: "BLOOD_PRESSURE_SYSTOLIC", values: [128, 125, 130, 126, 122, 124, 120] },
      { type: "BLOOD_PRESSURE_DIASTOLIC", values: [80, 78, 82, 79, 76, 77, 75] },
      { type: "HEART_RATE", values: [68, 70, 65, 72, 66, 68, 64] },
      { type: "WEIGHT", values: [178, 177, 178, 176, 177, 176, 175] },
    ],
    conversations: [
      { role: "AI", content: "Hi James! Quick daily check-in. How's everything going?" },
      { role: "PATIENT", content: "Feeling good. BP was 120/75 this morning. Went for a 3 mile run yesterday" },
      { role: "AI", content: "That's excellent, James! Your blood pressure is right at target and the exercise is fantastic for your heart health. Keep up the great work. Your next lab draw is scheduled for March 5th — we'll check your lipid panel then. Anything else I can help with?" },
      { role: "PATIENT", content: "Nope all good thanks" },
    ],
    alerts: [],
  },
  {
    firstName: "Gloria", lastName: "Martinez", dob: "1950-09-05", mrn: "MSW-2024-004789",
    phone: "(929) 555-0642", email: "gloria.m50@aol.com",
    address: "89-15 Parsons Blvd, Jamaica, NY 11432",
    riskLevel: "LOW", primaryDx: "I10",
    conditions: ["Hypertension"],
    meds: [
      { drug: "Amlodipine", dose: "5mg", freq: "daily", adherence: 98 },
      { drug: "Hydrochlorothiazide", dose: "12.5mg", freq: "daily", adherence: 96 },
    ],
    vitals: [
      { type: "BLOOD_PRESSURE_SYSTOLIC", values: [122, 118, 120, 116, 124, 119, 118] },
      { type: "BLOOD_PRESSURE_DIASTOLIC", values: [74, 72, 73, 70, 76, 72, 71] },
      { type: "HEART_RATE", values: [72, 70, 68, 74, 70, 72, 69] },
    ],
    conversations: [
      { role: "AI", content: "Good morning Gloria! Just checking in. How are you today?" },
      { role: "PATIENT", content: "Wonderful dear. Blood pressure was 118/71 today. I've been walking every morning in the park" },
      { role: "AI", content: "That's wonderful to hear, Gloria! Your blood pressure is beautifully controlled and daily walks are one of the best things you can do. Your medication adherence has been outstanding — 98%! You're one of our star patients. Keep it up!" },
    ],
    alerts: [],
  },
];

async function seed() {
  console.log("🌱 Seeding ClawHealth demo data...\n");

  // Create physician
  const physician = await prisma.physician.upsert({
    where: { clerkUserId: CLERK_USER_ID },
    update: {},
    create: {
      clerkUserId: CLERK_USER_ID,
      organizationId: ORG_ID,
      npi: "1234567890",
      specialty: "Cardiology",
      encName: encryptPHI("Jeffrey Bander, MD"),
    },
  });
  console.log(`✓ Physician: ${physician.id}`);

  for (const p of PATIENTS) {
    // Create patient
    const patient = await prisma.patient.create({
      data: {
        clerkUserId: `demo_patient_${p.mrn}`,
        organizationId: ORG_ID,
        physicianId: physician.id,
        encMrn: encryptPHI(p.mrn),
        encFirstName: encryptPHI(p.firstName),
        encLastName: encryptPHI(p.lastName),
        encDateOfBirth: encryptPHI(p.dob),
        encPhone: p.phone ? encryptPHI(p.phone) : undefined,
        encEmail: p.email ? encryptPHI(p.email) : undefined,
        encAddress: p.address ? encryptPHI(p.address) : undefined,
        riskLevel: p.riskLevel,
        primaryDx: p.primaryDx,
        encConditions: encryptPHI(JSON.stringify(p.conditions)),
        agentEnabled: true,
        lastInteraction: new Date(Date.now() - Math.random() * 86400000),
        createdBy: CLERK_USER_ID,
      },
    });
    console.log(`  ✓ Patient: ${p.firstName} ${p.lastName} (${p.riskLevel}) — ${patient.id}`);

    // Medications
    for (const m of p.meds) {
      await prisma.medication.create({
        data: {
          patientId: patient.id,
          drugName: m.drug,
          dose: m.dose,
          frequency: m.freq,
          adherenceRate: m.adherence,
          active: true,
          prescribedBy: physician.id,
          startDate: new Date(Date.now() - 90 * 86400000 + Math.random() * 30 * 86400000),
        },
      });
    }
    console.log(`    ✓ ${p.meds.length} medications`);

    // Vitals (past 7 days)
    for (const v of p.vitals) {
      for (let i = 0; i < v.values.length; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (v.values.length - 1 - i));
        date.setHours(8 + Math.floor(Math.random() * 4), Math.floor(Math.random() * 60));
        await prisma.vital.create({
          data: {
            patientId: patient.id,
            type: v.type as any,
            encValue: encryptPHI(String(v.values[i])),
            unit: v.type.includes("BLOOD_PRESSURE") ? "mmHg" : v.type === "HEART_RATE" ? "bpm" : v.type === "WEIGHT" ? "lbs" : v.type === "GLUCOSE" ? "mg/dL" : v.type === "OXYGEN_SATURATION" ? "%" : "°F",
            recordedAt: date,
            source: "patient_reported",
          },
        });
      }
    }
    console.log(`    ✓ ${p.vitals.reduce((a, v) => a + v.values.length, 0)} vital readings`);

    // Conversations
    for (let i = 0; i < p.conversations.length; i++) {
      const c = p.conversations[i];
      const date = new Date();
      date.setHours(date.getHours() - (p.conversations.length - i) * 2);
      await prisma.conversation.create({
        data: {
          patientId: patient.id,
          role: c.role as any,
          encContent: encryptPHI(c.content),
          audioUrl: c.role === "PATIENT" ? "twilio://sms/demo" : undefined,
          createdAt: date,
        },
      });
    }
    console.log(`    ✓ ${p.conversations.length} conversations`);

    // Alerts
    for (const a of p.alerts) {
      const date = new Date();
      date.setHours(date.getHours() - Math.floor(Math.random() * 48));
      await prisma.alert.create({
        data: {
          patientId: patient.id,
          severity: a.severity as any,
          category: a.category,
          encMessage: encryptPHI(a.message),
          triggerSource: "ai_agent",
          resolved: false,
          createdAt: date,
        },
      });
    }
    if (p.alerts.length) console.log(`    ✓ ${p.alerts.length} alerts`);

    // Care plan for high/critical patients
    if (["CRITICAL", "HIGH"].includes(p.riskLevel)) {
      await prisma.carePlan.create({
        data: {
          patientId: patient.id,
          physicianId: physician.id,
          encContent: encryptPHI(JSON.stringify({
            summary: `Comprehensive care plan for ${p.firstName} ${p.lastName}. Dx: ${p.primaryDx}.`,
            goals: [`Optimize ${p.primaryDx} management`, "Improve medication adherence to >80%", "Blood pressure target <130/80", "Monthly follow-up visits"],
            interventions: ["Daily AI check-in via SMS/voice", "Weekly vitals review by physician", "Medication reminders twice daily", "Dietary counseling referral"],
            reviewDate: new Date(Date.now() + 30 * 86400000).toISOString(),
          })),
          active: true,
        },
      });
      console.log(`    ✓ Care plan created`);
    }
  }

  // Skip audit log — schema mismatch is non-critical

  console.log(`\n✅ Seeded ${PATIENTS.length} patients with full clinical data`);
  console.log("   Patients: Mary Johnson (CRITICAL), Robert Chen (HIGH), Linda Washington (HIGH), James Petrov (MEDIUM), Gloria Martinez (LOW)");
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
