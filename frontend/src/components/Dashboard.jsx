import Sidebar from './Sidebar.jsx'
import MinerDetail from './MinerDetail.jsx'
import MatrixTable from './MatrixTable.jsx'
import StatsBar from './StatsBar.jsx'
import { Activity, Users, LayoutGrid } from 'lucide-react'
import { useState } from 'react'

export default function Dashboard({
  minersSummary,
  minersDetail,
  matrixData,
  overallStats,
  selectedUid,
  onSelectMiner,
  isConnected,
  lastUpdate,
}) {
  const [activeTab, setActiveTab] = useState('miners')
  const selectedDetail = selectedUid !== null ? minersDetail[selectedUid] : null

  // Clicking a miner in the matrix switches to the detail tab
  const handleSelectMiner = (uid) => {
    onSelectMiner(uid)
    setActiveTab('miners')
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-3">
          <Activity className="text-cyan-400" size={22} />
          <h1 className="text-lg font-semibold tracking-wide text-white">
            Perturb Validator Dashboard
          </h1>
          <span className="text-xs text-slate-400 font-mono">
            perturb-ai / perturb-validator / dk9ms8qo
          </span>
        </div>
        <div className="flex items-center gap-4">
          <StatsBar stats={overallStats} />
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
            <span className="text-slate-400">{isConnected ? 'Live' : 'Reconnecting…'}</span>
            {lastUpdate && (
              <span className="text-slate-500">
                · {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-0 bg-slate-900 border-b border-slate-700 px-4 shrink-0">
        <button
          onClick={() => setActiveTab('miners')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
            activeTab === 'miners'
              ? 'border-cyan-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users size={14} />
          Miners
          <span className="text-xs text-slate-500">({minersSummary.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm border-b-2 transition-colors ${
            activeTab === 'matrix'
              ? 'border-cyan-500 text-white'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutGrid size={14} />
          Score Matrix
          {matrixData?.rows?.length > 0 && (
            <span className="text-[11px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full">
              {matrixData.rows.length}&nbsp;×&nbsp;{matrixData.window_size}
            </span>
          )}
        </button>
      </div>

      {/* Body */}
      {activeTab === 'miners' ? (
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            miners={minersSummary}
            selectedUid={selectedUid}
            onSelect={onSelectMiner}
          />
          <main className="flex-1 overflow-auto bg-base p-4">
            {selectedUid === null ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <Activity size={48} className="mb-4 opacity-30" />
                <p className="text-lg">Select a miner to view details</p>
              </div>
            ) : selectedDetail ? (
              <MinerDetail detail={selectedDetail} />
            ) : (
              <div className="flex items-center justify-center h-full text-slate-500">
                Loading miner {selectedUid}…
              </div>
            )}
          </main>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden p-4">
          <MatrixTable matrixData={matrixData} onSelectMiner={handleSelectMiner} />
        </div>
      )}
    </div>
  )
}
