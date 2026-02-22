export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

/**
 * PUT /api/condition-templates/[id] — update a template
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const updateData: Record<string, unknown> = {};
  const fields = [
    "conditionName", "matchPatterns", "monitoringProtocol", "redFlags",
    "yellowFlags", "commonQuestions", "medicationGuidance", "conversationStyle", "active",
  ] as const;

  for (const field of fields) {
    if (body[field] !== undefined) {
      if (field === "matchPatterns" && Array.isArray(body[field])) {
        updateData[field] = JSON.stringify(body[field]);
      } else {
        updateData[field] = body[field];
      }
    }
  }

  const template = await prisma.conditionTemplate.update({
    where: { id },
    data: updateData,
  });

  const ctx = await getAuditContext(userId);
  await logAudit("UPDATE", "ConditionTemplate", id, ctx);

  return NextResponse.json({ template });
}

/**
 * DELETE /api/condition-templates/[id] — soft-delete (set active=false)
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.conditionTemplate.update({
    where: { id },
    data: { active: false },
  });

  const ctx = await getAuditContext(userId);
  await logAudit("DELETE", "ConditionTemplate", id, ctx);

  return NextResponse.json({ success: true });
}
