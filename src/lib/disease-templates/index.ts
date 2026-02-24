import { promises as fs } from 'fs'
import path from 'path'

const TEMPLATE_DIR = path.join(process.cwd(), 'src/lib/disease-templates')

const CONDITION_TO_TEMPLATE: Array<{ match: RegExp; file: string }> = [
  { match: /heart\s*failure|hfr?ef|hfpef/i, file: 'HeartFailure.md' },
  { match: /atrial\s*fibrillation|afib|a-fib/i, file: 'Afib.md' },
  { match: /diabetes|dm2|type\s*2\s*dm|type\s*1\s*dm/i, file: 'Diabetes.md' },
]

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values)]
}

export function selectTemplateFilesForConditions(conditions: string[]): string[] {
  const files: string[] = []
  for (const condition of conditions) {
    for (const rule of CONDITION_TO_TEMPLATE) {
      if (rule.match.test(condition)) files.push(rule.file)
    }
  }
  return dedupeStrings(files)
}

export async function loadTemplateContentByFile(file: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(TEMPLATE_DIR, file), 'utf-8')
  } catch {
    return null
  }
}

export async function buildCarePlanTemplateSection(conditions: string[]): Promise<string> {
  const files = selectTemplateFilesForConditions(conditions)
  if (files.length === 0) return ''

  const chunks = await Promise.all(files.map(loadTemplateContentByFile))
  const sections = chunks
    .filter((chunk): chunk is string => Boolean(chunk && chunk.trim().length > 0))
    .map((chunk) => chunk.trim())

  if (sections.length === 0) return ''

  return `## Imported Disease Templates\n${sections.join('\n\n---\n\n')}\n`
}
