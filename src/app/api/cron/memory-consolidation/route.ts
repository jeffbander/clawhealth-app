/**
 * Nightly Memory Consolidation Cron
 * 
 * Distills daily interaction logs into each patient's MEMORY.md
 * using AI to extract patterns, preferences, and behavioral observations.
 * 
 * Schedule: Once daily at 02:00 UTC (10 PM ET)
 */
import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { consolidateMemory } from '@/lib/patient-memory'

const prisma = new PrismaClient()

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all active patients
    const patients = await prisma.patient.findMany({
      where: { active: true },
      select: { id: true }
    })

    let consolidated = 0
    let errors = 0

    for (const patient of patients) {
      try {
        await consolidateMemory(patient.id)
        consolidated++
      } catch {
        errors++
      }
    }

    return NextResponse.json({
      success: true,
      consolidated,
      errors,
      total: patients.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Memory consolidation failed' },
      { status: 500 }
    )
  }
}
