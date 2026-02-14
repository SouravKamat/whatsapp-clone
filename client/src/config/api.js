// Central API config - use VITE_BACKEND_URL (e.g. https://your-backend.onrender.com)
const BASE = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '')
const API_URL = BASE + (BASE.endsWith('/api') ? '' : '/api')
const SOCKET_URL = BASE.replace(/\/api\/?$/, '')

export { API_URL, SOCKET_URL }
