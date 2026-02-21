export const dynamic = "force-dynamic";
/**
 * /api/test/setup — Test data seeding endpoint (development only)
 * Creates physician records for E2E testing
 * MUST NOT exist in production builds
 */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptPHI } from "@/lib/encryption";

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  if (action === "create_physician") {
    const physician = await prisma.physician.create({
      data: {
        clerkUserId: body.clerkUserId || `test_${Date.now()}`,
        organizationId: body.organizationId || "org_test",
        npi: body.npi || `NPI${Date.now()}`,
        specialty: body.specialty || "Cardiology",
        encName: encryptPHI(body.name || "Dr. Test Physician"),
      },
    });
    return NextResponse.json({ id: physician.id, clerkUserId: physician.clerkUserId });
  }

  if (action === "create_patient") {
    const patient = await prisma.patient.create({
      data: {
        clerkUserId: body.clerkUserId || `test_patient_${Date.now()}`,
        organizationId: body.organizationId || "org_test",
        physicianId: body.physicianId,
        encMrn: encryptPHI(body.mrn || "MRN-TEST-001"),
        encFirstName: encryptPHI(body.firstName || "Test"),
        encLastName: encryptPHI(body.lastName || "Patient"),
        encDateOfBirth: encryptPHI(body.dateOfBirth || "1985-01-01"),
        encPhone: body.phone ? encryptPHI(body.phone) : undefined,
        encEmail: body.email ? encryptPHI(body.email) : undefined,
        riskLevel: body.riskLevel || "MEDIUM",
        primaryDx: body.primaryDx,
        encConditions: encryptPHI(JSON.stringify(body.conditions || [])),
        createdBy: body.clerkUserId || "test_setup",
      },
      select: { id: true, riskLevel: true, primaryDx: true, createdAt: true },
    });
    return NextResponse.json(patient, { status: 201 });
  }

  if (action === "cleanup") {
    // Delete test data — only items with org_test
    const deleted = await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { organizationId: "org_test" } }),
      prisma.conversation.deleteMany({
        where: { patient: { organizationId: "org_test" } },
      }),
      prisma.vital.deleteMany({
        where: { patient: { organizationId: "org_test" } },
      }),
      prisma.medication.deleteMany({
        where: { patient: { organizationId: "org_test" } },
      }),
      prisma.alert.deleteMany({
        where: { patient: { organizationId: "org_test" } },
      }),
      prisma.carePlan.deleteMany({
        where: { patient: { organizationId: "org_test" } },
      }),
      prisma.patient.deleteMany({ where: { organizationId: "org_test" } }),
      prisma.physician.deleteMany({ where: { organizationId: "org_test" } }),
    ]);
    return NextResponse.json({ cleaned: true, counts: deleted.map((d) => d.count) });
  }

  if (action === "get_patient") {
    const patient = await prisma.patient.findUnique({
      where: { id: body.patientId },
      select: {
        id: true,
        encFirstName: true,
        encLastName: true,
        encMrn: true,
        encPhone: true,
        riskLevel: true,
        primaryDx: true,
        organizationId: true,
        physicianId: true,
        createdAt: true,
      },
    });
    return NextResponse.json(patient);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
