# Deploy WhatsApp Clone

Two ways to deploy: **single server** (backend serves the built frontend) or **split** (frontend and backend on different hosts).

---

## Option 1: Single server (recommended)

One Node server serves both the API and the built React app. Good for **Railway**, **Render**, **Fly.io**, **DigitalOcean App Platform**.

### 1. Set up MongoDB

- Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
- Get the connection string (e.g. `mongodb+srv://user:pass@cluster.mongodb.net/whatsapp-clone`).

### 2. Build the frontend

```bash
npm run install-all
npm run build
```

This creates `client/dist`.

### 3. Set environment variables

On your host, set:

| Variable       | Example |
|----------------|---------|
| `NODE_ENV`     | `production` |
| `PORT`         | `5000` (or the port your host gives) |
| `MONGODB_URI`  | Your Atlas connection string |
| `FRONTEND_URL` | Your app URL, e.g. `https://your-app.railway.app` |

### 4. Run the server

```bash
NODE_ENV=production node server/index.js
```

Or set `NODE_ENV=production` in the host’s env and run:

```bash
npm start
```

The app will be at `https://your-app-url` (no separate frontend URL).

---

## Option 2: Split (frontend + backend on different hosts)

Frontend on **Vercel** or **Netlify**, backend on **Railway** or **Render**.

### Backend (e.g. Railway / Render)

1. Deploy only the **root** of the repo (where `server/` and `package.json` are).
2. Set **Start command**: `node server/index.js` (do **not** run `npm run build` here).
3. Set env vars:
   - `NODE_ENV=production`
   - `MONGODB_URI=<your Atlas URI>`
   - `FRONTEND_URL=https://your-frontend.vercel.app` (exact frontend URL, for CORS).

### Frontend (e.g. Vercel)

1. In the project root, set **Root Directory** to `client` (or deploy from inside `client/`).
2. **Build command**: `npm run build`
3. **Output directory**: `dist`
4. Add env var in Vercel (and rebuild):
   - `VITE_API_URL=https://your-backend.railway.app/api`
   - `VITE_SOCKET_URL=https://your-backend.railway.app`

Use the same backend URL for both (no `/api` for `VITE_SOCKET_URL`).

---

## Quick deploy: Railway (single server)

1. Push the repo to GitHub.
2. Go to [Railway](https://railway.app) → New Project → Deploy from GitHub.
3. Select this repo.
4. Add a **MongoDB** plugin (or use Atlas and add `MONGODB_URI`).
5. In project **Settings** → add:
   - `NODE_ENV` = `production`
   - `FRONTEND_URL` = `https://<your-app>.up.railway.app` (replace with your real URL).
6. **Settings** → **Build**:
   - Build command: `npm run install-all && npm run build`
   - Start command: `NODE_ENV=production node server/index.js`
   - Root directory: leave default (repo root).
7. Deploy. Open the generated URL; the app and API run from the same origin.

---

## Quick deploy: Render (single server)

1. Push to GitHub, then [Render](https://render.com) → New → Web Service.
2. Connect the repo.
3. **Build command**: `npm run install-all && npm run build`
4. **Start command**: `NODE_ENV=production node server/index.js`
5. Add env: `NODE_ENV=production`, `MONGODB_URI`, and `FRONTEND_URL=https://<your-service>.onrender.com`
6. Deploy.

---

## Notes

- **HTTPS**: Use HTTPS in production; set `FRONTEND_URL` and `VITE_*` URLs to `https://`.
- **WebRTC**: For calls across networks, a TURN server is required. The app includes Xirsys TURN; credentials expire periodically. To use your own:
  - Set `VITE_TURN_URL` (comma-separated URLs), `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` in Vercel.
  - Set `VITE_WEBRTC_DEBUG=true` to enable WebRTC logs in production.
- **Socket.IO**: Works with the single-server setup; for split deploy, ensure the backend URL is correct in `VITE_SOCKET_URL` and CORS is set via `FRONTEND_URL`.
