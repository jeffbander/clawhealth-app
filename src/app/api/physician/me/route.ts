export const dynamic = "force-dynamic";
/**
 * /api/physician/me
 * GET: get current user's physician record (or create one)
 */
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptPHI } from "@/lib/encryption";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let physician = await prisma.physician.findFirst({
    where: { clerkUserId: userId },
    select: { id: true, clerkUserId: true, organizationId: true, specialty: true, npi: true },
  });

  // Auto-create physician record on first access
  if (!physician) {
    physician = await prisma.physician.create({
      data: {
        clerkUserId: userId,
        organizationId: orgId ?? "",
        encName: encryptPHI("Physician"),
        specialty: "Cardiology",
      },
      select: { id: true, clerkUserId: true, organizationId: true, specialty: true, npi: true },
    });
  }

  return NextResponse.json(physician);
}
