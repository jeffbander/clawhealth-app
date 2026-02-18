/**
 * HIPAA Audit Logging — 45 CFR 164.312(b)
 * ALL PHI access must be logged. Retention: 6 years.
 * NEVER include PHI in audit log entries.
 */
import { PrismaClient } from '@prisma/client'
import { headers } from 'next/headers'

const prisma = new PrismaClient()

type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'VOICE_CALL'

interface AuditContext {
  userId: string
  organizationId?: string
  patientId?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Log a PHI access event. Never include PHI values.
 */
export async function logAudit(
  action: AuditAction,
  resource: string,
  resourceId: string,
  context: AuditContext,
  details?: Record<string, string | number | boolean>
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: context.userId,
        action,
        resource,
        resourceId,
        organizationId: context.organizationId,
        patientId: context.patientId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
        timestamp: new Date()
      }
    })
  } catch {
    // Audit log failures must NOT crash the app — but must be surfaced
    console.error(`[AUDIT_FAIL] action=${action} resource=${resource} id=${resourceId} user=${context.userId}`)
  }
}

/**
 * Extract context from Next.js request headers
 */
export async function getAuditContext(userId: string, organizationId?: string, patientId?: string): Promise<AuditContext> {
  const headerList = await headers()
  return {
    userId,
    organizationId,
    patientId,
    ipAddress: headerList.get('x-forwarded-for') ?? headerList.get('x-real-ip') ?? undefined,
    userAgent: headerList.get('user-agent') ?? undefined
  }
}
