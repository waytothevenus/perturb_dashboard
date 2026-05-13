import { Users, BarChart2, TrendingUp } from 'lucide-react'

function Stat({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon size={14} className="text-cyan-400 shrink-0" />
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  )
}

export default function StatsBar({ stats }) {
  if (!stats || stats.total_miners === 0) return null
  return (
    <div className="flex items-center gap-5">
      <Stat icon={Users} label="Miners" value={stats.total_miners ?? 0} />
      <Stat icon={BarChart2} label="Processed" value={stats.total_processed ?? 0} />
      <Stat
        icon={TrendingUp}
        label="Avg Score"
        value={(stats.overall_avg_score ?? 0).toFixed(6)}
      />
    </div>
  )
}
