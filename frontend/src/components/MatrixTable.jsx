import { useState, useRef } from 'react'
import { Search, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react'
import { toTokyoTime } from '../utils/time.js'

// UID col: 80px, Avg col: 64px, Latest col: 64px
const COL_UID_W    = 80
const COL_AVG_W    = 80
const COL_LATEST_W = 80
const CELL_W       = 42  // px per score cell (wider to show text)
const CELL_H       = 22  // px per row

function scoreClass(score) {
  if (score == null) return 'text-slate-500'
  if (score >= 0.7) return 'text-green-400'
  if (score >= 0.3) return 'text-yellow-400'
  return 'text-red-400'
}

function SortBtn({ col, current, dir }) {
  if (current !== col) return <ArrowUpDown size={10} className="text-slate-600 ml-0.5" />
  return dir === 'asc' ? <ChevronUp size={11} className="ml-0.5" /> : <ChevronDown size={11} className="ml-0.5" />
}

export default function MatrixTable({ matrixData, onSelectMiner }) {
  const [search, setSearch]   = useState('')
  const [sortBy, setSortBy]   = useState('avg')
  const [sortDir, setSortDir] = useState('desc')
  const [tooltip, setTooltip] = useState(null)

  if (!matrixData?.rows?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-500">
        <p className="text-sm">Waiting for matrix data…</p>
        <p className="text-xs text-slate-600">Data populates after the first poll cycle (≤60 s)</p>
      </div>
    )
  }

  const { rows, window_size } = matrixData
  const SLOTS = window_size || 50

  // Filter
  const filtered = rows.filter(r =>
    search === '' || String(r.uid).includes(search.trim())
  )

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    const av = sortBy === 'uid' ? a.uid : sortBy === 'avg' ? (a.avg_score ?? -1) : (a.latest_score ?? -1)
    const bv = sortBy === 'uid' ? b.uid : sortBy === 'avg' ? (b.avg_score ?? -1) : (b.latest_score ?? -1)
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const handleSort = (key) => {
    if (sortBy === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(key); setSortDir(key === 'uid' ? 'asc' : 'desc') }
  }

  // Table-level mouse delegation — avoids creating 10k+ event handlers
  const handleMouseOver = (e) => {
    const cell = e.target.closest('td.sc')
    if (!cell) return
    const r = +cell.dataset.r
    const s = +cell.dataset.s
    const row  = sorted[r]
    if (!row) return
    const slot = row.slots[s]
    setTooltip({ x: e.clientX, y: e.clientY, uid: row.uid, slot, index: s + 1 })
  }
  const handleMouseOut = (e) => {
    if (!e.relatedTarget?.closest('td.sc')) setTooltip(null)
  }
  const handleMouseMove = (e) => {
    if (tooltip) setTooltip(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)
  }

  const totalW = COL_UID_W + COL_AVG_W + COL_LATEST_W + SLOTS * CELL_W

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filter UID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-36"
          />
        </div>
        <span className="text-xs font-mono text-slate-400">
          {sorted.length} miners × {SLOTS} entries
        </span>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /><span>≥0.7</span>
          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block ml-1" /><span>≥0.3</span>
          <span className="w-2 h-2 rounded-full bg-red-400 inline-block ml-1" /><span>&lt;0.3</span>
          <span className="text-slate-600 ml-1">— empty</span>
        </div>
      </div>

      {/* Table */}
      <div
        className="flex-1 overflow-auto rounded-lg border border-slate-700"
        style={{ maxHeight: 'calc(100vh - 210px)' }}
      >
        <table
          style={{
            borderCollapse: 'separate',
            borderSpacing: 0,
            minWidth: totalW,
            tableLayout: 'fixed',
            width: totalW,
          }}
        >
          <colgroup>
            <col style={{ width: COL_UID_W }} />
            <col style={{ width: COL_AVG_W }} />
            <col style={{ width: COL_LATEST_W }} />
            {Array.from({ length: SLOTS }, (_, i) => <col key={i} style={{ width: CELL_W }} />)}
          </colgroup>

          {/* Header */}
          <thead>
            <tr>
              <th
                onClick={() => handleSort('uid')}
                className="sticky top-0 z-30 bg-slate-900 border-b border-r border-slate-700 px-2 py-2 text-left text-slate-400 text-xs cursor-pointer hover:text-white select-none"
                style={{ left: 0 }}
              >
                <span className="flex items-center">UID <SortBtn col="uid" current={sortBy} dir={sortDir} /></span>
              </th>
              <th
                onClick={() => handleSort('avg')}
                className="sticky top-0 z-30 bg-slate-900 border-b border-r border-slate-700 px-2 py-2 text-center text-slate-400 text-xs cursor-pointer hover:text-white select-none"
                style={{ left: COL_UID_W }}
              >
                <span className="flex items-center justify-center">Avg<SortBtn col="avg" current={sortBy} dir={sortDir} /></span>
              </th>
              <th
                onClick={() => handleSort('latest')}
                className="sticky top-0 z-30 bg-slate-900 border-b border-r border-slate-700 px-2 py-2 text-center text-slate-400 text-xs cursor-pointer hover:text-white select-none"
                style={{ left: COL_UID_W + COL_AVG_W }}
              >
                <span className="flex items-center justify-center">Last<SortBtn col="latest" current={sortBy} dir={sortDir} /></span>
              </th>
              {Array.from({ length: SLOTS }, (_, i) => (
                <th
                  key={i}
                  className="sticky top-0 bg-slate-900 border-b border-slate-800 text-center text-slate-600 font-normal"
                  style={{ fontSize: 9, paddingTop: 4, paddingBottom: 4, zIndex: 20 }}
                >
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>

          {/* Body */}
          <tbody
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
            onMouseMove={handleMouseMove}
          >
            {sorted.map((row, rowIdx) => (
              <tr key={row.uid} className="group">
                {/* UID sticky */}
                <td
                  className="sticky z-10 bg-slate-900 group-hover:bg-slate-800 border-b border-r border-slate-800 px-2 text-xs font-mono font-semibold text-cyan-400 cursor-pointer whitespace-nowrap"
                  style={{ left: 0, height: CELL_H }}
                  onClick={() => onSelectMiner?.(row.uid)}
                >
                  {row.uid}
                </td>
                {/* Avg sticky */}
                <td
                  className={`sticky z-10 bg-slate-900 group-hover:bg-slate-800 border-b border-r border-slate-800 text-center text-xs font-mono whitespace-nowrap ${scoreClass(row.avg_score)}`}
                  style={{ left: COL_UID_W }}
                >
                  {row.avg_score?.toFixed(6) ?? '—'}
                </td>
                {/* Latest sticky */}
                <td
                  className={`sticky z-10 bg-slate-900 group-hover:bg-slate-800 border-b border-r border-slate-800 text-center text-xs font-mono whitespace-nowrap ${scoreClass(row.latest_score)}`}
                  style={{ left: COL_UID_W + COL_AVG_W }}
                >
                  {row.latest_score?.toFixed(6) ?? '—'}
                </td>
                {/* Score cells */}
                {row.slots.map((slot, si) => (
                  <td
                    key={si}
                    data-r={rowIdx}
                    data-s={si}
                    className={`sc border border-slate-800 text-center font-mono cursor-default select-none ${scoreClass(slot?.score ?? null)}`}
                    style={{ fontSize: 9, height: CELL_H, padding: 0 }}
                  >
                    {slot?.score != null ? slot.score.toFixed(4) : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating tooltip */}
      {tooltip?.slot && (
        <div
          className="fixed z-50 pointer-events-none bg-slate-800 border border-slate-600 rounded-lg p-2.5 shadow-2xl text-xs"
          style={{
            left: Math.min(tooltip.x + 14, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 220),
            top: tooltip.y - 100,
            minWidth: 195,
          }}
        >
          <p className="font-semibold text-white mb-1.5">
            UID <span className="text-cyan-400">{tooltip.uid}</span>
            <span className="text-slate-500 ml-2">· Entry {tooltip.index}</span>
          </p>
          <div className="space-y-0.5">
            <p>
              <span className="text-slate-400">Score: </span>
              <span className={`font-bold font-mono ${scoreClass(tooltip.slot.score)}`}>
                {tooltip.slot.score?.toFixed(6) ?? '—'}
              </span>
            </p>
            {tooltip.slot.reason && (
              <p>
                <span className="text-slate-400">Reason: </span>
                <span className="text-rose-300">{tooltip.slot.reason}</span>
              </p>
            )}
            {tooltip.slot.response_time_ms != null && (
              <p>
                <span className="text-slate-400">Response: </span>
                <span className="text-cyan-300">{tooltip.slot.response_time_ms} ms</span>
              </p>
            )}
            {tooltip.slot.timestamp && (
              <p className="text-slate-500 font-mono text-[10px] mt-1">{toTokyoTime(tooltip.slot.timestamp)}</p>
            )}
            {tooltip.slot.task_id && (
              <p className="text-slate-600 font-mono text-[9px] truncate max-w-[190px] mt-0.5">
                {tooltip.slot.task_id}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
