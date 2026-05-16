import { Trophy } from 'lucide-react'

function emissionBar(value) {
  const pct = Math.round(value * 100)
  if (pct === 0) return null
  return (
    <div className="inline-flex items-center gap-1.5 ml-2">
      <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-yellow-400"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] text-yellow-400">{pct}%</span>
    </div>
  )
}

function RankBadge({ rank }) {
  if (rank === 1)
    return (
      <span className="inline-flex items-center gap-1 text-yellow-400 font-bold">
        <Trophy size={12} />
        #1
      </span>
    )
  if (rank === 2)
    return <span className="text-slate-300 font-semibold font-mono">#2</span>
  if (rank === 3)
    return <span className="text-amber-600 font-semibold font-mono">#3</span>
  return <span className="text-slate-500 font-mono">#{rank}</span>
}

export default function RankingTable({ rankingData, onSelectMiner }) {
  if (!rankingData?.entries?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <Trophy size={48} className="mb-4 opacity-20" />
        <p className="text-lg">No ranking data yet</p>
        <p className="text-xs mt-1 text-slate-600">
          Rankings appear after a <span className="font-mono">set_weights</span> call
        </p>
      </div>
    )
  }

  const { timestamp, entries } = rankingData

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Trophy size={16} className="text-yellow-400" />
          <span className="text-white font-semibold">Validator Rankings</span>
          <span className="text-xs text-slate-500">({entries.length} miners)</span>
        </div>
        <span className="text-xs text-slate-500 font-mono">{timestamp}</span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-slate-700">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 bg-slate-900 z-10">
            <tr className="text-xs text-slate-400 border-b border-slate-700">
              <th className="text-left py-2 px-4 w-20">Rank</th>
              <th className="text-left py-2 px-4">UID</th>
              <th className="text-right py-2 px-4">Avg100</th>
              <th className="text-right py-2 px-4">Emission Raw</th>
              <th className="text-left py-2 px-4">Emission</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr
                key={`${e.uid}-${e.rank}`}
                onClick={() => onSelectMiner?.(e.uid)}
                className={`border-b border-slate-800 transition-colors cursor-pointer
                  ${e.rank === 1
                    ? 'bg-yellow-500/5 hover:bg-yellow-500/10'
                    : 'hover:bg-slate-800/50'
                  }`}
              >
                <td className="py-2 px-4">
                  <RankBadge rank={e.rank} />
                </td>
                <td className="py-2 px-4 font-mono font-semibold text-white">
                  {e.uid}
                </td>
                <td className="py-2 px-4 text-right font-mono text-cyan-300">
                  {e.avg100.toFixed(6)}
                </td>
                <td className="py-2 px-4 text-right font-mono text-slate-400">
                  {e.emission_raw.toFixed(6)}
                </td>
                <td className="py-2 px-4">
                  <div className="flex items-center">
                    <span className={`font-mono text-xs ${e.emission > 0 ? 'text-yellow-400 font-bold' : 'text-slate-600'}`}>
                      {e.emission.toFixed(6)}
                    </span>
                    {emissionBar(e.emission)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
