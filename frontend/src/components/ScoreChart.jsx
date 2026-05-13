import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, Legend, ResponsiveContainer,
} from 'recharts'

const METRIC_COLORS = {
  score: '#06b6d4',
  norm: '#a78bfa',
  rmse: '#f97316',
  ssim: '#34d399',
  epsilon: '#fbbf24',
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs shadow-xl min-w-[200px]">
      <p className="text-slate-400 mb-2 font-mono">{d.timestamp}</p>
      <div className="space-y-1">
        <p><span className="text-cyan-400">Score</span>: <span className="text-white font-bold">{d.score?.toFixed(6)}</span></p>
        <p><span className="text-purple-400">Norm</span>: {d.norm?.toFixed(6)}</p>
        <p><span className="text-orange-400">RMSE</span>: {d.rmse?.toFixed(6)}</p>
        <p><span className="text-emerald-400">SSIM</span>: {d.ssim?.toFixed(6)}</p>
        <p><span className="text-yellow-400">Epsilon</span>: {d.epsilon?.toFixed(6)}</p>
        <p><span className="text-slate-400">PSNR</span>: {d.psnr_db?.toFixed(6)} dB</p>
        {d.response_time_ms != null && (
          <p><span className="text-slate-400">Response</span>: {d.response_time_ms} ms</p>
        )}
        {d.reason && (
          <p><span className="text-slate-400">Reason</span>: <span className="text-rose-300">{d.reason}</span></p>
        )}
      </div>
    </div>
  )
}

export default function ScoreChart({ scores, stats }) {
  const data = scores.map((s, i) => ({ ...s, index: i + 1 }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis
          dataKey="index"
          stroke="#64748b"
          tick={{ fontSize: 11 }}
          label={{ value: 'Entry #', position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 11 }}
        />
        <YAxis
          stroke="#64748b"
          tick={{ fontSize: 11 }}
          domain={[0, 1]}
          tickFormatter={v => v.toFixed(2)}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          formatter={(val) => <span style={{ color: '#94a3b8' }}>{val}</span>}
        />
        {stats?.avg_score != null && (
          <ReferenceLine
            y={stats.avg_score}
            stroke="#06b6d4"
            strokeDasharray="4 4"
            label={{ value: `avg ${stats.avg_score.toFixed(6)}`, fill: '#06b6d4', fontSize: 10, position: 'right' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="score"
          stroke={METRIC_COLORS.score}
          dot={false}
          strokeWidth={2}
          name="Score"
          isAnimationActive={false}
        />
        <Line
          type="monotone"
          dataKey="norm"
          stroke={METRIC_COLORS.norm}
          dot={false}
          strokeWidth={1.5}
          name="Norm"
          isAnimationActive={false}
          strokeDasharray="3 3"
        />
        <Line
          type="monotone"
          dataKey="ssim"
          stroke={METRIC_COLORS.ssim}
          dot={false}
          strokeWidth={1.5}
          name="SSIM"
          isAnimationActive={false}
          strokeDasharray="3 3"
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
