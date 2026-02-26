'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * VerificationQueue — Physician verification panel for patient-reported data.
 * 
 * Shows unverified medications and vitals for a specific patient.
 * Physician can verify (✓), dispute (✗), or mark for later review.
 * 
 * Implements the verification workflow from the Manny/Albert joint spec:
 * - Patient-reported data enters as UNVERIFIED
 * - Physician reviews inline on the patient detail page
 * - Verified items get a green badge; disputed items get a red badge
 * 
 * Safety note: Verification status does NOT affect escalation.
 * Critical self-reports always escalate regardless.
 */

interface UnverifiedItem {
  id: string
  type: 'medication' | 'vital'
  label: string
  detail: string
  sourceType: string
  confidence: number
  createdAt: string
}

const CONFIDENCE_LABELS: Record<number, { label: string; color: string }> = {
  3: { label: 'High', color: 'text-emerald-600' },
  2: { label: 'Medium', color: 'text-amber-600' },
  1: { label: 'Low', color: 'text-orange-600' },
  0: { label: 'Unknown', color: 'text-gray-400' },
}

const SOURCE_LABELS: Record<string, string> = {
  PATIENT_SMS: 'Patient SMS',
  PATIENT_VOICE: 'Patient Call',
  PATIENT_PORTAL: 'Patient Portal',
  CLINICIAN: 'Clinician',
  DEVICE: 'Device',
  EMR_IMPORT: 'EMR Import',
  AI_EXTRACTED: 'AI Extracted',
  SYSTEM: 'System',
}

export default function VerificationQueue({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<UnverifiedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<string | null>(null)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/physician/verify')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()

      // Filter to this patient's items
      const patientMeds = (data.medications || [])
        .filter((m: { patient: { id: string } }) => m.patient.id === patientId)
        .map((m: { id: string; drugName: string; dose: string; frequency: string; sourceType: string; sourceConfidence: number; createdAt: string }) => ({
          id: m.id,
          type: 'medication' as const,
          label: m.drugName,
          detail: `${m.dose} ${m.frequency}`,
          sourceType: m.sourceType,
          confidence: m.sourceConfidence,
          createdAt: m.createdAt,
        }))

      const patientVitals = (data.vitals || [])
        .filter((v: { patient: { id: string } }) => v.patient.id === patientId)
        .map((v: { id: string; type: string; encValue: string; unit: string; sourceType: string; sourceConfidence: number; createdAt: string }) => ({
          id: v.id,
          type: 'vital' as const,
          label: v.type.replace(/_/g, ' '),
          detail: `${v.encValue} ${v.unit}`,
          sourceType: v.sourceType,
          confidence: v.sourceConfidence,
          createdAt: v.createdAt,
        }))

      setItems([...patientMeds, ...patientVitals])
    } catch (err) {
      console.error('Failed to load verification queue:', err)
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  async function handleAction(item: UnverifiedItem, action: 'verify' | 'dispute') {
    setProcessing(item.id)
    try {
      const res = await fetch('/api/physician/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resourceType: item.type,
          resourceId: item.id,
          action,
        }),
      })
      if (!res.ok) throw new Error('Failed to verify')
      // Remove from list
      setItems((prev) => prev.filter((i) => i.id !== item.id))
    } catch (err) {
      console.error('Verification failed:', err)
      alert('Failed to update verification status')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <span className="text-sm font-semibold text-gray-900">Verification Queue</span>
        </div>
        <div className="p-5 text-sm text-gray-400">Loading...</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Verification Queue</span>
          <span className="text-[0.625rem] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md">
            all clear
          </span>
        </div>
        <div className="p-5 text-sm text-gray-400 flex items-center gap-2">
          <span className="text-emerald-500">✓</span>
          No items pending physician verification
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Verification Queue</span>
          <span className="text-[0.625rem] text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded-md ring-1 ring-amber-600/10">
            {items.length} pending
          </span>
        </div>
        <span className="text-[0.625rem] text-gray-400">
          Patient-reported data awaiting physician review
        </span>
      </div>

      <div className="divide-y divide-gray-50">
        {items.map((item) => {
          const conf = CONFIDENCE_LABELS[item.confidence] || CONFIDENCE_LABELS[0]
          const isProcessing = processing === item.id

          return (
            <div key={item.id} className="px-5 py-3.5 flex items-center gap-4">
              {/* Type icon */}
              <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-sm flex-shrink-0">
                {item.type === 'medication' ? '💊' : '📊'}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                  <span className="text-xs text-gray-400">{item.detail}</span>
                </div>
                <div className="flex items-center gap-3 text-[0.625rem]">
                  <span className="text-gray-400">
                    {SOURCE_LABELS[item.sourceType] || item.sourceType}
                  </span>
                  <span className={conf.color}>
                    Confidence: {conf.label}
                  </span>
                  <span className="text-gray-300">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleAction(item, 'verify')}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-600/10 disabled:opacity-50 transition-colors"
                  title="Verify — confirm this data is accurate"
                >
                  ✓ Verify
                </button>
                <button
                  onClick={() => handleAction(item, 'dispute')}
                  disabled={isProcessing}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-700 hover:bg-red-100 ring-1 ring-red-600/10 disabled:opacity-50 transition-colors"
                  title="Dispute — flag this data as incorrect"
                >
                  ✗ Dispute
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
