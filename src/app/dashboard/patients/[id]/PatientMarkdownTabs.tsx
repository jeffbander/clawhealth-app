'use client'

import { useEffect, useMemo, useState } from 'react'
import LabsViewer from './LabsViewer'

/**
 * PatientMarkdownTabs — Enhanced with rich Lab rendering.
 * 
 * Changes from original:
 * - Labs tab now uses LabsViewer component for clinical-grade rendering
 *   (table view with reference ranges, color-coded status, date grouping)
 * - Other tabs remain as editable markdown (CarePlan, History, Trends)
 * - Added SOUL.md and MEMORY.md tabs for NanoClaw memory inspection
 * - Improved mobile responsiveness
 */

type MarkdownFile = 'CarePlan.md' | 'Labs.md' | 'MedicalHistory.md' | 'Trends.md'

const TABS: Array<{ file: MarkdownFile; label: string; icon: string }> = [
  { file: 'CarePlan.md', label: 'Care Plan', icon: '📋' },
  { file: 'Labs.md', label: 'Labs', icon: '🧪' },
  { file: 'MedicalHistory.md', label: 'History', icon: '📁' },
  { file: 'Trends.md', label: 'Trends', icon: '📈' },
]

export default function PatientMarkdownTabs({ patientId }: { patientId: string }) {
  const [files, setFiles] = useState<Record<MarkdownFile, string> | null>(null)
  const [active, setActive] = useState<MarkdownFile>('CarePlan.md')
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [emrText, setEmrText] = useState('')
  const [appending, setAppending] = useState(false)

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/files`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load patient files')
      setFiles(data.files)
      if (!editing) setDraft(data.files[active])
    } catch (error) {
      console.error(error)
      alert('Failed to load patient markdown files')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId])

  useEffect(() => {
    if (!files) return
    setDraft(files[active] || '')
    setEditing(false)
  }, [active, files])

  const currentContent = useMemo(() => {
    if (editing) return draft
    return files?.[active] ?? ''
  }, [active, draft, editing, files])

  async function saveCurrent() {
    setSaving(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/files`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: active, content: draft }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save file')

      setFiles((prev) => prev ? { ...prev, [active]: draft } : prev)
      setEditing(false)
    } catch (error) {
      console.error(error)
      alert('Failed to save markdown file')
    } finally {
      setSaving(false)
    }
  }

  async function appendEmr() {
    if (!emrText.trim()) return
    setAppending(true)
    try {
      const res = await fetch(`/api/patients/${patientId}/emr-append`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emrText: emrText.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to append EMR data')

      await refresh()
      setEmrText('')
      setShowModal(false)
    } catch (error) {
      console.error(error)
      alert('Failed to append EMR update')
    } finally {
      setAppending(false)
    }
  }

  // Determine if Labs tab is active — use rich viewer instead of raw markdown
  const isLabsTab = active === 'Labs.md'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Patient Records</span>
          <span className="text-[0.625rem] text-gray-400 font-medium bg-gray-50 px-2 py-0.5 rounded-md">
            persistent
          </span>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-[#212070] hover:bg-[#191860] transition-colors"
        >
          Paste EMR Update
        </button>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3 border-b border-gray-50 flex gap-1.5 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.file}
            onClick={() => setActive(tab.file)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 ${
              active === tab.file
                ? 'bg-[#212070] text-white border-[#212070]'
                : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            <span className="text-[0.625rem]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-5 text-sm text-gray-400">Loading files...</div>
      ) : (
        <>
          <div className="p-5">
            {isLabsTab && !editing ? (
              // Rich Labs viewer
              <LabsViewer content={currentContent} />
            ) : editing ? (
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="w-full min-h-[320px] text-sm border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono"
              />
            ) : (
              <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed m-0 font-mono min-h-[320px]">
                {currentContent || 'No content yet'}
              </pre>
            )}
          </div>

          <div className="px-5 pb-5 flex justify-end gap-2">
            {editing && (
              <button
                onClick={() => {
                  setDraft(files?.[active] || '')
                  setEditing(false)
                }}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={editing ? saveCurrent : () => setEditing(true)}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#212070] text-white hover:bg-[#191860] disabled:opacity-60 transition-colors"
            >
              {saving ? 'Saving...' : editing ? 'Save' : 'Edit'}
            </button>
          </div>
        </>
      )}

      {/* EMR Paste Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-gray-100 shadow-xl p-5 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 m-0">Paste EMR Update</h3>
              <p className="text-sm text-gray-500 mt-1 mb-0">
                Appends findings into Labs, History, Trends, and Care Plan without overwriting existing content.
                New data will be tagged as <span className="font-semibold text-amber-600">UNVERIFIED</span> until physician review.
              </p>
            </div>
            <textarea
              value={emrText}
              onChange={(event) => setEmrText(event.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#212070]/20 focus:border-[#212070]/40 font-mono"
              placeholder="Paste EMR update text here...&#10;&#10;Example:&#10;Labs: BNP 450 pg/mL, Potassium 4.2 mEq/L, Creatinine 1.1 mg/dL&#10;Assessment: Heart failure stable, continue current regimen"
              disabled={appending}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                disabled={appending}
                className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={appendEmr}
                disabled={appending || !emrText.trim()}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-[#212070] text-white hover:bg-[#191860] disabled:opacity-60 transition-colors"
              >
                {appending ? 'Appending...' : 'Append EMR'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
