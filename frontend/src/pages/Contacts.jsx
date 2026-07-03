import { useState, useEffect, useCallback } from 'react'
import api from '../api.js'
import Toast from '../components/Toast.jsx'

export default function Contacts() {
  const [contacts, setContacts] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const limit = 50

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api(`/contacts?limit=${limit}&offset=${offset}${q ? `&q=${encodeURIComponent(q)}` : ''}`)
      setContacts(data.data)
      setTotal(data.total)
    } catch (err) {
      setToast({ msg: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [offset, q])

  useEffect(() => { load() }, [load])

  async function del(id) {
    if (!confirm('¿Borrar contacto?')) return
    try {
      await api(`/contacts/${id}`, { method: 'DELETE' })
      load()
      setToast({ msg: 'Contacto borrado' })
    } catch (err) {
      setToast({ msg: err.message, type: 'error' })
    }
  }

  return (
    <div>
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Contactos</h2>
          <div className="spacer" />
          <input
            style={{ width: 240 }}
            placeholder="Buscar…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setOffset(0) }}
          />
        </div>
      </div>
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="loader">Cargando…</div>
        ) : contacts.length === 0 ? (
          <div className="empty">Sin contactos. Sube un CSV desde el menú.</div>
        ) : (
          <table>
            <thead>
              <tr><th>Teléfono</th><th>Nombre</th><th>Tags</th><th></th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id}>
                  <td>{c.phone}</td>
                  <td>{c.name || '—'}</td>
                  <td>{c.tags || '—'}</td>
                  <td><button className="danger" onClick={() => del(c.id)}>Borrar</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > limit && (
          <div className="row" style={{ padding: 12, justifyContent: 'center' }}>
            <button className="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Anterior</button>
            <span className="muted">{offset + 1}–{Math.min(offset + limit, total)} de {total}</span>
            <button className="ghost" disabled={offset + limit >= total} onClick={() => setOffset(offset + limit)}>Siguiente</button>
          </div>
        )}
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
