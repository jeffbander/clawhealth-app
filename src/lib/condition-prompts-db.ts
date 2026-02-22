/**
 * Database-backed condition prompts
 * Replaces hardcoded condition-prompts.ts with DB-stored, dashboard-editable templates
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface DBConditionPrompt {
  id: string
  slug: string
  conditionName: string
  matchPatterns: string[]
  monitoringProtocol: string
  redFlags: string
  yellowFlags: string
  commonQuestions: string
  medicationGuidance: string
  conversationStyle: string
}

/**
 * Load all active condition templates from DB
 * Falls back to empty array if DB unavailable
 */
export async function loadConditionTemplates(organizationId: string): Promise<DBConditionPrompt[]> {
  try {
    const templates = await prisma.conditionTemplate.findMany({
      where: { organizationId, active: true },
    })

    return templates.map(t => ({
      id: t.id,
      slug: t.slug,
      conditionName: t.conditionName,
      matchPatterns: JSON.parse(t.matchPatterns) as string[],
      monitoringProtocol: t.monitoringProtocol,
      redFlags: t.redFlags,
      yellowFlags: t.yellowFlags,
      commonQuestions: t.commonQuestions,
      medicationGuidance: t.medicationGuidance,
      conversationStyle: t.conversationStyle,
    }))
  } catch {
    console.error('Failed to load condition templates from DB, using empty set')
    return []
  }
}

/**
 * Match patient conditions against DB templates
 */
export function matchConditions(
  patientConditions: string[],
  templates: DBConditionPrompt[]
): DBConditionPrompt[] {
  const conditionsLower = patientConditions.map(c => c.toLowerCase())

  return templates.filter(t =>
    t.matchPatterns.some(pattern =>
      conditionsLower.some(condition => condition.includes(pattern))
    )
  )
}

/**
 * Build condition section for system prompt from matched DB templates
 */
export function buildConditionSection(matched: DBConditionPrompt[]): string {
  if (matched.length === 0) return ''

  return matched.map(p => `
=== ${p.conditionName.toUpperCase()} PROTOCOL ===

${p.monitoringProtocol}

${p.redFlags}

${p.yellowFlags}

${p.commonQuestions}

${p.medicationGuidance}

${p.conversationStyle}
`).join('\n')
}
