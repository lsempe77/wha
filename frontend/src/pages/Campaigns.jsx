import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../api.js'

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api('/campaigns')
      setCampaigns(data)
    } catch {
      /* ignore polling errors */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const hasActive = campaigns.some((c) => ['SCHEDULED', 'RUNNING', 'PENDING'].includes(c.status))
    const t = setInterval(load, hasActive ? 4000 : 15000)
    return () => clearInterval(t)
  }, [load, campaigns])

  if (loading) return <div className="loader">Cargando…</div>

  return (
    <div>
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Campañas</h2>
          <div className="spacer" />
          <Link to="/campaigns/new"><button className="primary">+ Nueva</button></Link>
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {campaigns.length === 0 ? (
          <div className="empty">Aún no hay campañas. Crea la primera.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nombre</th><th>Template</th><th>Programada</th>
                <th>Estado</th><th>Destinatarios</th><th>Fallidos</th><th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.templateName}</td>
                  <td>{new Date(c.scheduledAt).toLocaleString()}</td>
                  <td><span className={`badge ${c.status}`}>{c.status}</span></td>
                  <td>{c.recipientCount}</td>
                  <td>{c.failedCount > 0 ? <strong style={{ color: 'var(--danger)' }}>{c.failedCount}</strong> : 0}</td>
                  <td><Link to={`/campaigns/${c.id}`}><button className="ghost">Ver</button></Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
