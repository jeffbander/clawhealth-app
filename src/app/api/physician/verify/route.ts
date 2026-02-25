export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { logAudit, getAuditContext } from '@/lib/audit'

/**
 * Physician Verification Queue API
 * 
 * GET  /api/physician/verify — List items pending verification for this physician
 * POST /api/physician/verify — Verify or dispute a medication or vital record
 * 
 * This implements the verification workflow from the joint Manny/Albert spec:
 * - Patient-reported data enters as UNVERIFIED
 * - Physician reviews and marks VERIFIED, DISPUTED, or PENDING_REVIEW
 * - Critical self-reports (anticoagulant changes) escalate IMMEDIATELY
 *   regardless of verification status (safety rule)
 */

const VerifySchema = z.object({
  resourceType: z.enum(['medication', 'vital']),
  resourceId: z.string(),
  action: z.enum(['verify', 'dispute', 'pending']),
  note: z.string().optional(),
})

// GET: List unverified items for physician's patients
export async function GET(_req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Find physician
  const physician = await prisma.physician.findFirst({
    where: { clerkUserId: userId, organizationId: orgId ?? '' },
  })
  if (!physician) return NextResponse.json({ error: 'Physician not found' }, { status: 404 })

  // Get unverified medications for this physician's patients
  const unverifiedMeds = await prisma.medication.findMany({
    where: {
      patient: { physicianId: physician.id },
      verificationStatus: { in: ['UNVERIFIED', 'PENDING_REVIEW'] },
      active: true,
    },
    include: {
      patient: { select: { id: true, encFirstName: true, encLastName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  // Get unverified vitals
  const unverifiedVitals = await prisma.vital.findMany({
    where: {
      patient: { physicianId: physician.id },
      verificationStatus: { in: ['UNVERIFIED', 'PENDING_REVIEW'] },
    },
    include: {
      patient: { select: { id: true, encFirstName: true, encLastName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({
    medications: unverifiedMeds,
    vitals: unverifiedVitals,
    totalPending: unverifiedMeds.length + unverifiedVitals.length,
  })
}

// POST: Verify or dispute a record
export async function POST(req: NextRequest) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = VerifySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.issues }, { status: 400 })
  }

  const { resourceType, resourceId, action, note } = parsed.data

  const statusMap = {
    verify: 'VERIFIED' as const,
    dispute: 'DISPUTED' as const,
    pending: 'PENDING_REVIEW' as const,
  }

  const newStatus = statusMap[action]
  const now = new Date()

  if (resourceType === 'medication') {
    await prisma.medication.update({
      where: { id: resourceId },
      data: {
        verificationStatus: newStatus,
        verifiedBy: action === 'verify' || action === 'dispute' ? userId : undefined,
        verifiedAt: action === 'verify' || action === 'dispute' ? now : undefined,
        ...(note ? { encNotes: note } : {}),
      },
    })
  } else {
    await prisma.vital.update({
      where: { id: resourceId },
      data: {
        verificationStatus: newStatus,
        verifiedBy: action === 'verify' || action === 'dispute' ? userId : undefined,
        verifiedAt: action === 'verify' || action === 'dispute' ? now : undefined,
      },
    })
  }

  // Audit log
  const ctx = await getAuditContext(userId, orgId ?? undefined)
  await logAudit(
    action === 'verify' ? 'VERIFY' : action === 'dispute' ? 'DISPUTE' : 'REVIEW',
    resourceType,
    resourceId,
    ctx,
    { action, note }
  )

  return NextResponse.json({ success: true, status: newStatus })
}
