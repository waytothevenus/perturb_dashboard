import { useState, useEffect } from 'react'
import { Settings, X } from 'lucide-react'

export default function ConfigModal({ config, onSave, onClose }) {
  const [form, setForm] = useState({
    wandb_entity:  config?.wandb_entity  ?? '',
    wandb_project: config?.wandb_project ?? '',
    wandb_run_id:  config?.wandb_run_id  ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)

  // Sync form when config prop changes (e.g. initial load)
  useEffect(() => {
    if (config) {
      setForm({
        wandb_entity:  config.wandb_entity  ?? '',
        wandb_project: config.wandb_project ?? '',
        wandb_run_id:  config.wandb_run_id  ?? '',
      })
    }
  }, [config])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.detail ?? `Server error ${res.status}`)
      }
      const updated = await res.json()
      onSave(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-slate-800 border border-slate-600 rounded-lg shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2 text-white font-semibold">
            <Settings size={16} className="text-cyan-400" />
            WandB Run Configuration
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Field
            label="Entity"
            id="wandb_entity"
            value={form.wandb_entity}
            onChange={(v) => setForm(f => ({ ...f, wandb_entity: v }))}
            placeholder="e.g. perturb-ai"
          />
          <Field
            label="Project"
            id="wandb_project"
            value={form.wandb_project}
            onChange={(v) => setForm(f => ({ ...f, wandb_project: v }))}
            placeholder="e.g. perturb-validator"
          />
          <Field
            label="Run ID"
            id="wandb_run_id"
            value={form.wandb_run_id}
            onChange={(v) => setForm(f => ({ ...f, wandb_run_id: v }))}
            placeholder="e.g. dk9ms8qo"
          />

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded px-3 py-2">
              {error}
            </p>
          )}

          <p className="text-xs text-slate-500">
            Saving will clear current data and restart fetching from the new run.
          </p>

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm rounded text-slate-300 hover:text-white border border-slate-600 hover:border-slate-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-sm rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium transition-colors"
            >
              {saving ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, id, value, onChange, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-slate-400 mb-1">
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors"
      />
    </div>
  )
}
