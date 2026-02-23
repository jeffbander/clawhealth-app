/**
 * NanoClaw Patient Memory Layer
 * 
 * Per-patient memory files (OpenClaw-style) for soft context that
 * doesn't fit in structured DB columns:
 * 
 * patients/<id>/
 *   SOUL.md        — agent personality, condition context, communication preferences
 *   MEMORY.md      — accumulated relationship knowledge, behavioral patterns
 *   memory/
 *     YYYY-MM-DD.md — daily interaction logs, raw observations
 * 
 * DB handles: vitals, meds, alerts, billing, conversations (structured, queryable)
 * Files handle: agent reasoning, relationship context, soft knowledge (personality)
 */

import { promises as fs } from 'fs'
import path from 'path'
import { decryptPHI, encryptPHI } from './encryption'

// In production, store encrypted on disk or in blob storage
// For now, use local filesystem (Vercel: use Vercel Blob or KV)
const MEMORY_ROOT = process.env.PATIENT_MEMORY_ROOT || '/tmp/clawhealth-patients'

function patientDir(patientId: string): string {
  return path.join(MEMORY_ROOT, patientId)
}

/**
 * Ensure patient directory structure exists
 */
async function ensurePatientDir(patientId: string): Promise<void> {
  const dir = patientDir(patientId)
  await fs.mkdir(path.join(dir, 'memory'), { recursive: true })
}

// ─── SOUL.md ───────────────────────────────────────────────

export interface PatientSoul {
  name: string
  conditions: string[]
  communicationStyle: string
  preferredCheckInTime?: string
  language?: string
  personalContext?: string   // "lives alone", "caregiver is daughter"
  clinicalNotes?: string     // physician-provided context
  doNotMention?: string[]    // sensitive topics to avoid
}

/**
 * Generate initial SOUL.md from patient enrollment data
 */
export function generateSoulTemplate(soul: PatientSoul): string {
  return `# SOUL.md — ${soul.name}'s Care Agent

## Identity
You are ${soul.name}'s personal AI health coordinator at ClawHealth.
You work under physician supervision at Mount Sinai West.

## Conditions
${soul.conditions.map(c => `- ${c}`).join('\n')}

## Communication Style
${soul.communicationStyle}

${soul.preferredCheckInTime ? `## Preferred Check-In Time\n${soul.preferredCheckInTime}\n` : ''}
${soul.language ? `## Language\nPrimary: ${soul.language}\n` : ''}
${soul.personalContext ? `## Personal Context\n${soul.personalContext}\n` : ''}
${soul.clinicalNotes ? `## Physician Notes\n${soul.clinicalNotes}\n` : ''}
${soul.doNotMention?.length ? `## Sensitive Topics (avoid unless patient raises)\n${soul.doNotMention.map(t => `- ${t}`).join('\n')}\n` : ''}
---
*Auto-generated on ${new Date().toISOString().split('T')[0]}. Updated by agent as it learns.*
`
}

export async function readSoul(patientId: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(patientDir(patientId), 'SOUL.md'), 'utf-8')
  } catch {
    return null
  }
}

export async function writeSoul(patientId: string, content: string): Promise<void> {
  await ensurePatientDir(patientId)
  await fs.writeFile(path.join(patientDir(patientId), 'SOUL.md'), content, 'utf-8')
}

// ─── MEMORY.md ─────────────────────────────────────────────

export function generateMemoryTemplate(name: string): string {
  return `# MEMORY.md — ${name}'s Accumulated Context

## Communication Patterns
*What works and doesn't when talking to this patient*

## Behavioral Observations
*Patterns noticed over time — adherence habits, mood trends, response patterns*

## Relationship Notes
*Key moments, trust-building interactions, concerns raised*

## Preferences Learned
*Dietary, lifestyle, scheduling, medication preferences expressed by patient*

## Clinical Soft Knowledge
*Things that don't fit in structured data — "gets anxious before echo", "prefers morning meds"*

---
*Updated by agent after each interaction. Distilled from daily logs.*
`
}

export async function readMemory(patientId: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(patientDir(patientId), 'MEMORY.md'), 'utf-8')
  } catch {
    return null
  }
}

export async function writeMemory(patientId: string, content: string): Promise<void> {
  await ensurePatientDir(patientId)
  await fs.writeFile(path.join(patientDir(patientId), 'MEMORY.md'), content, 'utf-8')
}

// ─── Daily Logs ────────────────────────────────────────────

function todayFile(): string {
  return new Date().toISOString().split('T')[0] + '.md'
}

export async function readDailyLog(patientId: string, date?: string): Promise<string | null> {
  const filename = date ? `${date}.md` : todayFile()
  try {
    return await fs.readFile(
      path.join(patientDir(patientId), 'memory', filename),
      'utf-8'
    )
  } catch {
    return null
  }
}

export async function appendDailyLog(
  patientId: string,
  entry: string
): Promise<void> {
  await ensurePatientDir(patientId)
  const filepath = path.join(patientDir(patientId), 'memory', todayFile())

  let existing = ''
  try {
    existing = await fs.readFile(filepath, 'utf-8')
  } catch {
    existing = `# ${new Date().toISOString().split('T')[0]} — Daily Log\n\n`
  }

  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/New_York'
  })

  await fs.writeFile(filepath, existing + `\n### ${timestamp}\n${entry}\n`, 'utf-8')
}

// ─── Initialize Patient Memory ────────────────────────────

/**
 * Create initial memory structure for a new patient
 * Called during enrollment / onboarding
 */
export async function initializePatientMemory(
  patientId: string,
  soul: PatientSoul
): Promise<void> {
  await ensurePatientDir(patientId)
  await writeSoul(patientId, generateSoulTemplate(soul))
  await writeMemory(patientId, generateMemoryTemplate(soul.name))
  await appendDailyLog(patientId, `Patient memory initialized. Conditions: ${soul.conditions.join(', ')}`)
}

// ─── Load Memory Context for AI Agent ──────────────────────

/**
 * Load all memory files into a single context string for the AI agent.
 * This gets injected into the system prompt alongside DB-sourced clinical data.
 * 
 * Loads: SOUL.md + MEMORY.md + today's daily log + yesterday's daily log
 */
export async function loadMemoryContext(patientId: string): Promise<string | null> {
  const soul = await readSoul(patientId)
  const memory = await readMemory(patientId)
  const todayLog = await readDailyLog(patientId)

  // Also load yesterday for continuity
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const yesterdayLog = await readDailyLog(patientId, yesterdayStr)

  if (!soul && !memory) return null

  let context = ''
  if (soul) context += `=== PATIENT AGENT IDENTITY ===\n${soul}\n\n`
  if (memory) context += `=== ACCUMULATED PATIENT KNOWLEDGE ===\n${memory}\n\n`
  if (yesterdayLog) context += `=== YESTERDAY'S INTERACTIONS ===\n${yesterdayLog}\n\n`
  if (todayLog) context += `=== TODAY'S INTERACTIONS ===\n${todayLog}\n\n`

  return context
}

// ─── Post-Interaction Memory Update ────────────────────────

/**
 * After each conversation turn, log observations to daily file.
 * Periodically (or via cron), distill daily logs into MEMORY.md.
 * 
 * This runs fire-and-forget after the AI response — never blocks patient.
 */
export async function logInteraction(
  patientId: string,
  patientMessage: string,
  aiResponse: string,
  insights?: {
    moodOrConcern?: string | null
    adherenceNote?: string | null
    behavioralObservation?: string | null
  }
): Promise<void> {
  try {
    let entry = `**Patient**: "${patientMessage.slice(0, 200)}"\n**Agent**: "${aiResponse.slice(0, 200)}"`

    if (insights?.moodOrConcern) {
      entry += `\n**Mood/Concern**: ${insights.moodOrConcern}`
    }
    if (insights?.adherenceNote) {
      entry += `\n**Adherence**: ${insights.adherenceNote}`
    }
    if (insights?.behavioralObservation) {
      entry += `\n**Observation**: ${insights.behavioralObservation}`
    }

    await appendDailyLog(patientId, entry)
  } catch {
    // Best-effort — never block patient interaction
  }
}

// ─── Memory Consolidation (Cron Job) ──────────────────────

/**
 * Consolidate recent daily logs into MEMORY.md
 * Run via cron (e.g., nightly) — reads last 7 days of logs,
 * uses AI to distill patterns, updates MEMORY.md
 * 
 * TODO: Wire up to /api/cron/memory-consolidation
 */
export async function consolidateMemory(
  patientId: string,
  _anthropicClient?: Anthropic
): Promise<void> {
  const client = _anthropicClient || anthropic

  // Load last 7 days of logs
  const logs: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const log = await readDailyLog(patientId, d.toISOString().split('T')[0])
    if (log) logs.push(log)
  }

  if (logs.length === 0) return

  const currentMemory = await readMemory(patientId) || ''

  const completion = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: `You are a clinical memory curator for a patient's AI health agent. 
Given the current MEMORY.md and recent daily interaction logs, produce an updated MEMORY.md.

Rules:
- Keep the same section structure (Communication Patterns, Behavioral Observations, etc.)
- Distill NEW patterns from the daily logs into the appropriate sections
- Remove outdated observations that are contradicted by newer data
- Keep it concise — this is curated knowledge, not raw logs
- Never include PHI identifiers (SSN, DOB, address) — only clinical context
- Preserve important relationship moments and trust-building notes`,
    messages: [{
      role: 'user',
      content: `Current MEMORY.md:\n${currentMemory}\n\nRecent daily logs:\n${logs.join('\n---\n')}`
    }]
  })

  const updated = completion.content[0].type === 'text' ? completion.content[0].text : ''
  if (updated.length > 50) {
    await writeMemory(patientId, updated)
  }
}
