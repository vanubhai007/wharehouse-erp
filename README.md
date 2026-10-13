# HR Warehouse ERP

A complete ERP web application for **HR Warehouse** covering Asset Management, Warehouse Storage,
Costing and Asset Resale Management.

- **Frontend:** React (Vite) + React Router + plain CSS + Axios + Recharts
- **Backend:** Node.js + Express + MongoDB (Mongoose) + JWT auth + role-based access control
- **File storage:** Cloudinary (images/documents - only URLs are stored in MongoDB)
- **PDF generation:** pdfkit (invoices, quotations, receipts, dispatch notes, inventory reports)
- **QR codes:** `qrcode` package, one per inventory item, uploaded to Cloudinary
- **Database name:** `hrwarehouse` (MongoDB Atlas)

---

## 1. Project Structure

```
/
├── backend/            Express API (models, controllers, routes, services, middleware, tests, seed)
├── frontend/            React (Vite) app
├── package.json         Root convenience scripts
└── .gitignore
```

See inline code comments in each module (`backend/controllers/`, `backend/services/`,
`backend/models/`) for details on individual business rules.

---

## 2. Quick Start on Windows (beginner-friendly)

### Prerequisites

1. **Git for Windows** - download from https://git-scm.com/download/win and install with default
   options.
2. **Node.js 18+** - download from https://nodejs.org (LTS version) and install. Verify both tools
   installed correctly by opening **Command Prompt** (press Start, type `cmd`, press Enter) and
   running:
   ```
   git --version
   node -v
   npm -v
   ```
   Each should print a version number, not an error.
3. **A MongoDB Atlas account** (free tier is enough) - https://www.mongodb.com/cloud/atlas/register
   - Create a free cluster.
   - Create a database user (username/password).
   - Under "Network Access", add your current IP (or `0.0.0.0/0` for easy local development).
   - Get the connection string ("Connect" → "Drivers") - it looks like:
     `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/?retryWrites=true&w=majority`
4. **A Cloudinary account** (free tier) - https://cloudinary.com/users/register/free
   - From the Dashboard, copy your **Cloud Name**, **API Key** and **API Secret**.
5. (Optional, can be skipped for local testing) An email SMTP account and a WhatsApp Business API
   provider. Without these, the app runs in **demo mode** for notifications (see §7).

### Step-by-step setup

Open **Command Prompt** (Start → type `cmd` → Enter). Choose a folder to work in, e.g. your Documents
folder, then get the code and install everything:

```bat
:: 0. Get the code (replace with your repo URL if different) and enter the project folder
cd %USERPROFILE%\Documents
git clone https://github.com/vanubhai007/wharehouse-erp.git
cd wharehouse-erp

:: 1. Install dependencies for both apps (this takes a few minutes the first time)
npm run install:all

:: 2. Configure the backend
cd backend
copy .env.example .env
:: Now open backend\.env in Notepad and fill in:
::   MONGO_URI        = your MongoDB Atlas connection string (database name hrwarehouse is added automatically)
::   JWT_SECRET        = any long random string
::   JWT_RESET_SECRET  = another long random string
::   CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET = from your Cloudinary dashboard
cd ..

:: 3. Configure the frontend
cd frontend
copy .env.example .env
:: Default VITE_API_URL=http://localhost:5000/api is correct for local development.
cd ..

:: 4. (Optional) Seed demo data - creates one user per role and sample records
npm run seed
```

Now start the two servers - **each needs its own Command Prompt window, left running**:

```bat
:: Terminal window 1 (stay in the project's root folder, e.g. wharehouse-erp)
npm run dev:backend
:: Wait for: "HR Warehouse ERP API listening on port 5000"
```

```bat
:: Terminal window 2 - open a NEW Command Prompt window, cd back into the same project folder first
cd %USERPROFILE%\Documents\wharehouse-erp
npm run dev:frontend
:: Wait for: "Local:   http://localhost:5173/"
```

Open **http://localhost:5173** in your browser. Leave both Command Prompt windows open while you use
the app; closing either one stops that server.

- If you ran the seed script, log in with `admin@hrwarehouse.com` / `ChangeMe123!` (see the seed script
  output for the other role logins).
- If you did **not** seed, go to **http://localhost:5173/setup** to create the first Admin account
  (the API only allows this once - when the `users` collection is empty).

### Running backend tests

```bat
cd backend
npm test
```

This runs two kinds of tests:
- **Pure unit/functional tests** (no database required, always run): rental pro-ration date-boundary
  math, item status-transition rules, real PDF generation for invoices/receipts/dispatch
  notes/inventory reports (asserts actual `%PDF` output), and the upload-guard behavior when Cloudinary
  isn't configured. 22 tests across 4 suites.
- **Integration tests** (auth flow, full sale→approval→invoice→dispatch lifecycle) - these spin up an
  in-memory MongoDB via `mongodb-memory-server`, which downloads a small `mongod` binary the first time
  it runs. This requires outbound internet access to `fastdl.mongodb.org`. If your network blocks that
  host, these two suites will fail to start with a clear message explaining why - it is not a code bug.
  See §10 for the actual results observed while building this project.

---

## 3. Required Environment Variables

### `backend/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | No (default 5000) | API port |
| `MONGO_URI` | **Yes** | MongoDB Atlas connection string. The app always connects to the `hrwarehouse` database regardless of what's in the URI path. |
| `JWT_SECRET` | **Yes** | Secret used to sign login tokens |
| `JWT_EXPIRES_IN` | No (default `1d`) | Login token lifetime |
| `JWT_RESET_SECRET` | **Yes** | Secret used to sign password-reset tokens |
| `JWT_RESET_EXPIRES_IN` | No (default `15m`) | Reset link lifetime |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Needed for uploads | Without these, every upload endpoint returns a clear "storage not configured" error instead of failing silently |
| `FRONTEND_URL` | **Yes** | Used for CORS and for building password-reset links. In production, set this to your deployed frontend URL. |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_FROM` | Optional | SMTP email provider. Without these, notifications run in demo mode (see §7). |
| `WHATSAPP_API_URL` / `WHATSAPP_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Optional | WhatsApp Business API provider. Without these, notifications run in demo mode. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Optional | Used only by `npm run seed` |

### `frontend/.env`

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | **Yes** | Base URL of the backend API, e.g. `http://localhost:5000/api` locally or `https://your-api.onrender.com/api` in production |

**Never commit real `.env` files.** Both are already covered by `.gitignore`.

---

## 4. Roles & Permissions

| Role | Typical access |
|---|---|
| Admin | Everything, including user management and Settings |
| Warehouse Manager | Inventory, warehouse locations, refurbishment approval, status corrections |
| Warehouse Staff | Inventory intake, status updates, refurbishment jobs |
| Accounts | Customers, expenses, invoices, payments, settlements |
| Sales/Buyer Manager | Buyers, sale proposals |
| Owner/Approver | Approve or reject sale proposals (only role, besides Admin, that can decide an approval) |

Every write endpoint on the backend is re-validated by role - the frontend only hides buttons the
user's role cannot use; it is never the only line of defense.

---

## 5. Business Rules That Are Configurable Defaults (confirm with the business)

The spec explicitly calls out several formulas that should not be invented. The following safe
defaults are implemented, are fully documented in code (`backend/config/constants.js`,
`backend/services/rentalService.js`, `backend/services/costService.js`,
`backend/controllers/settlementController.js`), and are all editable from the **Settings** page
(Admin only) without a code change:

1. **Rental pro-ration** - billed per day; a partial month is split over the *actual* number of days
   in that calendar month (28/29/30/31) unless a flat "days per month" override is set.
2. **Total Item Cost** = Base/Purchase Cost + Accumulated Rental + Refurbishment + Marketing +
   Logistics (inbound + outbound) + Commission + Other. Each component stays visible and separately
   reportable - nothing is collapsed into a lump sum.
3. **Default GST** = 18% (editable), applied per invoice line item, never doubled.
4. **Commission** = percentage (default 10%) or fixed amount, applied once to the final sale price;
   `Owner Payable = Sale Price − Commission`. One settlement per sale (enforced by a unique index), so
   it cannot be double-paid.
5. **Owner/Customer** are modeled as the same entity (the consignor who owns stored assets); "Buyer"
   is a separate entity (the purchaser). This matches how the spec uses the two terms interchangeably
   in the onboarding section while keeping buyers distinct in the sales section.

---

## 6. Core Workflows Implemented

- **Item lifecycle:** Handover Pending → Received → In Warehouse → (Under Refurbishment) → Available
  for Sale → Sale Proposed → Approval Pending → Approved → Sold → Dispatch Pending → Dispatched →
  Closed. Every transition is validated server-side against this map; Admin/Warehouse Manager may
  additionally correct one step backward. Every change is recorded with who/when in both the item's
  own history and the global, immutable audit log.
- **Owner approval gate:** a sale proposal cannot become an invoice, and a dispatch cannot be created,
  until an Owner/Approver (or Admin) has recorded an **Approved** decision. Only one pending decision
  may exist per request; a decided approval cannot be re-decided.
- **Invoice idempotency:** re-requesting an invoice for an already-invoiced proposal returns the
  existing invoice instead of creating a duplicate.
- **File uploads:** every upload goes straight to Cloudinary; MongoDB only ever stores the resulting
  URL + metadata, never a local file path.

---

## 7. Notifications (Email / WhatsApp)

`backend/services/notificationService.js` implements a real send path for both channels, but only
when the relevant provider credentials are present in `backend/.env`. When they are not configured,
every notification call logs `[DEMO MODE]` to the server console and returns `{ demo: true, sent:
false }` - **the app never claims a message was actually delivered unless it was.** This applies to
item-received, sale-proposal, approval-decision, invoice-generated, payment-reminder,
dispatch-scheduled and delivery-confirmed events.

---

## 8. Cloud Deployment

### MongoDB Atlas
Already covered in §2. Use the same connection string for the deployed backend's `MONGO_URI`.

### Cloudinary
Already covered in §2. Same credentials for local and deployed backend.

### Backend → Render
1. Push this repository to GitHub.
2. In Render, "New +" → "Web Service" → connect the repo, set **Root Directory** to `backend`.
3. Build command: `npm install`. Start command: `npm start`.
4. Add all the environment variables from §3 (`MONGO_URI`, `JWT_SECRET`, `JWT_RESET_SECRET`,
   `CLOUDINARY_*`, `FRONTEND_URL` set to your Vercel frontend URL, optional email/WhatsApp vars).
5. Render provides a health check path - use `/api/health`.
6. Deploy. Note the resulting URL, e.g. `https://hrwarehouse-api.onrender.com`.

### Frontend → Vercel
1. In Vercel, "Add New..." → "Project" → import the same repo, set **Root Directory** to `frontend`.
2. Framework preset: Vite. Build command: `npm run build`. Output directory: `dist`.
3. Add environment variable `VITE_API_URL` = `https://hrwarehouse-api.onrender.com/api` (your Render
   URL + `/api`).
4. Deploy. Note the resulting URL, e.g. `https://hrwarehouse.vercel.app`.
5. Go back to Render and update `FRONTEND_URL` to this Vercel URL, then redeploy the backend so CORS
   allows it.

### Seeding production data
Run the seed script once against the production database if you want starter data:
```
MONGO_URI="<your atlas uri>" SEED_ADMIN_EMAIL=you@company.com SEED_ADMIN_PASSWORD='StrongPass!23' node backend/seed/seed.js
```
Or simply use `/setup` on the deployed frontend to create the first Admin account.

---

## 9. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Backend fails to start: `MONGO_URI is not set` | Copy `backend/.env.example` to `backend/.env` and fill in `MONGO_URI`. |
| `401 Unauthorized` on every API call | Token missing/expired - log out and log back in. |
| File upload returns "storage not configured" | Set the three `CLOUDINARY_*` variables in `backend/.env`. |
| CORS error in the browser console | `FRONTEND_URL` in `backend/.env` doesn't match the URL you're browsing from. |
| "Cannot move item from X to Y" | The item lifecycle only allows specific forward transitions (see §6); Admin/Warehouse Manager can correct one step back. |
| "This sale proposal has not been approved" when generating an invoice | Expected - an Owner/Approver (or Admin) must approve the proposal first. |
| Password reset email never arrives | No email provider configured - the API runs in demo mode and returns the reset link directly in the response (`demoResetUrl`); the Forgot Password page displays it. |
| `npm test` fails only on the two integration suites with a MongoDB download error | Your network blocks `fastdl.mongodb.org`. Either allow that host once (the binary is then cached for future runs) or run the tests in CI/an environment with that access. The two pure-logic suites always run regardless. |

---

## 10. Known Limitations / Not Yet Implemented

Built honestly, not just claimed:

- **Live integration test run:** the two integration-test suites (`tests/auth.test.js`,
  `tests/salesLifecycle.test.js` - 9 tests covering login/role permissions, the full
  sale→approval→invoice→dispatch lifecycle, and duplicate-invoice prevention) could not be executed
  inside the sandboxed session this project was built in, because that session's network policy
  blocks `fastdl.mongodb.org`, the host `mongodb-memory-server` downloads its test database binary
  from. Actual output seen in that session:
  ```
  Test Suites: 2 failed, 4 passed, 6 total
  Tests:       9 failed, 22 passed, 31 total
  ```
  All 9 failures are the identical "Could not start the in-memory MongoDB test server" error, not a
  test assertion failure - the code inside those two suites was never reached. The other 4 suites (22
  tests: rental pro-ration date-boundary math, item status-transition rules, real PDF generation
  verified by checking actual `%PDF`/`%%EOF` bytes, and the no-Cloudinary upload guard) ran for real
  and passed. Run `npm test` in a normal environment or CI (or anywhere `fastdl.mongodb.org` is
  reachable) to execute the full suite including the two integration suites.
- **MongoDB Atlas connectivity, real file uploads to Cloudinary, and the full browser login/inventory
  UI flow were not exercised end-to-end** in the build session, because no real Atlas cluster or
  Cloudinary account credentials were available there and the sandbox's network policy prevented
  starting a local test database (above). What *was* verified in that session: the backend starts and
  serves `/api/health` correctly; every controller/route/model file loads without error; a production
  frontend build (`vite build`) compiles cleanly; the Vite dev server serves the app shell. Verify the
  rest yourself once you have your own Atlas + Cloudinary credentials, following §2 - this is normal
  for any new project and does not indicate a known bug.
- **Real WhatsApp/Email delivery** has not been exercised against a live provider - only the demo-mode
  path (see §7) was exercised, by design, since no provider credentials were supplied.
- **No automated end-to-end browser test** (e.g. Playwright/Cypress) was added.
- **multer@1.x** is used for multipart uploads. The community `multer-storage-cloudinary` package only
  supports Cloudinary v1 as a peer dependency, which conflicts with the modern `cloudinary@^2` SDK used
  here, so a small custom storage engine (`backend/middleware/cloudinaryStorage.js`) streams uploads
  straight to Cloudinary v2 instead. multer 1.x itself carries known advisories versus 2.x; risk is
  mitigated here by the file-type/size validation in `backend/middleware/upload.js`. Consider migrating
  to `multer@2` (with a matching custom storage engine) when convenient.
- Business rules in §5 are **safe, documented defaults** - they should be reviewed and confirmed
  against the real contract with HR Warehouse before go-live.
