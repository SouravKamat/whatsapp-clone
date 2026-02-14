// VITE_BACKEND_URL = https://whatsapp-backend-8cvc.onrender.com (no trailing slash)
const BACKEND = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '')
export const API_URL = `${BACKEND}/api`
export const SOCKET_URL = BACKEND
