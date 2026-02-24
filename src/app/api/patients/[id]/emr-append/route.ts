export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { decryptPHI, decryptJSON, encryptPHI } from '@/lib/encryption'
import { parseEmrText } from '@/lib/emr-parser'
import {
  appendMemorySummary,
  initializePatientMarkdownFiles,
  readAllPatientMarkdownFiles,
  writePatientMarkdownFile,
} from '@/lib/patient-memory'
import {
  buildEmrFindingsSummary,
  mergeCarePlanMarkdown,
  mergeLabsMarkdown,
  mergeMedicalHistoryMarkdown,
  mergeTrendsMarkdown,
} from '@/lib/patient-markdown'

const BodySchema = z.object({ emrText: z.string().min(1) })

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const patient = await prisma.patient.findFirst({
    where: {
      id,
      organizationId: orgId ?? '',
    },
    include: {
      carePlans: { where: { active: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
    },
  })
  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsedBody = BodySchema.safeParse(body)
  if (!parsedBody.success) return NextResponse.json({ error: 'emrText required' }, { status: 400 })

  let firstName = 'Patient'
  let conditions: string[] = []
  let carePlanSummary = ''
  try {
    firstName = decryptPHI(patient.encFirstName)
  } catch {}
  try {
    conditions = decryptJSON<string[]>(patient.encConditions)
  } catch {}
  try {
    carePlanSummary = patient.carePlans[0] ? decryptPHI(patient.carePlans[0].encContent) : ''
  } catch {}

  await initializePatientMarkdownFiles(id, {
    name: firstName,
    conditions,
    medicalSummary: carePlanSummary,
  })

  const emrParsed = await parseEmrText(parsedBody.data.emrText)
  const current = await readAllPatientMarkdownFiles(id)

  const mergedLabs = mergeLabsMarkdown(current['Labs.md'], emrParsed)
  const mergedHistory = mergeMedicalHistoryMarkdown(current['MedicalHistory.md'], emrParsed)
  const mergedTrends = mergeTrendsMarkdown(current['Trends.md'], emrParsed)
  const mergedCarePlan = mergeCarePlanMarkdown(current['CarePlan.md'], emrParsed)

  await Promise.all([
    writePatientMarkdownFile(id, 'Labs.md', mergedLabs),
    writePatientMarkdownFile(id, 'MedicalHistory.md', mergedHistory),
    writePatientMarkdownFile(id, 'Trends.md', mergedTrends),
    writePatientMarkdownFile(id, 'CarePlan.md', mergedCarePlan),
  ])

  if (patient.carePlans[0]) {
    await prisma.carePlan.update({
      where: { id: patient.carePlans[0].id },
      data: {
        encContent: encryptPHI(mergedCarePlan),
        version: { increment: 1 },
      },
    })
  } else {
    await prisma.carePlan.create({
      data: {
        patientId: id,
        physicianId: patient.physicianId,
        encContent: encryptPHI(mergedCarePlan),
        version: 1,
        active: true,
      },
    })
  }

  const summary = buildEmrFindingsSummary(emrParsed)
  await appendMemorySummary(id, summary)

  return NextResponse.json({
    success: true,
    summary,
    updates: {
      labs: mergedLabs !== current['Labs.md'],
      history: mergedHistory !== current['MedicalHistory.md'],
      trends: mergedTrends !== current['Trends.md'],
      carePlan: mergedCarePlan !== current['CarePlan.md'],
    },
  })
}
