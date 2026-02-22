export const dynamic = "force-dynamic";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { logAudit, getAuditContext } from "@/lib/audit";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_ORG = "org_clawhealth_default";

/**
 * GET /api/condition-templates — list all condition templates
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.conditionTemplate.findMany({
    where: { organizationId: DEFAULT_ORG },
    orderBy: { conditionName: "asc" },
  });

  return NextResponse.json({ templates });
}

/**
 * POST /api/condition-templates — create a new template
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { slug, conditionName, matchPatterns, monitoringProtocol, redFlags, yellowFlags, commonQuestions, medicationGuidance, conversationStyle } = body;

  if (!slug || !conditionName) {
    return NextResponse.json({ error: "slug and conditionName required" }, { status: 400 });
  }

  const template = await prisma.conditionTemplate.create({
    data: {
      organizationId: DEFAULT_ORG,
      slug,
      conditionName,
      matchPatterns: JSON.stringify(matchPatterns || []),
      monitoringProtocol: monitoringProtocol || "",
      redFlags: redFlags || "",
      yellowFlags: yellowFlags || "",
      commonQuestions: commonQuestions || "",
      medicationGuidance: medicationGuidance || "",
      conversationStyle: conversationStyle || "",
    },
  });

  const ctx = await getAuditContext(userId);
  await logAudit("CREATE", "ConditionTemplate", template.id, ctx, {
    slug,
    conditionName,
  });

  return NextResponse.json({ template }, { status: 201 });
}
