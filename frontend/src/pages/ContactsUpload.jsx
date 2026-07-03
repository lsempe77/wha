import { useState, useRef } from 'react'
import api from '../api.js'
import Toast from '../components/Toast.jsx'

// Parses CSV text into contacts. Expects header row with: phone, name, tags
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) throw new Error('El CSV debe tener una cabecera y al menos una fila')
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
  const phoneIdx = headers.findIndex((h) => h === 'phone' || h === 'telefono' || h === 'tel')
  if (phoneIdx === -1) throw new Error('El CSV necesita una columna "phone"')
  const nameIdx = headers.findIndex((h) => h === 'name' || h === 'nombre')
  const tagsIdx = headers.findIndex((h) => h === 'tags')

  const contacts = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim())
    const phone = cols[phoneIdx]?.replace(/[^\d]/g, '')
    if (!phone || phone.length < 6) continue
    contacts.push({
      phone,
      name: nameIdx >= 0 ? cols[nameIdx] || undefined : undefined,
      tags: tagsIdx >= 0 ? cols[tagsIdx] || undefined : undefined,
    })
  }
  return contacts
}

export default function ContactsUpload() {
  const [preview, setPreview] = useState([])
  const [fileName, setFileName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef(null)

  function handleFile(file) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const contacts = parseCSV(reader.result)
        if (!contacts.length) throw new Error('No se encontraron teléfonos válidos')
        setPreview(contacts)
      } catch (err) {
        setToast({ msg: err.message, type: 'error' })
        setPreview([])
      }
    }
    reader.readAsText(file)
  }

  function onDrop(e) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  async function submit() {
    if (!preview.length) return
    setSubmitting(true)
    try {
      const res = await api('/contacts/bulk', { method: 'POST', body: { contacts: preview } })
      setToast({ msg: `${res.created} contactos guardados` })
      setPreview([])
      setFileName('')
    } catch (err) {
      setToast({ msg: err.message, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="card">
        <h2>Subir lista de contactos (CSV)</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Formato: CSV con cabecera. Columnas: <code>phone</code> (obligatorio), <code>name</code>, <code>tags</code>.
          Los teléfonos deben incluir código de país, solo dígitos (ej: 34600000000).
        </p>
        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <strong>{fileName || 'Arrastra aquí tu CSV o haz clic para seleccionar'}</strong>
          <p>Columnas: phone, name, tags</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </div>
      </div>

      {preview.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          <div className="row" style={{ padding: 16 }}>
            <h2 style={{ margin: 0 }}>Vista previa ({preview.length} contactos)</h2>
            <div className="spacer" />
            <button className="primary" disabled={submitting} onClick={submit}>
              {submitting ? 'Subiendo…' : 'Subir todos'}
            </button>
          </div>
          <table>
            <thead><tr><th>Teléfono</th><th>Nombre</th><th>Tags</th></tr></thead>
            <tbody>
              {preview.slice(0, 100).map((c, i) => (
                <tr key={i}><td>{c.phone}</td><td>{c.name || '—'}</td><td>{c.tags || '—'}</td></tr>
              ))}
            </tbody>
          </table>
          {preview.length > 100 && <p className="muted" style={{ padding: 12 }}>… y {preview.length - 100} más</p>}
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}
