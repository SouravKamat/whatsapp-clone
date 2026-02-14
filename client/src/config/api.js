// Central API config used across the frontend
const API_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || (API_URL.replace(/\/api\/?$/, ''))

export { API_URL, SOCKET_URL }
