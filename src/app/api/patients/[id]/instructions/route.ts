export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { encryptPHI, decryptPHI } from "@/lib/encryption";
import { logAudit, getAuditContext } from "@/lib/audit";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * GET /api/patients/[id]/instructions — fetch custom AI instructions
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const patient = await prisma.patient.findUnique({
    where: { id },
    select: { encCustomInstructions: true },
  });

  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const instructions = patient.encCustomInstructions
    ? decryptPHI(patient.encCustomInstructions)
    : "";

  return NextResponse.json({ instructions });
}

/**
 * PUT /api/patients/[id]/instructions — update custom AI instructions
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { instructions } = body as { instructions: string };

  if (typeof instructions !== "string") {
    return NextResponse.json({ error: "instructions must be a string" }, { status: 400 });
  }

  const encrypted = instructions.trim()
    ? encryptPHI(instructions.trim())
    : null;

  await prisma.patient.update({
    where: { id },
    data: { encCustomInstructions: encrypted },
  });

  const ctx = await getAuditContext(userId, undefined, id);
  await logAudit("UPDATE", "Patient", id, ctx, {
    field: "customInstructions",
    instructionsLength: instructions.trim().length,
  });

  return NextResponse.json({ success: true });
}
