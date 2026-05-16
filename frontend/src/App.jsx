import { useState, useEffect, useRef, useCallback } from 'react'
import Dashboard from './components/Dashboard.jsx'
import ConfigModal from './components/ConfigModal.jsx'

const WS_URL = `ws://${window.location.host}/ws`

export default function App() {
  const [minersSummary, setMinersSummary] = useState([])
  const [minersDetail, setMinersDetail] = useState({})   // uid -> full detail
  const [overallStats, setOverallStats] = useState({})
  const [selectedUid, setSelectedUid] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [matrixData, setMatrixData] = useState(null)
  const [wandbConfig, setWandbConfig] = useState(null)
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [rankingData, setRankingData] = useState(null)
  const [taskDistribution, setTaskDistribution] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)

  const fetchMinerDetail = useCallback(async (uid, page = 1) => {
    try {
      const res = await fetch(`/api/miners/${uid}?page=${page}&page_size=50`)
      if (res.ok) {
        const data = await res.json()
        setMinersDetail(prev => ({ ...prev, [uid]: data }))
      }
    } catch (_) {}
  }, [])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setIsConnected(true)
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
        reconnectTimer.current = null
      }
    }

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data)
      const { type, data } = msg

      if (type === 'initial_state' || type === 'scores_update') {
        setMinersSummary(data.miners_summary || [])
        if (data.overall_stats) setOverallStats(data.overall_stats)
        setLastUpdate(new Date())
        if (data.latest_ranking) setRankingData(data.latest_ranking)
        if (data.matrix_data?.rows?.length) setMatrixData(data.matrix_data)
        if (data.task_distribution?.length) setTaskDistribution(data.task_distribution)

        // If there are new entries, refresh detail cache for affected miners (stay on current page)
        if (data.new_entries?.length) {
          const affectedUids = [...new Set(data.new_entries.map(e => e.uid))]
          affectedUids.forEach(uid => {
            const currentPage = minersDetail[uid]?.page ?? 1
            fetchMinerDetail(uid, currentPage)
          })
        }
      }

      if (type === 'config_changed') {
        // Server cleared its state; reset client state
        setMinersSummary([])
        setMinersDetail({})
        setOverallStats({})
        setMatrixData(null)
        setRankingData(null)
        setTaskDistribution(null)
        setSelectedUid(null)
        setLastUpdate(null)
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
  }, [fetchMinerDetail])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [connect])

  // Initial matrix fetch
  useEffect(() => {
    fetch('/api/matrix').then(r => r.ok ? r.json() : null).then(d => { if (d?.rows?.length) setMatrixData(d) }).catch(() => {})
  }, [])

  // Fetch WandB config on mount
  useEffect(() => {
    fetch('/api/config').then(r => r.ok ? r.json() : null).then(d => { if (d) setWandbConfig(d) }).catch(() => {})
  }, [])

  // Fetch latest ranking on mount (fallback before WS delivers initial_state)
  useEffect(() => {
    fetch('/api/ranking').then(r => r.ok ? r.json() : null).then(d => { if (d) setRankingData(d) }).catch(() => {})
    fetch('/api/tasks').then(r => r.ok ? r.json() : null).then(d => { if (d?.length) setTaskDistribution(d) }).catch(() => {})
  }, [])

  const handleConfigSave = (updatedConfig) => {
    setWandbConfig(updatedConfig)
    setShowConfigModal(false)
  }

  // Fetch detail when a miner is selected and not yet cached
  useEffect(() => {
    if (selectedUid !== null && !minersDetail[selectedUid]) {
      fetchMinerDetail(selectedUid)
    }
  }, [selectedUid, minersDetail, fetchMinerDetail])

  return (
    <>
      <Dashboard
        minersSummary={minersSummary}
        minersDetail={minersDetail}
        matrixData={matrixData}
        overallStats={overallStats}
        selectedUid={selectedUid}
        onSelectMiner={setSelectedUid}
        isConnected={isConnected}
        lastUpdate={lastUpdate}
        wandbConfig={wandbConfig}
        onOpenConfig={() => setShowConfigModal(true)}
        rankingData={rankingData}
        taskDistribution={taskDistribution}
        onMinerPageChange={(uid, page) => fetchMinerDetail(uid, page)}
      />
      {showConfigModal && (
        <ConfigModal
          config={wandbConfig}
          onSave={handleConfigSave}
          onClose={() => setShowConfigModal(false)}
        />
      )}
    </>
  )
}
