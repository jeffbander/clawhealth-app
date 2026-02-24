import type { ParsedPatient } from '@/lib/emr-parser'
import type { PatientMarkdownFile } from '@/lib/patient-memory'

export const PATIENT_MARKDOWN_LABELS: Record<PatientMarkdownFile, string> = {
  'CarePlan.md': 'CarePlan',
  'Labs.md': 'Labs',
  'MedicalHistory.md': 'History',
  'Trends.md': 'Trends',
}

function normalize(line: string): string {
  return line.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0]
}

function ensureHeading(content: string, heading: string): string {
  if (content.includes(heading)) return content
  return `${content.trimEnd()}\n\n${heading}\n`
}

function replaceHeadingBlock(content: string, heading: string, lines: string[]): string {
  const headingEscaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${headingEscaped}\\n)([\\s\\S]*?)(\\n## |$)`, 'm')
  const replacementBody = lines.length > 0 ? `${lines.join('\n')}\n` : ''

  if (!regex.test(content)) {
    const suffix = content.endsWith('\n') ? '' : '\n'
    return `${content}${suffix}\n${heading}\n${replacementBody}`
  }

  return content.replace(regex, (_match, start, _body, nextHeading) => {
    return `${start}${replacementBody}${nextHeading}`
  })
}

export function mergeLabsMarkdown(existing: string, parsed: ParsedPatient): string {
  const datedLabs = parsed.labs
    .filter((lab) => lab.name && lab.value)
    .map((lab) => `- [${lab.date || getTodayDate()}] ${lab.name}: ${lab.value}${lab.unit ? ` ${lab.unit}` : ''}`)

  const todayVitals = parsed.vitals
    .filter((vital) => vital.type && vital.value)
    .map((vital) => `- [${vital.date || getTodayDate()}] ${vital.type}: ${vital.value}${vital.unit ? ` ${vital.unit}` : ''}`)

  const newLines = [...datedLabs, ...todayVitals]
  if (newLines.length === 0) return existing

  const listRegex = /^- \[[^\]]+\] .+$/gm
  const oldEntries = (existing.match(listRegex) || []).filter((line) => !line.includes('Initial baseline pending import'))

  const merged = [...newLines, ...oldEntries]
  const deduped: string[] = []
  const seen = new Set<string>()
  for (const line of merged) {
    const key = normalize(line)
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(line)
    }
  }

  const capped = deduped.slice(0, 10)
  const withHeading = ensureHeading(existing, '## Latest Labs')
  return replaceHeadingBlock(withHeading, '## Latest Labs', capped)
}

export function mergeMedicalHistoryMarkdown(existing: string, parsed: ParsedPatient): string {
  const existingNormalized = new Set(
    existing
      .split('\n')
      .filter((line) => line.trim().startsWith('-'))
      .map((line) => normalize(line))
  )

  const novelConditions = parsed.conditions
    .filter((condition) => condition.trim().length > 0)
    .filter((condition) => !existingNormalized.has(normalize(`- ${condition}`)))
    .map((condition) => `- ${condition}`)

  const novelProcedures = parsed.procedures
    .filter((procedure) => procedure.trim().length > 0)
    .filter((procedure) => !existingNormalized.has(normalize(`- ${procedure}`)))
    .map((procedure) => `- ${procedure}`)

  let result = ensureHeading(existing, '## Conditions')
  result = ensureHeading(result, '## Procedures')

  if (novelConditions.length > 0) {
    const currentBlock = /## Conditions\n([\s\S]*?)(\n## |$)/m.exec(result)?.[1] ?? ''
    const currentLines = currentBlock
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') && !line.toLowerCase().includes('none documented'))

    result = replaceHeadingBlock(result, '## Conditions', [...currentLines, ...novelConditions])
  }

  if (novelProcedures.length > 0) {
    const currentBlock = /## Procedures\n([\s\S]*?)(\n## |$)/m.exec(result)?.[1] ?? ''
    const currentLines = currentBlock
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') && !line.toLowerCase().includes('none documented'))

    result = replaceHeadingBlock(result, '## Procedures', [...currentLines, ...novelProcedures])
  }

  return result
}

export function mergeTrendsMarkdown(existing: string, parsed: ParsedPatient): string {
  const today = getTodayDate()
  let result = ensureHeading(existing, '## Weight Trend')
  result = ensureHeading(result, '## Blood Pressure Trend')
  result = ensureHeading(result, '## Symptom Trend')

  const weightMentions = parsed.vitals
    .filter((vital) => /weight|wt/i.test(vital.type) && vital.value)
    .map((vital) => `- ${today}: Weight ${vital.value}${vital.unit ? ` ${vital.unit}` : ''}`)

  const bpMentions = parsed.vitals
    .filter((vital) => /blood pressure|bp|systolic|diastolic/i.test(vital.type) && vital.value)
    .map((vital) => `- ${today}: ${vital.type} ${vital.value}${vital.unit ? ` ${vital.unit}` : ''}`)

  const symptomMentions = parsed.symptoms
    .filter((symptom) => symptom.trim().length > 0)
    .map((symptom) => `- ${today}: ${symptom}`)

  if (weightMentions.length > 0) {
    const current = /## Weight Trend\n([\s\S]*?)(\n## |$)/m.exec(result)?.[1] ?? ''
    const currentLines = current
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') && !line.toLowerCase().includes('no baseline trend documented'))
    result = replaceHeadingBlock(result, '## Weight Trend', [...weightMentions, ...currentLines].slice(0, 10))
  }

  if (bpMentions.length > 0) {
    const current = /## Blood Pressure Trend\n([\s\S]*?)(\n## |$)/m.exec(result)?.[1] ?? ''
    const currentLines = current
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') && !line.toLowerCase().includes('no baseline trend documented'))
    result = replaceHeadingBlock(result, '## Blood Pressure Trend', [...bpMentions, ...currentLines].slice(0, 10))
  }

  if (symptomMentions.length > 0) {
    const current = /## Symptom Trend\n([\s\S]*?)(\n## |$)/m.exec(result)?.[1] ?? ''
    const currentLines = current
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') && !line.toLowerCase().includes('no baseline trend documented'))
    result = replaceHeadingBlock(result, '## Symptom Trend', [...symptomMentions, ...currentLines].slice(0, 10))
  }

  return result
}

export function mergeCarePlanMarkdown(existing: string, parsed: ParsedPatient): string {
  const notes = [
    ...parsed.planItems.filter((item) => item.trim().length > 0),
    parsed.medicalSummary ? `Clinical note: ${parsed.medicalSummary}` : '',
  ].filter((line) => line.trim().length > 0)

  if (notes.length === 0) return existing

  const heading = '## EMR Addenda'
  let result = ensureHeading(existing, heading)

  const current = new Set(
    (result.match(/^- .+$/gm) || []).map((line) => normalize(line))
  )
  const timestamped = notes
    .map((note) => `- ${getTodayDate()}: ${note}`)
    .filter((line) => !current.has(normalize(line)))

  if (timestamped.length === 0) return result

  const existingAddenda = /## EMR Addenda\n([\s\S]*?)(\n## |$)/m.exec(result)?.[1] ?? ''
  const existingLines = existingAddenda
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))

  return replaceHeadingBlock(result, heading, [...existingLines, ...timestamped])
}

export function buildEmrFindingsSummary(parsed: ParsedPatient): string {
  const parts: string[] = []

  if (parsed.conditions.length > 0) {
    parts.push(`conditions noted: ${parsed.conditions.slice(0, 3).join(', ')}`)
  }
  if (parsed.labs.length > 0) {
    parts.push(`${parsed.labs.length} new lab value${parsed.labs.length > 1 ? 's' : ''} captured`)
  }
  if (parsed.procedures.length > 0) {
    parts.push(`procedure history updated (${parsed.procedures.slice(0, 2).join(', ')})`)
  }
  if (parsed.symptoms.length > 0) {
    parts.push(`symptoms documented: ${parsed.symptoms.slice(0, 2).join(', ')}`)
  }
  if (parsed.planItems.length > 0) {
    parts.push(`care plan addenda appended`) 
  }

  if (parts.length === 0) {
    return 'EMR append processed with no novel structured findings.'
  }

  return `EMR append processed; ${parts.join('; ')}.`
}
