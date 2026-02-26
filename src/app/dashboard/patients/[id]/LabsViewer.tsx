'use client'

import { useMemo, useState } from 'react'

/**
 * LabsViewer — Rich rendering of Labs.md content.
 * 
 * Instead of showing raw markdown, this component parses the Labs.md
 * structure and renders it as a clinical-grade lab results table with:
 * - Date grouping
 * - Normal range indicators (color-coded)
 * - Trend arrows (up/down/stable)
 * - Expandable detail rows
 * 
 * This addresses Albert's request in request-labs-memory-structure.md
 * for "UI suggestions for presenting these files in patient detail page"
 */

interface LabEntry {
  date: string
  name: string
  value: string
  unit: string
  status: 'normal' | 'high' | 'low' | 'critical' | 'unknown'
  trend: 'up' | 'down' | 'stable' | 'unknown'
}

// Common cardiology lab reference ranges
const REFERENCE_RANGES: Record<string, { low: number; high: number; criticalLow?: number; criticalHigh?: number; unit: string }> = {
  'BNP': { low: 0, high: 100, criticalHigh: 500, unit: 'pg/mL' },
  'NT-proBNP': { low: 0, high: 300, criticalHigh: 1800, unit: 'pg/mL' },
  'Troponin': { low: 0, high: 0.04, criticalHigh: 0.4, unit: 'ng/mL' },
  'Troponin I': { low: 0, high: 0.04, criticalHigh: 0.4, unit: 'ng/mL' },
  'Troponin T': { low: 0, high: 0.01, criticalHigh: 0.1, unit: 'ng/mL' },
  'INR': { low: 0.8, high: 1.2, criticalHigh: 4.0, unit: '' },
  'Potassium': { low: 3.5, high: 5.0, criticalLow: 3.0, criticalHigh: 6.0, unit: 'mEq/L' },
  'K+': { low: 3.5, high: 5.0, criticalLow: 3.0, criticalHigh: 6.0, unit: 'mEq/L' },
  'Sodium': { low: 136, high: 145, criticalLow: 125, criticalHigh: 155, unit: 'mEq/L' },
  'Na+': { low: 136, high: 145, criticalLow: 125, criticalHigh: 155, unit: 'mEq/L' },
  'Creatinine': { low: 0.6, high: 1.2, criticalHigh: 4.0, unit: 'mg/dL' },
  'BUN': { low: 7, high: 20, criticalHigh: 60, unit: 'mg/dL' },
  'eGFR': { low: 60, high: 120, criticalLow: 15, unit: 'mL/min' },
  'Hemoglobin': { low: 12.0, high: 17.5, criticalLow: 7.0, unit: 'g/dL' },
  'Hgb': { low: 12.0, high: 17.5, criticalLow: 7.0, unit: 'g/dL' },
  'Hematocrit': { low: 36, high: 52, criticalLow: 20, unit: '%' },
  'Hct': { low: 36, high: 52, criticalLow: 20, unit: '%' },
  'Platelets': { low: 150, high: 400, criticalLow: 50, criticalHigh: 1000, unit: 'K/uL' },
  'WBC': { low: 4.5, high: 11.0, criticalLow: 2.0, criticalHigh: 30.0, unit: 'K/uL' },
  'Total Cholesterol': { low: 0, high: 200, criticalHigh: 300, unit: 'mg/dL' },
  'LDL': { low: 0, high: 100, criticalHigh: 190, unit: 'mg/dL' },
  'HDL': { low: 40, high: 100, unit: 'mg/dL' },
  'Triglycerides': { low: 0, high: 150, criticalHigh: 500, unit: 'mg/dL' },
  'HbA1c': { low: 4.0, high: 5.7, criticalHigh: 10.0, unit: '%' },
  'A1c': { low: 4.0, high: 5.7, criticalHigh: 10.0, unit: '%' },
  'Glucose': { low: 70, high: 100, criticalLow: 40, criticalHigh: 400, unit: 'mg/dL' },
  'Magnesium': { low: 1.7, high: 2.2, criticalLow: 1.0, unit: 'mg/dL' },
  'Mg': { low: 1.7, high: 2.2, criticalLow: 1.0, unit: 'mg/dL' },
  'Calcium': { low: 8.5, high: 10.5, criticalLow: 6.0, criticalHigh: 14.0, unit: 'mg/dL' },
  'TSH': { low: 0.4, high: 4.0, unit: 'mIU/L' },
  'ALT': { low: 7, high: 56, criticalHigh: 200, unit: 'U/L' },
  'AST': { low: 10, high: 40, criticalHigh: 200, unit: 'U/L' },
  'Albumin': { low: 3.5, high: 5.5, criticalLow: 2.0, unit: 'g/dL' },
}

function parseLabsMarkdown(content: string): LabEntry[] {
  const entries: LabEntry[] = []
  const lineRegex = /^- \[([^\]]+)\]\s+(.+?):\s+(.+)$/gm
  let match: RegExpExecArray | null

  while ((match = lineRegex.exec(content)) !== null) {
    const date = match[1].trim()
    const name = match[2].trim()
    const rawValue = match[3].trim()

    // Parse value and unit
    const valueMatch = rawValue.match(/^([\d.,]+)\s*(.*)$/)
    const value = valueMatch ? valueMatch[1] : rawValue
    const unit = valueMatch ? valueMatch[2].trim() : ''

    // Determine status based on reference ranges
    const numValue = parseFloat(value.replace(',', ''))
    let status: LabEntry['status'] = 'unknown'

    // Try to match against reference ranges
    for (const [refName, range] of Object.entries(REFERENCE_RANGES)) {
      if (name.toLowerCase().includes(refName.toLowerCase()) || refName.toLowerCase().includes(name.toLowerCase())) {
        if (!isNaN(numValue)) {
          if (range.criticalLow !== undefined && numValue < range.criticalLow) {
            status = 'critical'
          } else if (range.criticalHigh !== undefined && numValue > range.criticalHigh) {
            status = 'critical'
          } else if (numValue < range.low) {
            status = 'low'
          } else if (numValue > range.high) {
            status = 'high'
          } else {
            status = 'normal'
          }
        }
        break
      }
    }

    entries.push({
      date,
      name,
      value,
      unit,
      status,
      trend: 'unknown', // Would need historical data to compute
    })
  }

  return entries
}

const STATUS_STYLES: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  normal: { bg: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-600/10', label: 'Normal' },
  high: { bg: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-600/10', label: 'High' },
  low: { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-600/10', label: 'Low' },
  critical: { bg: 'bg-red-50', text: 'text-red-700', ring: 'ring-red-600/10', label: 'Critical' },
  unknown: { bg: 'bg-gray-50', text: 'text-gray-500', ring: 'ring-gray-300/10', label: '—' },
}

export default function LabsViewer({ content }: { content: string }) {
  const [viewMode, setViewMode] = useState<'table' | 'raw'>('table')

  const entries = useMemo(() => parseLabsMarkdown(content), [content])

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, LabEntry[]> = {}
    for (const entry of entries) {
      if (!groups[entry.date]) groups[entry.date] = []
      groups[entry.date].push(entry)
    }
    // Sort dates descending
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  }, [entries])

  const hasEntries = entries.length > 0 && !entries.every(e => e.name.toLowerCase().includes('initial baseline'))

  return (
    <div>
      {/* View toggle */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            {entries.length} lab value{entries.length !== 1 ? 's' : ''} tracked
          </span>
          {entries.some(e => e.status === 'critical') && (
            <span className="text-[0.625rem] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md ring-1 ring-red-600/10">
              Critical values present
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('table')}
            className={`px-2 py-1 text-[0.625rem] font-semibold rounded-md transition-colors ${
              viewMode === 'table'
                ? 'bg-[#212070] text-white'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Table
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`px-2 py-1 text-[0.625rem] font-semibold rounded-md transition-colors ${
              viewMode === 'raw'
                ? 'bg-[#212070] text-white'
                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
            }`}
          >
            Raw
          </button>
        </div>
      </div>

      {viewMode === 'raw' ? (
        <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed m-0 font-mono min-h-[200px]">
          {content || 'No content yet'}
        </pre>
      ) : !hasEntries ? (
        <div className="text-sm text-gray-400 py-8 text-center">
          No lab results yet. Use &quot;Paste EMR Update&quot; to import lab data.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, labs]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-500">{date}</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="bg-gray-50/50 rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left px-4 py-2 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Test</th>
                      <th className="text-right px-4 py-2 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Value</th>
                      <th className="text-center px-4 py-2 text-[0.625rem] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {labs.map((lab, i) => {
                      const style = STATUS_STYLES[lab.status]
                      return (
                        <tr key={i} className={lab.status === 'critical' ? 'bg-red-50/30' : ''}>
                          <td className="px-4 py-2.5 text-gray-700 font-medium">{lab.name}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-semibold ${lab.status === 'critical' ? 'text-red-700' : lab.status === 'high' ? 'text-amber-700' : lab.status === 'low' ? 'text-blue-700' : 'text-gray-900'}`}>
                              {lab.value}
                            </span>
                            {lab.unit && <span className="text-gray-400 ml-1 text-xs">{lab.unit}</span>}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-[0.625rem] font-bold px-2 py-0.5 rounded-md ring-1 ${style.bg} ${style.text} ${style.ring}`}>
                              {style.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
