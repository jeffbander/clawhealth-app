/**
 * Import disease templates from Manus's markdown file into the database
 * Run: npx tsx prisma/import-manus-templates.ts
 */
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'

const prisma = new PrismaClient()
const ORG_ID = 'org_clawhealth_default'

function slugify(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

function parseTemplates(markdown: string) {
  // Split by ## headers (condition names)
  const sections = markdown.split(/^## /m).filter(s => s.trim())
  const templates: Array<{
    conditionName: string
    slug: string
    matchPatterns: string[]
    monitoringProtocol: string
    redFlags: string
    yellowFlags: string
    commonQuestions: string
    medicationGuidance: string
    conversationStyle: string
  }> = []

  for (const section of sections) {
    const lines = section.split('\n')
    const conditionName = lines[0].trim()
    if (!conditionName || conditionName.startsWith('Disease-Specific')) continue

    const fullText = section

    // Extract match patterns from ### 2. Match Patterns section
    const matchSection = extractSection(fullText, '### 2. Match Patterns', '### 3')
    const matchPatterns = matchSection
      .split(/[,\n]/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 1 && !s.startsWith('#') && !s.startsWith('match'))

    // Extract other sections
    const monitoringProtocol = extractSection(fullText, '### 3. Monitoring Protocol', '### 4')
    const redFlags = extractSection(fullText, '### 4. Red Flags', '### 5')
    const yellowFlags = extractSection(fullText, '### 5. Yellow Flags', '### 6')
    const commonQuestions = extractSection(fullText, '### 6. Common Questions', '### 7')
    const medicationGuidance = extractSection(fullText, '### 7. Medication Guidance', '### 8')
    const conversationStyle = extractSection(fullText, '### 8. Conversation Style', '---')

    if (matchPatterns.length === 0) {
      // Fallback: generate from condition name
      matchPatterns.push(conditionName.toLowerCase())
    }

    templates.push({
      conditionName,
      slug: slugify(conditionName),
      matchPatterns: matchPatterns.slice(0, 50), // cap at 50
      monitoringProtocol: monitoringProtocol.trim(),
      redFlags: redFlags.trim(),
      yellowFlags: yellowFlags.trim(),
      commonQuestions: commonQuestions.trim(),
      medicationGuidance: medicationGuidance.trim(),
      conversationStyle: conversationStyle.trim() || `For ${conditionName} patients, be thorough and empathetic. Cross-reference with cardiac conditions when relevant.`,
    })
  }

  return templates
}

function extractSection(text: string, startMarker: string, endMarker: string): string {
  const startIdx = text.indexOf(startMarker)
  if (startIdx === -1) return ''
  
  const afterStart = text.substring(startIdx + startMarker.length)
  const endIdx = afterStart.indexOf(endMarker)
  
  if (endIdx === -1) return afterStart.trim()
  return afterStart.substring(0, endIdx).trim()
}

async function main() {
  const mdPath = process.argv[2] || '/Users/jeffbot/clawd/repos/bot-channel/to-openclaw/disease-templates-expansion.md'
  const markdown = readFileSync(mdPath, 'utf-8')
  const templates = parseTemplates(markdown)

  console.log(`Parsed ${templates.length} templates from Manus's deliverable:\n`)

  for (const t of templates) {
    const result = await prisma.conditionTemplate.upsert({
      where: { organizationId_slug: { organizationId: ORG_ID, slug: t.slug } },
      update: {
        conditionName: t.conditionName,
        matchPatterns: JSON.stringify(t.matchPatterns),
        monitoringProtocol: t.monitoringProtocol,
        redFlags: t.redFlags,
        yellowFlags: t.yellowFlags,
        commonQuestions: t.commonQuestions,
        medicationGuidance: t.medicationGuidance,
        conversationStyle: t.conversationStyle,
      },
      create: {
        organizationId: ORG_ID,
        slug: t.slug,
        conditionName: t.conditionName,
        matchPatterns: JSON.stringify(t.matchPatterns),
        monitoringProtocol: t.monitoringProtocol,
        redFlags: t.redFlags,
        yellowFlags: t.yellowFlags,
        commonQuestions: t.commonQuestions,
        medicationGuidance: t.medicationGuidance,
        conversationStyle: t.conversationStyle,
      },
    })
    console.log(`  ✅ ${result.conditionName} (${t.matchPatterns.length} match patterns)`)
  }

  console.log(`\nDone. ${templates.length} templates imported.`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
