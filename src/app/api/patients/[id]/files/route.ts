export const dynamic = 'force-dynamic'

import { auth } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { decryptPHI, decryptJSON, encryptPHI } from '@/lib/encryption'
import {
  PATIENT_MARKDOWN_FILES,
  type PatientMarkdownFile,
  initializePatientMarkdownFiles,
  readAllPatientMarkdownFiles,
  writePatientMarkdownFile,
} from '@/lib/patient-memory'

const UpdateMarkdownSchema = z.object({
  file: z.enum(PATIENT_MARKDOWN_FILES),
  content: z.string(),
})

async function getAuthorizedPatient(id: string, orgId: string) {
  return prisma.patient.findFirst({
    where: {
      id,
      organizationId: orgId,
    },
    include: {
      carePlans: { where: { active: true }, orderBy: { updatedAt: 'desc' }, take: 1 },
    },
  })
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const patient = await getAuthorizedPatient(id, orgId ?? '')
  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let name = 'Patient'
  let conditions: string[] = []
  let medicalSummary = ''
  try {
    name = decryptPHI(patient.encFirstName)
  } catch {}
  try {
    conditions = decryptJSON<string[]>(patient.encConditions)
  } catch {}
  try {
    medicalSummary = patient.carePlans[0] ? decryptPHI(patient.carePlans[0].encContent) : ''
  } catch {}

  await initializePatientMarkdownFiles(id, {
    name,
    conditions,
    medicalSummary,
  })

  const files = await readAllPatientMarkdownFiles(id)
  return NextResponse.json({ files })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId, orgId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const patient = await getAuthorizedPatient(id, orgId ?? '')
  if (!patient) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = UpdateMarkdownSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

  const file = parsed.data.file as PatientMarkdownFile
  const content = parsed.data.content

  await writePatientMarkdownFile(id, file, content)

  if (file === 'CarePlan.md') {
    const active = patient.carePlans[0]
    if (active) {
      await prisma.carePlan.update({
        where: { id: active.id },
        data: {
          encContent: encryptPHI(content),
          version: { increment: 1 },
        },
      })
    } else {
      await prisma.carePlan.create({
        data: {
          patientId: id,
          physicianId: patient.physicianId,
          encContent: encryptPHI(content),
          version: 1,
          active: true,
        },
      })
    }
  }

  return NextResponse.json({ success: true })
}
