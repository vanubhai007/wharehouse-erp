# Setup Guide

## Prerequisites

- Node.js 18+ (tested with Node 22) and npm.
- A MongoDB Atlas cluster (free tier is enough) — only needed to run the
  backend; the frontend homepage works without it.

## 1. Frontend (client)

```bash
cd vanraj-portfolio/client
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

To build for production:

```bash
npm run build
npm run preview   # serve the production build locally
```

Optional: copy `client/.env.example` to `client/.env.local` and set
`VITE_API_URL` if your backend isn't running on the default
`http://localhost:5000/api`.

## 2. Backend (server)

```bash
cd vanraj-portfolio/server
npm install
cp .env.example .env
# edit .env: set MONGODB_URI, JWT_SECRET, ADMIN_SEED_EMAIL/PASSWORD
npm run seed:admin   # creates the first admin login
npm run dev
```

The API listens on `http://localhost:5000` by default, with:

- `GET  /api/health` — basic health check
- `POST /api/contact` — public, used by the Contact form
- `GET  /api/contact` — admin-only, lists submitted messages
- `POST /api/auth/login` — admin login, returns a JWT
- `GET  /api/auth/me` — admin-only, returns the logged-in admin

The admin **panel UI** (a protected dashboard page in the React app) is
intentionally not built yet — this milestone only ships the public
homepage. The API above is ready for it.

## 3. Adding your real content

- `client/src/data/siteConfig.js` — email, phone, LinkedIn, resume link.
- `client/src/data/projects.js` — GitHub/live links per project.
- `client/src/data/experience.js` — work history.
- `client/public/images/avatar-concept.png` — your avatar concept art
  (optional; see `docs/3d-avatar-roadmap.md`).

Every placeholder is marked `EDIT_ME` or left `null` — the UI shows a
"coming soon" / italic placeholder instead of a dead or fake link until
you fill these in.

## 4. Known limitations of this milestone

- The backend has not been run against a real MongoDB Atlas cluster in
  this environment (no credentials were provided) — it has been
  syntax-checked and its routes load correctly, but a live DB connection
  should be verified once you plug in your own `MONGODB_URI`.
- No automated test suite exists yet for either package.
- The admin dashboard UI, project detail pages, and GLB avatar swap are
  future milestones (see `docs/3d-avatar-roadmap.md`).
