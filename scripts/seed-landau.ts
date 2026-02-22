/**
 * Seed Joel Landau as a ClawHealth VIP patient
 * Pulls structured data from landau-health-portal static files
 * Run: npx tsx scripts/seed-landau.ts
 */
import { PrismaClient } from "@prisma/client";
import { encryptPHI } from "../src/lib/encryption.js";

const prisma = new PrismaClient();

// ─── Joel's Clinical Data (from landau-health-portal/src/data/) ──────────────

const PATIENT = {
  firstName: "Joel",
  lastName: "Landau",
  dob: "1978-01-01", // Year only in source
  phone: "+15555550000", // Placeholder — Jeff will provide real number later
};

const CONDITIONS = [
  "Open-angle Glaucoma",
  "Optic Neuropathy",
  "Thyroid Nodule",
  "Hypothyroidism",
  "Prediabetes / Insulin Resistance",
  "Hyperlipidemia",
  "Hypertension",
  "Coronary Atherosclerosis (LBBB)",
  "Overweight / Obesity",
  "Sleep Apnea (subclinical)",
  "Vitamin D Deficiency",
];

const MEDICATIONS = [
  { drugName: "Mounjaro", dose: "15mg weekly", frequency: "weekly", route: "subcutaneous", active: true, note: "GLP-1/GIP agonist. Titrated 3.75→15mg. 70% LDL reduction, major metabolic improvement" },
  { drugName: "Metformin", dose: "1000mg", frequency: "BID", route: "oral", active: true, note: "Insulin sensitizer for prediabetes" },
  { drugName: "Jardiance", dose: "10mg", frequency: "daily", route: "oral", active: true, note: "SGLT2 inhibitor for glucose control" },
  { drugName: "Propranolol", dose: "10mg", frequency: "BID", route: "oral", active: true, note: "Beta-blocker for thyroid crisis / heart rate" },
  { drugName: "Latanoprost", dose: "0.005% drops", frequency: "daily", route: "ophthalmic", active: true, note: "Prostaglandin analog for glaucoma" },
  { drugName: "Rhopressa", dose: "eye drops", frequency: "daily", route: "ophthalmic", active: true, note: "Rho kinase inhibitor for ocular hypertension" },
  { drugName: "Vitamin D", dose: "4000-5000 IU", frequency: "daily", route: "oral", active: true, note: "Target >50 ng/mL. Last 34.4 ng/mL" },
  { drugName: "Vitamin B Complex", dose: "P5P 50mg + methylfolate", frequency: "daily", route: "oral", active: true, note: "Methylation support for elevated homocysteine (12.2)" },
  { drugName: "Magnesium", dose: "supplement", frequency: "daily", route: "oral", active: true, note: "RBC Mg 6.7 (elevated, adequate stores)" },
  { drugName: "Omega-3", dose: "2-3g", frequency: "daily", route: "oral", active: true, note: "LDL particle quality improvement" },
  { drugName: "CoQ10", dose: "supplement", frequency: "daily", route: "oral", active: true, note: "Cardiac support antioxidant" },
  { drugName: "Berberine", dose: "supplement", frequency: "daily", route: "oral", active: true, note: "Metabolic optimization per Fountain Life" },
  { drugName: "Baclofen", dose: "5mg", frequency: "PRN", route: "oral", active: true, note: "Muscle relaxant" },
  // Discontinued
  { drugName: "Adderall", dose: "10mg PRN", frequency: "PRN", route: "oral", active: false, note: "CONTRAINDICATED with LBBB — discontinued" },
  { drugName: "Repatha", dose: "140mg", frequency: "every 2 weeks", route: "subcutaneous", active: false, note: "PCSK9 inhibitor — NEEDS RESTART. Was stopped, significant LDL benefit" },
];

const MEDICAL_SUMMARY = `Joel Landau, 47M with complex multi-system disease:

CARDIAC: Coronary atherosclerosis with LEFT BUNDLE BRANCH BLOCK (LBBB). On Propranolol for rate control. Adderall CONTRAINDICATED. Recent cardiac MRI showed preserved EF. CAC score elevated.

METABOLIC: Prediabetes/insulin resistance on triple therapy (Mounjaro 15mg weekly + Metformin 1000mg BID + Jardiance 10mg daily). Remarkable response to Mounjaro — 70% LDL reduction, significant metabolic improvement. HbA1c trending down. Hyperlipidemia — Repatha (PCSK9i) NEEDS TO BE RESTARTED.

OPHTHALMOLOGY: Bilateral primary open-angle glaucoma (POAG), SEVERE stage. Asymmetric — OS significantly worse than OD. On Latanoprost + Rhopressa. Under care of Jeffrey Liebmann, MD (Columbia). Requires close IOP and visual field monitoring. NOTE: Mounjaro (GLP-1) has potential eye implications — monitor.

THYROID: Thyroid nodule + hypothyroidism. On monitoring. Propranolol added during thyroid crisis episode (Dec 2024).

WEIGHT: Overweight/obesity. On Mounjaro (GLP-1/GIP). Previous trials of Saxenda, Wegovy, Contrave were ineffective. Current weight trending down. VAT (visceral fat) 1,338g — CRITICAL (goal <300g). Lumbar spine osteopenia (T-score -1.6) from DEXA — NEW finding.

KEY ALERTS:
⚠️ REPATHA NEEDS RESTART — significant LDL benefit, currently stopped
⚠️ ADDERALL CONTRAINDICATED — LBBB
⚠️ VAT 1,338g — 4.5x above goal
⚠️ Vitamin D suboptimal at 34.4 ng/mL (target >50)
⚠️ Glaucoma OS severe — close monitoring required

449 medical files, 961 pages, 30+ providers, spanning 2011-2026.`;

// ─── Seed ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🏥 Seeding Joel Landau as ClawHealth VIP patient...\n");

  // Find the cardiology physician
  let physician = await prisma.physician.findFirst({
    where: { specialty: "Cardiology" },
    orderBy: { createdAt: "asc" },
  });

  if (!physician) {
    physician = await prisma.physician.create({
      data: {
        clerkUserId: "system_default",
        organizationId: "",
        encName: encryptPHI("Dr. Jeffrey Bander"),
        specialty: "Cardiology",
      },
    });
  }

  // Check for existing patient (avoid duplicates)
  const existing = await prisma.patient.findMany({
    where: { createdBy: "landau_portal_import" },
  });
  if (existing.length > 0) {
    console.log("⚠️  Joel Landau already exists. Deleting and re-seeding...");
    for (const p of existing) {
      await prisma.conversation.deleteMany({ where: { patientId: p.id } });
      await prisma.medication.deleteMany({ where: { patientId: p.id } });
      await prisma.vital.deleteMany({ where: { patientId: p.id } });
      await prisma.alert.deleteMany({ where: { patientId: p.id } });
      await prisma.carePlan.deleteMany({ where: { patientId: p.id } });
      await prisma.patient.delete({ where: { id: p.id } });
    }
  }

  // Create patient
  const patient = await prisma.patient.create({
    data: {
      clerkUserId: "patient_vip_landau",
      organizationId: "",
      encMrn: encryptPHI("VIP-LANDAU-001"),
      encFirstName: encryptPHI(PATIENT.firstName),
      encLastName: encryptPHI(PATIENT.lastName),
      encDateOfBirth: encryptPHI(PATIENT.dob),
      encPhone: encryptPHI(PATIENT.phone),
      encConditions: encryptPHI(JSON.stringify(CONDITIONS)),
      riskLevel: "HIGH", // LBBB + glaucoma + metabolic syndrome
      primaryDx: "I25.10", // Coronary atherosclerosis
      physicianId: physician.id,
      agentEnabled: true,
      createdBy: "landau_portal_import",
    },
  });
  console.log(`✅ Patient created: ${patient.id}`);

  // Create medications
  for (const med of MEDICATIONS) {
    await prisma.medication.create({
      data: {
        patientId: patient.id,
        drugName: med.drugName,
        dose: med.dose,
        frequency: med.frequency,
        route: med.route,
        prescribedBy: physician.id,
        startDate: new Date(),
        adherenceRate: med.active ? 85 : 0,
        active: med.active,
      },
    });
  }
  console.log(`✅ ${MEDICATIONS.length} medications created (${MEDICATIONS.filter(m => m.active).length} active)`);

  // Create comprehensive care plan
  await prisma.carePlan.create({
    data: {
      patientId: patient.id,
      physicianId: physician.id,
      encContent: encryptPHI(MEDICAL_SUMMARY),
      version: 1,
      active: true,
    },
  });
  console.log(`✅ Care plan created with full clinical summary`);

  // Create initial conversation with context
  await prisma.conversation.create({
    data: {
      patientId: patient.id,
      role: "AI",
      encContent: encryptPHI(
        `VIP patient imported from Landau Health Portal. 449 medical files, 961 pages, 30+ providers, spanning 2011-2026. ` +
        `11 active conditions, 13 active medications. Key alerts: Repatha needs restart, Adderall contraindicated (LBBB), ` +
        `VAT critically elevated, glaucoma OS severe, Vitamin D suboptimal.`
      ),
      audioUrl: "system://landau-portal-import",
    },
  });

  // Create standing alerts
  const alerts = [
    { severity: "HIGH", category: "medication", message: "REPATHA (PCSK9 inhibitor) needs to be RESTARTED. Previously showed significant LDL reduction. Currently stopped." },
    { severity: "CRITICAL", category: "labs", message: "VAT (visceral adipose tissue) 1,338g — 4.5x above goal of <300g. Critical metabolic risk factor." },
    { severity: "MEDIUM", category: "labs", message: "Vitamin D at 34.4 ng/mL — below target of >50 ng/mL. Current supplementation may be insufficient." },
  ];

  for (const alert of alerts) {
    await prisma.alert.create({
      data: {
        patientId: patient.id,
        severity: alert.severity as "HIGH" | "CRITICAL" | "MEDIUM",
        category: alert.category,
        encMessage: encryptPHI(alert.message),
        triggerSource: "landau_portal_import",
      },
    });
  }
  console.log(`✅ ${alerts.length} clinical alerts created`);

  console.log(`\n🎉 Joel Landau seeded as VIP patient`);
  console.log(`   ID: ${patient.id}`);
  console.log(`   Phone: ${PATIENT.phone} (placeholder — update when ready)`);
  console.log(`   Risk: HIGH`);
  console.log(`   Conditions: ${CONDITIONS.length}`);
  console.log(`   Medications: ${MEDICATIONS.length}`);
  console.log(`   Ready for SMS once real phone number is set\n`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal:", err);
  prisma.$disconnect();
  process.exit(1);
});
