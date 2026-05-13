import { useState } from 'react'
import { Search } from 'lucide-react'

function scoreColor(score) {
  if (score >= 0.7) return 'text-green-400'
  if (score >= 0.3) return 'text-yellow-400'
  return 'text-red-400'
}

function scoreBg(score) {
  if (score >= 0.7) return 'bg-green-500'
  if (score >= 0.3) return 'bg-yellow-500'
  return 'bg-red-500'
}

function MinerRow({ miner, selected, onSelect }) {
  const score = miner.latest_score ?? 0
  const barW = Math.max(2, Math.round(score * 100))

  return (
    <button
      onClick={() => onSelect(miner.uid)}
      className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-colors
        ${selected
          ? 'bg-cyan-500/20 border border-cyan-500/40'
          : 'hover:bg-slate-700/50 border border-transparent'
        }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-mono font-semibold text-white">UID {miner.uid}</span>
        <span className={`text-xs font-mono font-bold ${scoreColor(score)}`}>
          {score.toFixed(6)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {/* Mini score bar */}
        <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${scoreBg(score)}`}
            style={{ width: `${barW}%` }}
          />
        </div>
        <span className="text-[10px] text-slate-500">{miner.count}/{50}</span>
      </div>
      <div className="mt-1 flex gap-1 flex-wrap">
        {Object.entries(miner.reasons ?? {}).map(([reason, cnt]) => (
          <span
            key={reason}
            className="text-[9px] bg-slate-700 text-slate-400 rounded px-1 py-0.5 truncate max-w-[90px]"
            title={`${reason}: ${cnt}`}
          >
            {reason.replace(/_/g, ' ')}: {cnt}
          </span>
        ))}
      </div>
    </button>
  )
}

export default function Sidebar({ miners, selectedUid, onSelect }) {
  const [filter, setFilter] = useState('')

  const visible = (filter === ''
    ? miners
    : miners.filter(m => String(m.uid).includes(filter.trim()))
  ).slice().sort((a, b) => (b.avg_score ?? -1) - (a.avg_score ?? -1))

  return (
    <aside className="w-64 shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-700 space-y-1.5">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Miners ({miners.length})
        </p>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Filter UID…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-md pl-6 pr-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-600"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {miners.length === 0 ? (
          <p className="text-xs text-slate-500 text-center mt-6">Waiting for data…</p>
        ) : visible.length === 0 ? (
          <p className="text-xs text-slate-500 text-center mt-6">No match for "{filter}"</p>
        ) : (
          visible.map(m => (
            <MinerRow
              key={m.uid}
              miner={m}
              selected={selectedUid === m.uid}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </aside>
  )
}
