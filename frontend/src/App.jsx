import { Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Login from './pages/Login.jsx'
import Contacts from './pages/Contacts.jsx'
import ContactsUpload from './pages/ContactsUpload.jsx'
import CampaignNew from './pages/CampaignNew.jsx'
import Campaigns from './pages/Campaigns.jsx'
import CampaignDetail from './pages/CampaignDetail.jsx'
import Stats from './pages/Stats.jsx'

function TopBar() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  if (!user) return null
  return (
    <div className="topbar">
      <h1>WhatsApp Broadcaster</h1>
      <nav>
        <NavLink to="/campaigns">Campañas</NavLink>
        <NavLink to="/campaigns/new">Nueva campaña</NavLink>
        <NavLink to="/contacts">Contactos</NavLink>
        <NavLink to="/contacts/upload">Subir CSV</NavLink>
        <NavLink to="/stats">Stats</NavLink>
      </nav>
      <div className="spacer" />
      <span className="user">{user.email}</span>
      <button onClick={() => { logout(); nav('/login') }}>Salir</button>
    </div>
  )
}

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loader">Cargando…</div>
  if (!user) return <Navigate to="/login" replace />
  return (
    <div className="app">
      <TopBar />
      <div className="content">{children}</div>
    </div>
  )
}

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="loader">Cargando…</div>
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/campaigns" replace /> : <Login />} />
      <Route path="/campaigns" element={<Protected><Campaigns /></Protected>} />
      <Route path="/campaigns/new" element={<Protected><CampaignNew /></Protected>} />
      <Route path="/campaigns/:id" element={<Protected><CampaignDetail /></Protected>} />
      <Route path="/contacts" element={<Protected><Contacts /></Protected>} />
      <Route path="/contacts/upload" element={<Protected><ContactsUpload /></Protected>} />
      <Route path="/stats" element={<Protected><Stats /></Protected>} />
      <Route path="*" element={<Navigate to={user ? "/campaigns" : "/login"} replace />} />
    </Routes>
  )
}
