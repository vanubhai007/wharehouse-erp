# Vanraj.dev

Premium, futuristic, 3D-accented portfolio for **Vanraj — Full Stack
Developer**. Fixed dark palette (no theme switcher), built with React, Vite,
Three.js/React Three Fiber, GSAP, Node.js, Express and MongoDB.

This project lives inside the `wharehouse-erp` repository as a standalone
sub-project (`vanraj-portfolio/`) and does not touch the existing HR
Warehouse ERP app in `backend/` / `frontend/` at the repo root.

## Brand

| Token | Hex |
|---|---|
| Deep Black | `#111111` |
| Neon Yellow | `#EFFF00` |
| Electric Purple | `#8B5CF6` |
| Graphite | `#242424` |

Defined once in `client/src/styles/variables.css` as CSS custom properties.
There is intentionally **no theme switcher** and **no Tailwind/Bootstrap** —
all styling is plain CSS / CSS Modules.

## Structure

```
vanraj-portfolio/
├── client/     React + Vite frontend (JavaScript)
├── server/     Node.js + Express + MongoDB backend
├── docs/       Setup guide and 3D-avatar roadmap
└── README.md   You are here
```

```
client/src/
├── components/
│   ├── layout/       Navbar (incl. mobile menu), Footer
│   ├── sections/      Hero, About, Skills, Projects, Experience, Services, Contact
│   ├── three/         Procedural 3D avatar scene + fallbacks
│   └── common/        Reveal (GSAP scroll-in), LoadingScreen, SectionHeading, ErrorBoundary
├── context/           LanguageContext (EN/GU toggle)
├── data/               Editable content: projects, skills, experience, services, siteConfig, translations
├── hooks/              useReducedMotion, useWebGLSupport, useMediaQuery
├── pages/              Home, NotFound (React Router)
├── styles/             Global CSS + palette tokens
└── utils/              scrollTo, api (contact form fetch)
```

```
server/
├── config/db.js              Mongoose connection
├── models/                   Admin, Message
├── controllers/               auth, contact
├── routes/                    /api/auth, /api/contact
├── middleware/                 JWT auth guard, error handler
├── seed/createAdmin.js        Creates the first admin login from .env
└── server.js / app.js
```

## Quick start

See [`docs/setup.md`](docs/setup.md) for full instructions. Short version:

```bash
# frontend
cd vanraj-portfolio/client && npm install && npm run dev

# backend (separate terminal, needs a MongoDB Atlas URI)
cd vanraj-portfolio/server && npm install && cp .env.example .env
npm run seed:admin && npm run dev
```

## What's implemented in this milestone

- Responsive homepage: Navbar + mobile menu, Hero, About, Skills, Projects,
  Experience, Services, Contact.
- Fixed black/neon-yellow/purple/graphite design, no theme switcher.
- Gujarati/English language toggle (`client/src/data/translations.js`).
- GSAP-powered scroll-reveal animations (`components/common/Reveal.jsx`),
  fully disabled under `prefers-reduced-motion`.
- App-level loading screen while initial assets settle.
- A **procedural** 3D avatar (React Three Fiber) in the Hero — not a rigged
  model. See [`docs/3d-avatar-roadmap.md`](docs/3d-avatar-roadmap.md) for how
  to swap in a real `.glb` later.
- Three-level visual fallback: 3D canvas → CSS gradient avatar if WebGL is
  unavailable or the canvas errors → reduced-motion freezes animation either
  way.
- Optional 2D avatar concept image slot at
  `client/public/images/avatar-concept.png` — shows a dashed placeholder
  (never a fabricated image) until you add the real file.
- The four real projects (HR Warehouse ERP, UVI Hotel Booking, UVI Groups
  Construction, UVI Shield Security) with editable, clearly-marked
  placeholder links in `client/src/data/projects.js`.
- A working contact form wired to a real `POST /api/contact` endpoint, plus
  a minimal admin-auth API (`/api/auth/login`, `/api/auth/me`) ready for a
  future admin dashboard — no secrets are hardcoded in the frontend.
- Accessibility basics: semantic landmarks, skip link, labeled form fields,
  `aria-live` status on the contact form, keyboard-reachable mobile menu.

## Not yet built (next milestones)

- Admin dashboard UI (the API is scaffolded; see `docs/setup.md`).
- Project detail pages / case studies.
- Real `.glb` avatar model (see `docs/3d-avatar-roadmap.md`).
- Automated tests.

## Editing content

All copy and links live in `client/src/data/`:

- `siteConfig.js` — email, phone, LinkedIn, resume.
- `projects.js` — per-project GitHub/live links.
- `experience.js`, `services.js`, `skills.js`.
- `translations.js` — every EN/GU string shown in the UI.

Values marked `EDIT_ME` or left `null` render as a visible "placeholder" /
"coming soon" state in the UI rather than a broken or fake link.
