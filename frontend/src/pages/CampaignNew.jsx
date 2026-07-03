import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api.js'
import Toast from '../components/Toast.jsx'

export default function CampaignNew() {
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [templateName, setTemplateName] = useState('hello_world')
  const [language, setLanguage] = useState('es')
  const [paramsText, setParamsText] = useState('') // comma-separated body params
  const [recipientMode, setRecipientMode] = useState('contacts') // 'contacts' | 'phones'
  const [contacts, setContacts] = useState([])
  const [selectedContacts, setSelectedContacts] = useState(new Set())
  const [phonesText, setPhonesText] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  useEffect(() => {
    api('/contacts?limit=500')
      .then((d) => setContacts(d.data))
      .catch((e) => setToast({ msg: e.message, type: 'error' }))
  }, [])

  function toggleContact(id) {
    setSelectedContacts((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function buildComponents() {
    const params = paramsText
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((t) => ({ type: 'text', text: t }))
    if (!params.length) return []
    return [{ type: 'body', parameters: params }]
  }

  function previewText() {
    const params = paramsText.split(',').map((p) => p.trim())
    // Heuristic: replace placeholders {{1}}, {{2}} with params
    let base = templateName === 'hello_world' ? 'Hello, {{1}}!' : `Plantilla: ${templateName}`
    params.forEach((p, i) => {
      base = base.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), p || `{{${i + 1}}}`)
    })
    return base
  }

  function defaultScheduled() {
    const d = new Date(Date.now() + 60 * 60 * 1000) // +1h
    d.setSeconds(0, 0)
    const tzOffset = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16)
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const components = buildComponents()
      const when = new Date(scheduledAt || defaultScheduled()).toISOString()
      const body = {
        name,
        templateName,
        templateLanguage: language,
        components,
        scheduledAt: when,
      }
      if (recipientMode === 'contacts') {
        body.contactIds = [...selectedContacts]
        if (!body.contactIds.length) throw new Error('Selecciona al menos un contacto')
      } else {
        body.phones = phonesText.split(/[\s,]+/).map((p) => p.trim()).filter(Boolean)
        if (!body.phones.length) throw new Error('Pega al menos un teléfono')
      }
      const res = await api('/campaigns', { method: 'POST', body })
      setToast({ msg: 'Campaña creada' })
      setTimeout(() => nav(`/campaigns/${res.id}`), 800)
    } catch (err) {
      setToast({ msg: err.message, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <form onSubmit={submit}>
        <div className="card">
          <h2>Nueva campaña</h2>
          <div className="form-group">
            <label>Nombre de la campaña</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej: Promo viernes" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Template (nombre aprobado en Meta)</label>
              <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Idioma</label>
              <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="es">Español (es)</option>
                <option value="en">English (en)</option>
                <option value="pt">Português (pt)</option>
                <option value="en_US">en_US</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Parámetros del cuerpo (separados por coma)</label>
            <input
              value={paramsText}
              onChange={(e) => setParamsText(e.target.value)}
              placeholder="María, 15%, https://ejemplo.com"
            />
            <p className="muted">Se mapean a {'{{1}}'}, {'{{2}}'}, … en orden. Deja vacío si el template no tiene variables.</p>
          </div>
        </div>

        <div className="card">
          <h2>Vista previa</h2>
          <div className="preview">
            <div className="bubble">{previewText()}</div>
            <div className="meta">{new Date().toLocaleTimeString()} ✓✓</div>
          </div>
        </div>

        <div className="card">
          <h2>Destinatarios</h2>
          <div className="row" style={{ marginBottom: 16 }}>
            <button type="button" className={recipientMode === 'contacts' ? 'primary' : 'secondary'} onClick={() => setRecipientMode('contacts')}>
              Seleccionar contactos
            </button>
            <button type="button" className={recipientMode === 'phones' ? 'primary' : 'secondary'} onClick={() => setRecipientMode('phones')}>
              Pegar teléfonos
            </button>
            {recipientMode === 'contacts' && selectedContacts.size > 0 && (
              <span className="muted">{selectedContacts.size} seleccionados</span>
            )}
          </div>

          {recipientMode === 'phones' ? (
            <div className="form-group">
              <label>Teléfonos (uno por línea o coma)</label>
              <textarea
                rows={5}
                value={phonesText}
                onChange={(e) => setPhonesText(e.target.value)}
                placeholder="34600000000, 34611111111"
              />
            </div>
          ) : (
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              {contacts.length === 0 ? (
                <div className="empty">No hay contactos. Sube un CSV primero.</div>
              ) : (
                <table>
                  <thead><tr><th></th><th>Teléfono</th><th>Nombre</th><th>Tags</th></tr></thead>
                  <tbody>
                    {contacts.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedContacts.has(c.id)}
                            onChange={() => toggleContact(c.id)}
                          />
                        </td>
                        <td>{c.phone}</td>
                        <td>{c.name || '—'}</td>
                        <td>{c.tags || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        <div className="card">
          <h2>Programación</h2>
          <div className="form-group">
            <label>Enviar el (fecha y hora local)</label>
            <input
              type="datetime-local"
              value={scheduledAt || defaultScheduled()}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
            <p className="muted">Déjalo en el futuro para programar, o en el pasado para enviar cuanto antes.</p>
          </div>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Creando…' : 'Crear campaña'}
          </button>
        </div>
      </form>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
