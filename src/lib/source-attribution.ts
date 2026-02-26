/**
 * Source Attribution & Verification Utilities
 * 
 * Implements the 4-tier confidence model for patient-reported data:
 * 
 * Tier 0 (Unknown):  No source information available
 * Tier 1 (Low):      Vague patient report ("I think maybe he gave me something")
 * Tier 2 (Medium):   Clear patient report ("My doctor started me on metoprolol 50mg")
 * Tier 3 (High):     Physician-verified or device-reported data
 * 
 * Source types track WHERE data came from.
 * Verification status tracks WHETHER a physician has reviewed it.
 * Confidence score tracks HOW reliable the original report was.
 * 
 * Safety rule: Critical self-reports (stopped anticoagulant, chest pain)
 * escalate IMMEDIATELY regardless of verification status.
 * Escalation is based on CONTENT, not verification.
 * 
 * @see nanoclaw-memory-shipped.md — Albert's implementation notes
 * @see storage-architecture-response — joint spec on hybrid storage
 */

import type { SourceType, VerificationStatus } from '@prisma/client'

// ─── Prompt Injection Format ─────────────────────────────────
// This is the format Albert requested for how verified vs unverified
// data appears in the AI agent's context window.

export interface AttributedDatum {
  value: string
  sourceType: SourceType
  verificationStatus: VerificationStatus
  verifiedBy?: string | null
  verifiedAt?: Date | null
  sourceConfidence: number
  recordedAt?: Date
}

/**
 * Format a clinical datum for injection into the AI agent's context window.
 * 
 * Examples:
 *   [VERIFIED by Dr. Bander 2026-02-21] Metoprolol 100mg daily
 *   [UNVERIFIED - patient reported 2026-02-20] Metoprolol dose changed to 100mg
 *   [PENDING REVIEW - AI extracted 2026-02-22] New symptom: ankle swelling
 *   [DISPUTED by Dr. Bander 2026-02-23] Patient claims allergic to lisinopril
 */
export function formatForPromptInjection(
  label: string,
  datum: AttributedDatum
): string {
  const date = datum.recordedAt
    ? datum.recordedAt.toISOString().split('T')[0]
    : new Date().toISOString().split('T')[0]

  switch (datum.verificationStatus) {
    case 'VERIFIED':
      return `[VERIFIED${datum.verifiedBy ? ` by ${datum.verifiedBy}` : ''}${datum.verifiedAt ? ` ${datum.verifiedAt.toISOString().split('T')[0]}` : ''}] ${label}: ${datum.value}`

    case 'DISPUTED':
      return `[DISPUTED${datum.verifiedBy ? ` by ${datum.verifiedBy}` : ''}] ${label}: ${datum.value}`

    case 'PENDING_REVIEW':
      return `[PENDING REVIEW - ${sourceTypeLabel(datum.sourceType)} ${date}] ${label}: ${datum.value}`

    case 'UNVERIFIED':
    default:
      return `[UNVERIFIED - ${sourceTypeLabel(datum.sourceType)} ${date}] ${label}: ${datum.value}`
  }
}

function sourceTypeLabel(sourceType: SourceType): string {
  const labels: Record<SourceType, string> = {
    PATIENT_SMS: 'patient reported via SMS',
    PATIENT_VOICE: 'patient reported via call',
    PATIENT_PORTAL: 'patient entered via portal',
    CLINICIAN: 'clinician entered',
    DEVICE: 'device reported',
    EMR_IMPORT: 'imported from EMR',
    AI_EXTRACTED: 'AI extracted',
    SYSTEM: 'system generated',
  }
  return labels[sourceType] || 'unknown source'
}

/**
 * Format a list of medications with source attribution for the AI context window.
 */
export function formatMedicationsForContext(
  medications: Array<{
    drugName: string
    dose: string
    frequency: string
    sourceType: SourceType
    verificationStatus: VerificationStatus
    verifiedBy?: string | null
    verifiedAt?: Date | null
    sourceConfidence: number
    startDate: Date
    active: boolean
  }>
): string {
  if (medications.length === 0) return 'No active medications on record.'

  const lines = medications
    .filter((m) => m.active)
    .map((med) =>
      formatForPromptInjection(`${med.drugName} ${med.dose} ${med.frequency}`, {
        value: `${med.drugName} ${med.dose} ${med.frequency}`,
        sourceType: med.sourceType,
        verificationStatus: med.verificationStatus,
        verifiedBy: med.verifiedBy,
        verifiedAt: med.verifiedAt,
        sourceConfidence: med.sourceConfidence,
        recordedAt: med.startDate,
      })
    )

  return `=== CURRENT MEDICATIONS ===\n${lines.join('\n')}`
}

/**
 * Format vitals with source attribution for the AI context window.
 */
export function formatVitalsForContext(
  vitals: Array<{
    type: string
    value: string
    unit: string
    sourceType: SourceType
    verificationStatus: VerificationStatus
    verifiedBy?: string | null
    verifiedAt?: Date | null
    sourceConfidence: number
    recordedAt: Date
  }>
): string {
  if (vitals.length === 0) return 'No recent vitals on record.'

  const lines = vitals.map((vital) =>
    formatForPromptInjection(vital.type.replace(/_/g, ' '), {
      value: `${vital.value} ${vital.unit}`,
      sourceType: vital.sourceType,
      verificationStatus: vital.verificationStatus,
      verifiedBy: vital.verifiedBy,
      verifiedAt: vital.verifiedAt,
      sourceConfidence: vital.sourceConfidence,
      recordedAt: vital.recordedAt,
    })
  )

  return `=== RECENT VITALS ===\n${lines.join('\n')}`
}

// ─── Confidence Scoring ──────────────────────────────────────

/**
 * Estimate confidence score from a patient message.
 * 
 * Tier 3 (high): Specific drug name + dose + prescriber mentioned
 * Tier 2 (medium): Specific drug name mentioned clearly
 * Tier 1 (low): Vague reference ("something for cholesterol")
 * Tier 0 (unknown): No useful information
 */
export function estimateConfidence(message: string): number {
  const lower = message.toLowerCase()

  // High confidence: specific drug + dose
  const hasDrugName = /\b(metoprolol|lisinopril|amlodipine|atorvastatin|eliquis|apixaban|warfarin|metformin|furosemide|losartan|carvedilol|spironolactone|digoxin|amiodarone|clopidogrel|entresto|xarelto|rivaroxaban|pradaxa|dabigatran)\b/i.test(lower)
  const hasDose = /\b\d+\s*(mg|mcg|ml|units?)\b/i.test(lower)
  const hasPrescriber = /\b(doctor|dr\.|physician|cardiologist|prescribed|started me on)\b/i.test(lower)

  if (hasDrugName && hasDose) return 3
  if (hasDrugName && hasPrescriber) return 3
  if (hasDrugName) return 2

  // Low confidence: vague references
  const vagueRefs = /\b(something for|a pill for|medicine for|medication for|blood thinner|heart pill|cholesterol pill|blood pressure pill)\b/i.test(lower)
  if (vagueRefs) return 1

  return 0
}

// ─── Verification Badge Helpers (for UI) ─────────────────────

export interface VerificationBadge {
  label: string
  color: string        // tailwind text color
  bgColor: string      // tailwind bg color
  ringColor: string    // tailwind ring color
  icon: string         // emoji or symbol
}

export function getVerificationBadge(status: VerificationStatus): VerificationBadge {
  switch (status) {
    case 'VERIFIED':
      return {
        label: 'Verified',
        color: 'text-emerald-700',
        bgColor: 'bg-emerald-50',
        ringColor: 'ring-emerald-600/10',
        icon: '✓',
      }
    case 'DISPUTED':
      return {
        label: 'Disputed',
        color: 'text-red-700',
        bgColor: 'bg-red-50',
        ringColor: 'ring-red-600/10',
        icon: '✗',
      }
    case 'PENDING_REVIEW':
      return {
        label: 'Pending Review',
        color: 'text-amber-700',
        bgColor: 'bg-amber-50',
        ringColor: 'ring-amber-600/10',
        icon: '⏳',
      }
    case 'UNVERIFIED':
    default:
      return {
        label: 'Unverified',
        color: 'text-gray-500',
        bgColor: 'bg-gray-50',
        ringColor: 'ring-gray-300/10',
        icon: '?',
      }
  }
}

/**
 * Get confidence tier label for display.
 */
export function getConfidenceLabel(score: number): { label: string; color: string } {
  switch (score) {
    case 3:
      return { label: 'High', color: 'text-emerald-600' }
    case 2:
      return { label: 'Medium', color: 'text-amber-600' }
    case 1:
      return { label: 'Low', color: 'text-orange-600' }
    default:
      return { label: 'Unknown', color: 'text-gray-400' }
  }
}
