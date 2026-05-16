import AnalysisPanel from './AnalysisPanel.jsx'
import ScoreChart from './ScoreChart.jsx'
import ScoreTable from './ScoreTable.jsx'
import { Cpu, ChevronLeft, ChevronRight } from 'lucide-react'

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <span className="text-xs text-slate-400 font-mono whitespace-nowrap">
        Page <span className="text-white font-semibold">{page}</span> / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  )
}

export default function MinerDetail({ detail, onPageChange }) {
  const { uid, scores, stats, total = scores?.length, page = 1, page_size = 50 } = detail
  const totalPages = Math.ceil(total / page_size)
  const pageOffset = (page - 1) * page_size

  return (
    <div className="space-y-4">
      {/* Title */}
      <div className="flex items-center gap-3">
        <Cpu size={20} className="text-cyan-400" />
        <h2 className="text-xl font-bold text-white">Miner UID {uid}</h2>
        <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
          {total.toLocaleString()} total scores
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-slate-300">Score Details</h3>
            <span className="text-xs text-slate-500">
              #{pageOffset + 1}–{Math.min(pageOffset + page_size, total)} of {total.toLocaleString()}
            </span>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
        </div>
        <ScoreTable scores={scores} pageOffset={pageOffset} />
        {totalPages > 1 && (
          <div className="flex justify-end mt-3">
            <Pagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
          </div>
        )}
      </div>
    </div>
  )
}
