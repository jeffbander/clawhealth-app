/**
 * ClawHealth Patient AI Agent
 * Stateless invocation pattern — context loaded from DB each call
 * PHI decrypted in memory only, never logged
 */
import Anthropic from '@anthropic-ai/sdk'
import { PrismaClient } from '@prisma/client'
import { decryptPHI, decryptJSON } from './encryption'

const prisma = new PrismaClient()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

interface PatientContext {
  firstName: string
  conditions: string[]
  medications: Array<{ drug: string; dose: string; frequency: string; adherenceRate: number }>
  recentVitals: Array<{ type: string; value: string; recordedAt: Date }>
  activeAlerts: Array<{ severity: string; category: string }>
  carePlan?: string
  lastInteraction?: Date | null
}

/**
 * Load patient context from DB, decrypt PHI in memory only
 * NEVER log or persist decrypted values
 */
export async function loadPatientContext(patientId: string): Promise<PatientContext> {
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    include: {
      medications: { where: { active: true } },
      vitals: { orderBy: { recordedAt: 'desc' }, take: 10 },
      alerts: { where: { resolved: false }, orderBy: { createdAt: 'desc' }, take: 5 },
      carePlans: { where: { active: true }, take: 1 }
    }
  })

  // Decrypt PHI in memory — NEVER log these values
  const firstName = decryptPHI(patient.encFirstName)
  const conditions = decryptJSON<string[]>(patient.encConditions)

  const medications = patient.medications.map(m => ({
    drug: m.drugName,
    dose: m.dose,
    frequency: m.frequency,
    adherenceRate: m.adherenceRate
  }))

  const recentVitals = patient.vitals.map(v => ({
    type: v.type,
    value: decryptPHI(v.encValue), // decrypt in memory only
    recordedAt: v.recordedAt
  }))

  const activeAlerts = patient.alerts.map(a => ({
    severity: a.severity,
    category: a.category
  }))

  const carePlan = patient.carePlans[0]
    ? decryptPHI(patient.carePlans[0].encContent)
    : undefined

  return {
    firstName,
    conditions,
    medications,
    recentVitals,
    activeAlerts,
    carePlan,
    lastInteraction: patient.lastInteraction
  }
}

/**
 * Build HIPAA-safe system prompt for the patient agent
 * Uses decrypted context but produces a non-loggable prompt
 */
function buildSystemPrompt(ctx: PatientContext): string {
  const medList = ctx.medications.map(m =>
    `- ${m.drug} ${m.dose} ${m.frequency} (adherence: ${Math.round(m.adherenceRate)}%)`
  ).join('\n')

  const vitalsList = ctx.recentVitals.slice(0, 5).map(v =>
    `- ${v.type}: ${v.value} (${v.recordedAt.toLocaleDateString()})`
  ).join('\n')

  const alertsList = ctx.activeAlerts.map(a =>
    `- ${a.severity} ${a.category} alert`
  ).join('\n')

  return `You are ${ctx.firstName}'s personal AI health coordinator at ClawHealth.
You work under the supervision of their cardiologist at Mount Sinai West.

Your role:
- Support medication adherence and answer questions about their regimen
- Help track symptoms and vitals  
- Remind them of appointments and care plan goals
- Escalate immediately to their physician for: chest pain, shortness of breath, syncope, severe symptoms, suicidal ideation

Current conditions: ${ctx.conditions.join(', ')}

Current medications:
${medList || 'None on file'}

Recent vitals:
${vitalsList || 'None recorded'}

${ctx.activeAlerts.length > 0 ? `Active alerts:\n${alertsList}` : ''}

${ctx.carePlan ? `Care plan summary:\n${ctx.carePlan}` : ''}

Critical rules:
1. NEVER provide specific medical diagnoses
2. ALWAYS recommend contacting their physician for new or worsening symptoms
3. For emergencies: tell them to call 911 immediately
4. Be warm, supportive, and speak in plain language
5. Keep responses concise — suitable for voice calls
6. NEVER make up medication or dosing information`
}

/**
 * Generate AI response for a patient interaction
 * Returns the assistant message and whether escalation is needed
 *
 * Special value: userMessage === "__PROACTIVE_OUTREACH__"
 * → generates a proactive check-in message instead of a response
 */
export async function generatePatientResponse(
  patientId: string,
  userMessage: string,
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<{ response: string; requiresEscalation: boolean; escalationReason?: string }> {
  const ctx = await loadPatientContext(patientId)
  const systemPrompt = buildSystemPrompt(ctx)

  // Proactive outreach mode — generate a friendly check-in message
  if (userMessage === '__PROACTIVE_OUTREACH__') {
    const proactiveSystemPrompt = systemPrompt + `\n\nYou are initiating proactive outreach.
Write a brief, warm, personalized check-in SMS (max 280 chars). 
Ask how they are doing, mention one specific medication or health goal from their profile.
End with "Reply HELP for assistance or STOP to unsubscribe."
Do NOT ask multiple questions. Keep it conversational and concise.`

    const completion = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 200,
      system: proactiveSystemPrompt,
      messages: [{ role: 'user', content: 'Generate proactive outreach message.' }]
    })

    const response = completion.content[0].type === 'text'
      ? completion.content[0].text.slice(0, 320)
      : `Hi ${ctx.firstName}, checking in from your ClawHealth care team. How are you feeling today? Reply HELP for assistance.`

    return { response, requiresEscalation: false }
  }

  // Emergency keywords that require immediate physician alert
  const emergencyKeywords = [
    'chest pain', 'chest pressure', 'cant breathe', "can't breathe", 'shortness of breath',
    'passing out', 'syncope', 'fainted', 'severe pain', 'emergency', '911',
    'heart attack', 'stroke', 'arm pain', 'jaw pain', 'sweating', 'dizzy and chest'
  ]

  const messageLC = userMessage.toLowerCase()
  const requiresEscalation = emergencyKeywords.some(kw => messageLC.includes(kw))
  const escalationReason = requiresEscalation
    ? `Emergency keyword detected in patient message`
    : undefined

  const messages = [
    ...conversationHistory,
    { role: 'user' as const, content: userMessage }
  ]

  const completion = await anthropic.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 512, // Keep responses concise for voice
    system: systemPrompt,
    messages
  })

  const response = completion.content[0].type === 'text'
    ? completion.content[0].text
    : 'I apologize, I had trouble generating a response. Please contact your care team directly.'

  return { response, requiresEscalation, escalationReason }
}
