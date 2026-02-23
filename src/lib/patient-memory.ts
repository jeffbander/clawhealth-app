/**
 * NanoClaw Patient Memory Layer
 * 
 * Per-patient memory files (OpenClaw-style) for soft context that
 * doesn't fit in structured DB columns:
 * 
 * patients/<id>/SOUL.md        — agent personality, condition context, communication preferences
 * patients/<id>/MEMORY.md      — accumulated relationship knowledge, behavioral patterns  
 * patients/<id>/memory/YYYY-MM-DD.md — daily interaction logs, raw observations
 * 
 * Storage: Vercel Blob (persistent, serverless-compatible)
 * Fallback: Local filesystem (dev mode when BLOB_READ_WRITE_TOKEN not set)
 * 
 * DB handles: vitals, meds, alerts, billing, conversations (structured, queryable)
 * Files handle: agent reasoning, relationship context, soft knowledge (personality)
 */

import { put, head, list } from '@vercel/blob'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const PREFIX = 'nanoclaw/patients'
const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN

// ─── Blob Storage Helpers ──────────────────────────────────

function blobPath(patientId: string, file: string): string {
  return `${PREFIX}/${patientId}/${file}`
}

async function readFile(patientId: string, file: string): Promise<string | null> {
  if (!useBlob) return readFileLocal(patientId, file)
  try {
    const blob = await head(blobPath(patientId, file))
    if (!blob) return null
    const res = await fetch(blob.url)
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

async function writeFile(patientId: string, file: string, content: string): Promise<void> {
  if (!useBlob) return writeFileLocal(patientId, file, content)
  await put(blobPath(patientId, file), content, {
    access: 'public', // URLs are unguessable; content is non-PHI soft context
    addRandomSuffix: false,
    contentType: 'text/markdown',
  })
}

async function appendFile(patientId: string, file: string, append: string): Promise<void> {
  const existing = await readFile(patientId, file) || ''
  await writeFile(patientId, file, existing + append)
}

// ─── Local Filesystem Fallback (dev) ───────────────────────

import { promises as fs } from 'fs'
import path from 'path'

const LOCAL_ROOT = process.env.PATIENT_MEMORY_ROOT || '/tmp/clawhealth-patients'

async function readFileLocal(patientId: string, file: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(LOCAL_ROOT, patientId, file), 'utf-8')
  } catch {
    return null
  }
}

async function writeFileLocal(patientId: string, file: string, content: string): Promise<void> {
  const filepath = path.join(LOCAL_ROOT, patientId, file)
  await fs.mkdir(path.dirname(filepath), { recursive: true })
  await fs.writeFile(filepath, content, 'utf-8')
}

// ─── SOUL.md ───────────────────────────────────────────────

export interface PatientSoul {
  name: string
  conditions: string[]
  communicationStyle: string
  preferredCheckInTime?: string
  language?: string
  personalContext?: string
  clinicalNotes?: string
  doNotMention?: string[]
}

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
  return readFile(patientId, 'SOUL.md')
}

export async function writeSoul(patientId: string, content: string): Promise<void> {
  return writeFile(patientId, 'SOUL.md', content)
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
  return readFile(patientId, 'MEMORY.md')
}

export async function writeMemory(patientId: string, content: string): Promise<void> {
  return writeFile(patientId, 'MEMORY.md', content)
}

// ─── Daily Logs ────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0]
}

export async function readDailyLog(patientId: string, date?: string): Promise<string | null> {
  return readFile(patientId, `memory/${date || todayStr()}.md`)
}

export async function appendDailyLog(patientId: string, entry: string): Promise<void> {
  const date = todayStr()
  const file = `memory/${date}.md`
  const existing = await readFile(patientId, file)

  const header = existing || `# ${date} — Daily Log\n\n`
  const timestamp = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZone: 'America/New_York'
  })

  await writeFile(patientId, file, header + `\n### ${timestamp}\n${entry}\n`)
}

// ─── Initialize Patient Memory ────────────────────────────

export async function initializePatientMemory(
  patientId: string,
  soul: PatientSoul
): Promise<void> {
  await writeSoul(patientId, generateSoulTemplate(soul))
  await writeMemory(patientId, generateMemoryTemplate(soul.name))
  await appendDailyLog(patientId, `Patient memory initialized. Conditions: ${soul.conditions.join(', ')}`)
}

// ─── Load Memory Context for AI Agent ──────────────────────

export async function loadMemoryContext(patientId: string): Promise<string | null> {
  const [soul, memory, todayLog] = await Promise.all([
    readSoul(patientId),
    readMemory(patientId),
    readDailyLog(patientId),
  ])

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayLog = await readDailyLog(patientId, yesterday.toISOString().split('T')[0])

  if (!soul && !memory) return null

  let context = ''
  if (soul) context += `=== PATIENT AGENT IDENTITY ===\n${soul}\n\n`
  if (memory) context += `=== ACCUMULATED PATIENT KNOWLEDGE ===\n${memory}\n\n`
  if (yesterdayLog) context += `=== YESTERDAY'S INTERACTIONS ===\n${yesterdayLog}\n\n`
  if (todayLog) context += `=== TODAY'S INTERACTIONS ===\n${todayLog}\n\n`

  return context
}

// ─── Post-Interaction Memory Update ────────────────────────

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
    if (insights?.moodOrConcern) entry += `\n**Mood/Concern**: ${insights.moodOrConcern}`
    if (insights?.adherenceNote) entry += `\n**Adherence**: ${insights.adherenceNote}`
    if (insights?.behavioralObservation) entry += `\n**Observation**: ${insights.behavioralObservation}`
    await appendDailyLog(patientId, entry)
  } catch {
    // Best-effort
  }
}

// ─── Memory Consolidation (Cron Job) ──────────────────────

export async function consolidateMemory(patientId: string): Promise<void> {
  const logs: string[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const log = await readDailyLog(patientId, d.toISOString().split('T')[0])
    if (log) logs.push(log)
  }

  if (logs.length === 0) return

  const currentMemory = await readMemory(patientId) || ''

  const completion = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 1024,
    system: `You are a clinical memory curator for a patient's AI health agent.
Given the current MEMORY.md and recent daily interaction logs, produce an updated MEMORY.md.

Rules:
- Keep the same section structure (Communication Patterns, Behavioral Observations, etc.)
- Distill NEW patterns from the daily logs into the appropriate sections
- Remove outdated observations contradicted by newer data
- Keep it concise — curated knowledge, not raw logs
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
