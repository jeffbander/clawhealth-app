export const dynamic = "force-dynamic";
/**
 * /api/patients/me — Get current user's patient record
 * Used by patient portal to get their own patientId
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patient = await prisma.patient.findFirst({
    where: { clerkUserId: userId },
    select: { id: true, riskLevel: true, primaryDx: true, agentEnabled: true },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  return NextResponse.json(patient);
}
