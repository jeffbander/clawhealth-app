/**
 * Seed condition templates from hardcoded prompts into the database
 * Run: npx tsx prisma/seed-condition-templates.ts
 */
import { PrismaClient } from '@prisma/client'
import { CONDITION_PROMPTS } from '../src/lib/condition-prompts'

const prisma = new PrismaClient()
const ORG_ID = 'org_clawhealth_default' // Default org for now

async function main() {
  console.log('Seeding condition templates...')

  for (const p of CONDITION_PROMPTS) {
    const result = await prisma.conditionTemplate.upsert({
      where: { organizationId_slug: { organizationId: ORG_ID, slug: p.id } },
      update: {
        conditionName: p.condition,
        matchPatterns: JSON.stringify(p.matchPatterns),
        monitoringProtocol: p.monitoringProtocol,
        redFlags: p.redFlags,
        yellowFlags: p.yellowFlags,
        commonQuestions: p.commonQuestions,
        medicationGuidance: p.medicationGuidance,
        conversationStyle: p.conversationStyle,
      },
      create: {
        organizationId: ORG_ID,
        slug: p.id,
        conditionName: p.condition,
        matchPatterns: JSON.stringify(p.matchPatterns),
        monitoringProtocol: p.monitoringProtocol,
        redFlags: p.redFlags,
        yellowFlags: p.yellowFlags,
        commonQuestions: p.commonQuestions,
        medicationGuidance: p.medicationGuidance,
        conversationStyle: p.conversationStyle,
      },
    })
    console.log(`  ✅ ${result.conditionName} (${result.slug})`)
  }

  console.log(`\nSeeded ${CONDITION_PROMPTS.length} condition templates.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
