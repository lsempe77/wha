const TOKEN_KEY = 'wa_token'
const USER_KEY = 'wa_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuth(token, user) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function api(path, { method = 'GET', body, headers = {}, isFormData = false } = {}) {
  const token = getToken()
  const h = { ...headers }
  if (token) h.Authorization = `Bearer ${token}`
  if (body && !isFormData) h['Content-Type'] = 'application/json'

  const res = await fetch(`/api${path}`, {
    method,
    headers: h,
    body: body && !isFormData ? JSON.stringify(body) : body,
  })
  const text = await res.text()
  const json = text ? JSON.parse(text) : null
  if (!res.ok) {
    const err = new Error(json?.error || `HTTP ${res.status}`)
    err.status = res.status
    err.data = json
    throw err
  }
  return json
}

export default api
