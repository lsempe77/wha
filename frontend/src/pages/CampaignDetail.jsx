import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import api from '../api.js'
import Toast from '../components/Toast.jsx'

export default function CampaignDetail() {
  const { id } = useParams()
  const [campaign, setCampaign] = useState(null)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)

  const load = useCallback(async () => {
    try {
      const [c, s] = await Promise.all([api(`/campaigns/${id}`), api(`/campaigns/${id}/stats`)])
      setCampaign(c)
      setStats(s)
    } catch (err) {
      setToast({ msg: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
    const isActive = campaign && ['SCHEDULED', 'RUNNING', 'PENDING'].includes(campaign.status)
    const t = setInterval(load, isActive ? 3000 : 20000)
    return () => clearInterval(t)
  }, [load, campaign])

  async function cancel() {
    if (!confirm('¿Cancelar la campaña?')) return
    try {
      await api(`/campaigns/${id}/cancel`, { method: 'POST' })
      setToast({ msg: 'Campaña cancelada' })
      load()
    } catch (err) {
      setToast({ msg: err.message, type: 'error' })
    }
  }

  if (loading) return <div className="loader">Cargando…</div>
  if (!campaign) return <div className="empty">No encontrada</div>

  const statusMap = {}
  stats?.statuses?.forEach((s) => { statusMap[s.status] = s._count._all })

  return (
    <div>
      <div className="card">
        <div className="row">
          <div>
            <h2 style={{ margin: 0 }}>{campaign.name}</h2>
            <p className="muted">{campaign.templateName} · {campaign.templateLanguage}</p>
          </div>
          <div className="spacer" />
          <span className={`badge ${campaign.status}`} style={{ fontSize: 13, padding: '6px 14px' }}>{campaign.status}</span>
          {['SCHEDULED', 'PENDING', 'RUNNING'].includes(campaign.status) && (
            <button className="danger" onClick={cancel}>Cancelar</button>
          )}
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          Programada: {new Date(campaign.scheduledAt).toLocaleString()}
          {campaign.startedAt && ` · Iniciada: ${new Date(campaign.startedAt).toLocaleString()}`}
          {campaign.completedAt && ` · Completada: ${new Date(campaign.completedAt).toLocaleString()}`}
        </p>
      </div>

      <div className="card">
        <h2>Estado de envíos</h2>
        <div className="stats-grid">
          {['QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED'].map((s) => (
            <div className="stat-box" key={s}>
              <div className="num">{statusMap[s] || 0}</div>
              <div className="lbl"><span className={`badge ${s}`}>{s}</span></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: 16 }}><h2 style={{ margin: 0 }}>Destinatarios</h2></div>
        <table>
          <thead>
            <tr><th>Teléfono</th><th>Nombre</th><th>Estado</th><th>WA status</th><th>Error</th></tr>
          </thead>
          <tbody>
            {campaign.recipients.map((r) => (
              <tr key={r.id}>
                <td>{r.contact.phone}</td>
                <td>{r.contact.name || '—'}</td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td>{r.waStatus || '—'}</td>
                <td className="muted">{r.errorMessage || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {campaign.recipients.length === 0 && <div className="empty">Sin destinatarios</div>}
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
