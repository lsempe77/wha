import { useState, useEffect, useCallback } from 'react'
import api from '../api.js'

export default function Stats() {
  const [stats, setStats] = useState(null)
  const [health, setHealth] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const [s, h] = await Promise.all([api('/stats'), api('/status/health')])
      setStats(s)
      setHealth(h)
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const t = setInterval(load, 10000)
    return () => clearInterval(t)
  }, [load])

  if (loading) return <div className="loader">Cargando…</div>

  return (
    <div>
      <div className="card">
        <h2>Salud del sistema</h2>
        {health && (
          <div className="stats-grid">
            {Object.entries(health.checks).map(([k, v]) => (
              <div className="stat-box" key={k}>
                <div className="num" style={{ fontSize: 16, color: v === 'ok' || v === true ? 'var(--ok)' : 'var(--warn)' }}>
                  {v === 'ok' || v === true ? 'OK' : String(v).toUpperCase()}
                </div>
                <div className="lbl">{k}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {stats && (
        <div className="card">
          <h2>Totales</h2>
          <div className="stats-grid">
            <div className="stat-box"><div className="num">{stats.campaigns}</div><div className="lbl">Campañas</div></div>
            <div className="stat-box"><div className="num">{stats.contacts}</div><div className="lbl">Contactos</div></div>
            <div className="stat-box"><div className="num">{stats.queues?.campaign?.waiting || 0}</div><div className="lbl">Cola campañas</div></div>
            <div className="stat-box"><div className="num">{stats.queues?.message?.waiting || 0}</div><div className="lbl">Cola mensajes</div></div>
          </div>
        </div>
      )}
    </div>
  )
}
