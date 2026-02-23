export const dynamic = "force-dynamic";

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { decryptPHI, encryptPHI } from "@/lib/encryption";
import { getAuditContext, logAudit } from "@/lib/audit";

const UpdateDemographicsSchema = z
  .object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().optional(),
    dateOfBirth: z.string().optional(),
    address: z.string().optional(),
  })
  .strict();

type DemographicsResponse = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  address: string;
};

function decryptDemographics(patient: {
  encFirstName: string;
  encLastName: string;
  encPhone: string | null;
  encEmail: string | null;
  encDateOfBirth: string;
  encAddress: string | null;
}): DemographicsResponse {
  let firstName = "";
  let lastName = "";
  let phone = "";
  let email = "";
  let dateOfBirth = "";
  let address = "";

  try {
    firstName = decryptPHI(patient.encFirstName);
  } catch {}
  try {
    lastName = decryptPHI(patient.encLastName);
  } catch {}
  try {
    phone = patient.encPhone ? decryptPHI(patient.encPhone) : "";
  } catch {}
  try {
    email = patient.encEmail ? decryptPHI(patient.encEmail) : "";
  } catch {}
  try {
    dateOfBirth = decryptPHI(patient.encDateOfBirth);
  } catch {}
  try {
    address = patient.encAddress ? decryptPHI(patient.encAddress) : "";
  } catch {}

  return { firstName, lastName, phone, email, dateOfBirth, address };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const patient = await prisma.patient.findFirst({
    where: {
      id,
      physician: { clerkUserId: userId },
    },
    select: {
      id: true,
      encFirstName: true,
      encLastName: true,
      encPhone: true,
      encEmail: true,
      encDateOfBirth: true,
      encAddress: true,
      organizationId: true,
    },
  });

  if (!patient) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ctx = await getAuditContext(userId, patient.organizationId, id);
  await logAudit("READ", "patient", id, ctx, { fields: "demographics" });

  return NextResponse.json({
    id: patient.id,
    ...decryptDemographics(patient),
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.patient.findFirst({
    where: {
      id,
      physician: { clerkUserId: userId },
    },
    select: { id: true, organizationId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = UpdateDemographicsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const data = parsed.data;
  const updateData: {
    encFirstName?: string;
    encLastName?: string;
    encPhone?: string | null;
    encEmail?: string | null;
    encDateOfBirth?: string;
    encAddress?: string | null;
  } = {};

  if (data.firstName !== undefined) updateData.encFirstName = encryptPHI(data.firstName.trim());
  if (data.lastName !== undefined) updateData.encLastName = encryptPHI(data.lastName.trim());
  if (data.phone !== undefined) {
    const phone = data.phone.trim();
    updateData.encPhone = phone ? encryptPHI(phone) : null;
  }
  if (data.email !== undefined) {
    const email = data.email.trim();
    updateData.encEmail = email ? encryptPHI(email) : null;
  }
  if (data.dateOfBirth !== undefined) updateData.encDateOfBirth = encryptPHI(data.dateOfBirth.trim());
  if (data.address !== undefined) {
    const address = data.address.trim();
    updateData.encAddress = address ? encryptPHI(address) : null;
  }

  const updated = await prisma.patient.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      encFirstName: true,
      encLastName: true,
      encPhone: true,
      encEmail: true,
      encDateOfBirth: true,
      encAddress: true,
    },
  });

  const ctx = await getAuditContext(userId, existing.organizationId, id);
  await logAudit("UPDATE", "patient", id, ctx, {
    fieldsUpdated: Object.keys(data).join(","),
    section: "demographics",
  });

  return NextResponse.json({
    id: updated.id,
    ...decryptDemographics(updated),
  });
}
