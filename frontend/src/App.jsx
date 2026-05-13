import { useState, useEffect, useRef, useCallback } from 'react'
import Dashboard from './components/Dashboard.jsx'

const WS_URL = `ws://${window.location.host}/ws`

export default function App() {
  const [minersSummary, setMinersSummary] = useState([])
  const [minersDetail, setMinersDetail] = useState({})   // uid -> full detail
  const [overallStats, setOverallStats] = useState({})
  const [selectedUid, setSelectedUid] = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [matrixData, setMatrixData] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)

  const fetchMinerDetail = useCallback(async (uid) => {
    try {
      const res = await fetch(`/api/miners/${uid}`)
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

        // If there are new entries, refresh detail cache for affected miners
        if (data.new_entries?.length) {
          const affectedUids = [...new Set(data.new_entries.map(e => e.uid))]
          affectedUids.forEach(uid => fetchMinerDetail(uid))
        }
        // Refresh matrix
        fetch('/api/matrix').then(r => r.ok ? r.json() : null).then(d => { if (d) setMatrixData(d) }).catch(() => {})
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
    fetch('/api/matrix').then(r => r.ok ? r.json() : null).then(d => { if (d) setMatrixData(d) }).catch(() => {})
  }, [])

  // Fetch detail when a miner is selected and not yet cached
  useEffect(() => {
    if (selectedUid !== null && !minersDetail[selectedUid]) {
      fetchMinerDetail(selectedUid)
    }
  }, [selectedUid, minersDetail, fetchMinerDetail])

  return (
    <Dashboard
      minersSummary={minersSummary}
      minersDetail={minersDetail}
      matrixData={matrixData}
      overallStats={overallStats}
      selectedUid={selectedUid}
      onSelectMiner={setSelectedUid}
      isConnected={isConnected}
      lastUpdate={lastUpdate}
    />
  )
}
