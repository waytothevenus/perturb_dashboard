import { useState } from 'react'
import { ChevronDown, ChevronUp, ChevronRight } from 'lucide-react'
import { toTokyoTime } from '../utils/time.js'

function scoreColor(s) {
  if (s >= 0.7) return 'text-green-400'
  if (s >= 0.3) return 'text-yellow-400'
  return 'text-red-400'
}

function DetailRow({ label, value, mono = true, color }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5">
      <span className="text-slate-400 text-xs shrink-0">{label}</span>
      <span className={`text-xs ${mono ? 'font-mono' : ''} ${color || 'text-white'} text-right`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function ExpandedRow({ entry }) {
  return (
    <tr className="bg-slate-800/80">
      <td colSpan={10} className="px-4 pb-3 pt-1">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-0.5 border-l-2 border-cyan-500/40 pl-4 mt-1">
          <DetailRow label="Task ID" value={entry.task_id} />
          <DetailRow
            label="Response Time"
            value={entry.response_time_ms != null ? `${entry.response_time_ms} ms` : '—'}
            color="text-cyan-300"
          />
          <DetailRow label="Status" value={entry.status} />
          <DetailRow label="Processed" value={entry.processed} />
          <DetailRow label="Reason" value={entry.reason} mono={false} color="text-rose-300" />
          <DetailRow label="Norm" value={entry.norm?.toFixed(6)} color="text-purple-400" />
          <DetailRow label="RMSE" value={entry.rmse?.toFixed(6)} color="text-orange-400" />
          <DetailRow label="Epsilon" value={entry.epsilon?.toFixed(6)} color="text-yellow-400" />
          <DetailRow label="SSIM" value={entry.ssim?.toFixed(6)} color="text-emerald-400" />
          <DetailRow label="PSNR (dB)" value={entry.psnr_db?.toFixed(6)} color="text-sky-400" />
        </div>
      </td>
    </tr>
  )
}

const COLUMNS = [
  { key: 'index', label: '#', sortKey: 'index' },
  { key: 'timestamp', label: 'Timestamp', sortKey: 'timestamp' },
  { key: 'score', label: 'Score', sortKey: 'score' },
  { key: 'norm', label: 'Norm', sortKey: 'norm' },
  { key: 'reason', label: 'Reason', sortKey: 'reason' },
  { key: 'response_time_ms', label: 'RT (ms)', sortKey: 'response_time_ms' },
  { key: 'rmse', label: 'RMSE', sortKey: 'rmse' },
  { key: 'ssim', label: 'SSIM', sortKey: 'ssim' },
  { key: 'psnr_db', label: 'PSNR', sortKey: 'psnr_db' },
  { key: 'expand', label: '' },
]

export default function ScoreTable({ scores }) {
  const [expandedIdx, setExpandedIdx] = useState(null)
  const [sortKey, setSortKey] = useState('index')
  const [sortDir, setSortDir] = useState('asc')

  const handleSort = (key) => {
    if (key === 'expand' || key === 'index') return
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setExpandedIdx(null)
  }

  // Build rows with original index
  const rows = scores.map((s, i) => ({ ...s, index: i + 1 }))

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? ''
    const bv = b[sortKey] ?? ''
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-slate-700">
            {COLUMNS.map(col => (
              <th
                key={col.key}
                className={`text-left py-2 px-2 text-slate-400 font-semibold uppercase tracking-wide select-none
                  ${col.sortKey && col.sortKey !== 'index' ? 'cursor-pointer hover:text-white' : ''}`}
                onClick={() => handleSort(col.key)}
              >
                <span className="flex items-center gap-1">
                  {col.label}
                  {sortKey === col.sortKey && col.sortKey !== 'index' && (
                    sortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, rowIdx) => {
            const isExpanded = expandedIdx === rowIdx
            return [
              <tr
                key={`row-${rowIdx}`}
                className={`border-b border-slate-800 cursor-pointer transition-colors
                  ${isExpanded ? 'bg-slate-800' : 'hover:bg-slate-800/50'}`}
                onClick={() => setExpandedIdx(isExpanded ? null : rowIdx)}
              >
                <td className="py-2 px-2 text-slate-500">{entry.index}</td>
                <td className="py-2 px-2 font-mono text-slate-300 whitespace-nowrap">{toTokyoTime(entry.timestamp)}</td>
                <td className={`py-2 px-2 font-mono font-bold ${scoreColor(entry.score ?? 0)}`}>
                  {entry.score?.toFixed(6)}
                </td>
                <td className="py-2 px-2 font-mono text-purple-400">{entry.norm?.toFixed(6)}</td>
                <td className="py-2 px-2 text-rose-300 max-w-[120px] truncate" title={entry.reason}>
                  {entry.reason}
                </td>
                <td className="py-2 px-2 text-cyan-300 font-mono">
                  {entry.response_time_ms ?? '—'}
                </td>
                <td className="py-2 px-2 font-mono text-orange-400">{entry.rmse?.toFixed(6)}</td>
                <td className="py-2 px-2 font-mono text-emerald-400">{entry.ssim?.toFixed(6)}</td>
                <td className="py-2 px-2 font-mono text-sky-400">{entry.psnr_db?.toFixed(6)}</td>
                <td className="py-2 px-2 text-slate-500">
                  <ChevronRight
                    size={13}
                    className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </td>
              </tr>,
              isExpanded && <ExpandedRow key={`exp-${rowIdx}`} entry={entry} />,
            ]
          })}
        </tbody>
      </table>
    </div>
  )
}
