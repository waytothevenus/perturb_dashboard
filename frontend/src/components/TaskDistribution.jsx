import { useState, useMemo } from 'react'
import { BarChart2, Search, ChevronDown, ChevronRight } from 'lucide-react'

export default function TaskDistribution({ taskDistribution }) {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState('grouped') // 'grouped' | 'flat'
  const [sortBy, setSortBy] = useState('count') // 'count' | 'category' | 'label'
  const [collapsedCategories, setCollapsedCategories] = useState({})

  const filtered = useMemo(() => {
    if (!taskDistribution?.length) return []
    const q = search.toLowerCase()
    if (!q) return taskDistribution
    return taskDistribution.filter(
      r =>
        r.category.toLowerCase().includes(q) ||
        r.output_label.toLowerCase().includes(q),
    )
  }, [taskDistribution, search])

  const maxCount = useMemo(
    () => Math.max(...(filtered.map(r => r.count)), 1),
    [filtered],
  )

  const sortedFlat = useMemo(() => {
    const arr = [...filtered]
    if (sortBy === 'count') arr.sort((a, b) => b.count - a.count || a.output_label.localeCompare(b.output_label))
    else if (sortBy === 'category') arr.sort((a, b) => a.category.localeCompare(b.category) || b.count - a.count)
    else arr.sort((a, b) => a.output_label.localeCompare(b.output_label))
    return arr
  }, [filtered, sortBy])

  const grouped = useMemo(() => {
    const map = {}
    for (const r of filtered) {
      if (!map[r.category]) map[r.category] = { total: 0, unique: 0, labels: [] }
      map[r.category].total += r.count
      map[r.category].unique += 1
      map[r.category].labels.push(r)
    }
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([cat, g]) => ({
        category: cat,
        total: g.total,
        unique: g.unique,
        labels: g.labels.sort((a, b) => b.count - a.count),
      }))
  }, [filtered])

  const toggleCategory = cat =>
    setCollapsedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))

  const totalTasks = useMemo(
    () => (taskDistribution || []).reduce((s, r) => s + r.count, 0),
    [taskDistribution],
  )

  if (!taskDistribution?.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500">
        <BarChart2 size={48} className="mb-4 opacity-30" />
        <p className="text-lg">No task distribution data yet</p>
        <p className="text-sm mt-1 opacity-60">
          Appears after the first poll cycle (≤{' '}
          {window.__POLL_INTERVAL__ ?? 30} s)
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Summary strip */}
      <div className="flex items-center gap-4 px-1 text-xs text-slate-400 shrink-0">
        <span>
          <span className="text-white font-semibold">{totalTasks}</span> total tasks
        </span>
        <span>
          <span className="text-white font-semibold">{taskDistribution.length}</span> label combinations
        </span>
        <span>
          <span className="text-white font-semibold">
            {[...new Set(taskDistribution.map(r => r.category))].length}
          </span>{' '}
          categories
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap shrink-0">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by category or label…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-600"
          />
        </div>

        {/* View toggle */}
        <div className="flex rounded overflow-hidden border border-slate-700 shrink-0">
          {[['grouped', 'Grouped'], ['flat', 'Flat']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setViewMode(val)}
              className={`px-3 py-1.5 text-xs transition-colors ${
                viewMode === val
                  ? 'bg-cyan-700 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort (flat only) */}
        {viewMode === 'flat' && (
          <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
            <span className="mr-1">Sort:</span>
            {[['count', 'Count ↓'], ['category', 'Category'], ['label', 'Label']].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSortBy(val)}
                className={`px-2 py-1 rounded transition-colors ${
                  sortBy === val
                    ? 'bg-slate-600 text-white'
                    : 'hover:bg-slate-700 text-slate-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {search && (
          <span className="text-xs text-slate-500 ml-auto shrink-0">
            {filtered.length} / {taskDistribution.length} shown
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto min-h-0">
        {viewMode === 'grouped' ? (
          <div className="space-y-1.5 pb-4">
            {grouped.map(g => {
              const isOpen = !collapsedCategories[g.category]
              const catMax = Math.max(...g.labels.map(l => l.count), 1)
              return (
                <div
                  key={g.category}
                  className="bg-slate-800 rounded border border-slate-700 overflow-hidden"
                >
                  <button
                    onClick={() => toggleCategory(g.category)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 text-left transition-colors"
                  >
                    {isOpen
                      ? <ChevronDown size={13} className="text-slate-400 shrink-0" />
                      : <ChevronRight size={13} className="text-slate-400 shrink-0" />}
                    <span className="font-mono text-cyan-300 text-sm font-medium capitalize">
                      {g.category.replace(/_/g, ' ')}
                    </span>
                    <div className="ml-auto flex items-center gap-3 text-xs text-slate-400 shrink-0">
                      <span>{g.unique} label{g.unique !== 1 ? 's' : ''}</span>
                      <span className="text-slate-300 font-semibold">{g.total} tasks</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-slate-700">
                      {g.labels.map(l => (
                        <div
                          key={l.output_label}
                          className="flex items-center gap-3 px-5 py-1.5 hover:bg-slate-700/30 text-sm"
                        >
                          <span className="text-slate-200 flex-1 min-w-0 truncate" title={l.output_label}>
                            {l.output_label}
                          </span>
                          <div className="flex items-center gap-2 w-36 shrink-0">
                            <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-cyan-500 rounded-full transition-all"
                                style={{ width: `${(l.count / catMax) * 100}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-400 w-5 text-right tabular-nums">
                              {l.count}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-900">
              <tr className="text-slate-400 text-xs uppercase tracking-wide">
                <th className="text-left px-3 py-2 font-medium">Category</th>
                <th className="text-left px-3 py-2 font-medium">Output Label</th>
                <th className="text-right px-3 py-2 font-medium w-14">Count</th>
                <th className="px-3 py-2 w-32" />
              </tr>
            </thead>
            <tbody>
              {sortedFlat.map((r, i) => (
                <tr
                  key={`${r.category}-${r.output_label}`}
                  className={i % 2 === 0 ? 'bg-slate-800/40' : ''}
                >
                  <td className="px-3 py-1.5 font-mono text-cyan-300 capitalize whitespace-nowrap">
                    {r.category.replace(/_/g, ' ')}
                  </td>
                  <td className="px-3 py-1.5 text-slate-200">{r.output_label}</td>
                  <td className="px-3 py-1.5 text-right text-slate-300 tabular-nums">
                    {r.count}
                  </td>
                  <td className="px-3 py-1.5">
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500 rounded-full"
                        style={{ width: `${(r.count / maxCount) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
