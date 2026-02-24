/**
 * Local-only mock patient seed for markdown + EMR append smoke tests.
 *
 * Run:
 *   npx tsx scripts/seed-mock-patients.ts
 */

import { PrismaClient } from '@prisma/client'
import { encryptPHI } from '../src/lib/encryption'
import { initializePatientMarkdownFiles } from '../src/lib/patient-memory'

const prisma = new PrismaClient()

const MOCK_ORG = 'org_mock_local'
const MOCK_PHYSICIAN = 'mock_physician_local'

const MOCK_PATIENTS = [
  {
    firstName: 'Alice',
    lastName: 'Rivers',
    dob: '1968-05-11',
    phone: '+12125550111',
    conditions: ['Heart Failure with reduced EF', 'Hypertension'],
    riskLevel: 'HIGH',
    primaryDx: 'I50.22',
    summary: 'Established HFrEF with intermittent edema. Monitoring daily weight and BP trends.',
  },
  {
    firstName: 'Brian',
    lastName: 'Cole',
    dob: '1959-02-03',
    phone: '+12125550112',
    conditions: ['Atrial Fibrillation', 'Coronary Artery Disease'],
    riskLevel: 'HIGH',
    primaryDx: 'I48.91',
    summary: 'Paroxysmal AFib on anticoagulation with episodic palpitations.',
  },
  {
    firstName: 'Carmen',
    lastName: 'Lopez',
    dob: '1974-09-19',
    phone: '+12125550113',
    conditions: ['Type 2 Diabetes', 'Hypertension'],
    riskLevel: 'MEDIUM',
    primaryDx: 'E11.9',
    summary: 'Type 2 diabetes with rising fasting glucose; working on adherence and nutrition.',
  },
] as const

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run mock seed in production')
  }

  const physician = await prisma.physician.upsert({
    where: { clerkUserId: MOCK_PHYSICIAN },
    update: { organizationId: MOCK_ORG, specialty: 'Cardiology' },
    create: {
      clerkUserId: MOCK_PHYSICIAN,
      organizationId: MOCK_ORG,
      encName: encryptPHI('Dr. Mock Local'),
      specialty: 'Cardiology',
    },
  })

  for (const patientInput of MOCK_PATIENTS) {
    const clerkUserId = `mock_${patientInput.firstName.toLowerCase()}_${Date.now()}`
    const patient = await prisma.patient.create({
      data: {
        clerkUserId,
        organizationId: MOCK_ORG,
        physicianId: physician.id,
        encMrn: encryptPHI(`MOCK-${Date.now()}-${patientInput.firstName}`),
        encFirstName: encryptPHI(patientInput.firstName),
        encLastName: encryptPHI(patientInput.lastName),
        encDateOfBirth: encryptPHI(patientInput.dob),
        encPhone: encryptPHI(patientInput.phone),
        encConditions: encryptPHI(JSON.stringify(patientInput.conditions)),
        riskLevel: patientInput.riskLevel,
        primaryDx: patientInput.primaryDx,
        createdBy: 'seed-mock-patients',
      },
      select: { id: true },
    })

    await initializePatientMarkdownFiles(patient.id, {
      name: patientInput.firstName,
      conditions: [...patientInput.conditions],
      medicalSummary: patientInput.summary,
    })

    console.log(`Created mock patient ${patientInput.firstName} ${patientInput.lastName}: ${patient.id}`)
  }

  console.log('Mock patient seed complete.')
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
