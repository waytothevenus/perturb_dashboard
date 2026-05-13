import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function MetricRow({ label, value, color }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-700/50 last:border-0">
      <span className="text-xs text-slate-400">{label}</span>
      <span className={`text-xs font-mono font-semibold ${color || 'text-white'}`}>
        {typeof value === 'number' ? value.toFixed(6) : value}
      </span>
    </div>
  )
}

function scoreColor(s) {
  if (s >= 0.7) return 'text-green-400'
  if (s >= 0.3) return 'text-yellow-400'
  return 'text-red-400'
}

export default function AnalysisPanel({ stats, scores }) {
  if (!stats || !scores?.length) return <p className="text-slate-500 text-sm">No data</p>

  const reasonData = Object.entries(stats.reasons ?? {})
    .map(([name, count]) => ({ name: name.replace(/_/g, ' '), count }))
    .sort((a, b) => b.count - a.count)

  const REASON_COLORS = [
    '#06b6d4', '#a78bfa', '#34d399', '#fbbf24', '#f97316', '#f43f5e',
  ]

  // Score distribution buckets
  const buckets = [0, 0, 0, 0, 0] // [0-0.2), [0.2-0.4), [0.4-0.6), [0.6-0.8), [0.8-1.0]
  scores.forEach(s => {
    const idx = Math.min(4, Math.floor(s.score / 0.2))
    buckets[idx]++
  })
  const distData = ['0–0.2', '0.2–0.4', '0.4–0.6', '0.6–0.8', '0.8–1'].map((r, i) => ({
    range: r,
    count: buckets[i],
  }))

  return (
    <div className="space-y-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <StatCard
          label="Avg Score"
          value={stats.avg_score?.toFixed(6)}
          color={scoreColor(stats.avg_score ?? 0)}
        />
        <StatCard label="Max Score" value={stats.max_score?.toFixed(6)} color="text-green-400" />
        <StatCard label="Min Score" value={stats.min_score?.toFixed(6)} color="text-red-400" />
        <StatCard
          label="Std Dev"
          value={stats.stdev_score?.toFixed(6)}
          color="text-slate-300"
        />
        <StatCard
          label="Avg Response"
          value={stats.avg_response_time_ms != null ? `${Math.round(stats.avg_response_time_ms)} ms` : '—'}
          sub={
            stats.min_response_time_ms != null
              ? `min ${stats.min_response_time_ms}ms · max ${stats.max_response_time_ms}ms`
              : undefined
          }
          color="text-cyan-300"
        />
        <StatCard label="Entries" value={stats.count} color="text-slate-300" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Avg metrics */}
        <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Avg Metrics</p>
          <MetricRow label="Norm" value={stats.avg_norm} color="text-purple-400" />
          <MetricRow label="RMSE" value={stats.avg_rmse} color="text-orange-400" />
          <MetricRow label="Epsilon" value={stats.avg_epsilon} color="text-yellow-400" />
          <MetricRow label="SSIM" value={stats.avg_ssim} color="text-emerald-400" />
          <MetricRow label="PSNR (dB)" value={stats.avg_psnr_db?.toFixed(6)} color="text-sky-400" />
        </div>

        {/* Score distribution */}
        <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Score Distribution</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={distData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
              <XAxis dataKey="range" tick={{ fontSize: 9, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: '1px solid #475569', fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {distData.map((_, i) => (
                  <Cell key={i} fill={['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'][i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Reason breakdown */}
        <div className="bg-slate-800/60 rounded-lg p-3 border border-slate-700">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Reason Breakdown</p>
          <div className="space-y-1.5">
            {reasonData.map((r, i) => {
              const pct = ((r.count / scores.length) * 100).toFixed(1)
              return (
                <div key={r.name}>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span className="text-slate-300 truncate max-w-[130px]" title={r.name}>{r.name}</span>
                    <span className="text-slate-400">{r.count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: REASON_COLORS[i % REASON_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
