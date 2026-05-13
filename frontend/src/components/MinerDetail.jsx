import AnalysisPanel from './AnalysisPanel.jsx'
import ScoreChart from './ScoreChart.jsx'
import ScoreTable from './ScoreTable.jsx'
import { Cpu } from 'lucide-react'

export default function MinerDetail({ detail }) {
  const { uid, scores, stats } = detail

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-3">
        <Cpu size={20} className="text-cyan-400" />
        <h2 className="text-xl font-bold text-white">Miner UID {uid}</h2>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
          Window: {scores.length} / 50 scores
        </span>
      </div>

      {/* Score Chart */}
      <div className="bg-surface rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">
          Score History (last {scores.length} entries)
        </h3>
        <ScoreChart scores={scores} stats={stats} />
      </div>

      {/* Analysis */}
      <div className="bg-surface rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Analysis</h3>
        <AnalysisPanel stats={stats} scores={scores} />
      </div>

      {/* Score Table */}
      <div className="bg-surface rounded-xl p-4 border border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300 mb-3">Score Details</h3>
        <ScoreTable scores={scores} />
      </div>
    </div>
  )
}
