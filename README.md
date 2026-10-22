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
   provider. Without these, the app runs in **demo mode** for notifications (see §8).

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

:: 4. (Optional) Seed demo data into an EMPTY development database - creates one user per role
::    and sample records. First set SEED_ADMIN_PASSWORD in backend\.env to your own password
::    (12+ characters). The script refuses to run in production, with the placeholder password,
::    or against a database that already has users.
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

- If you ran the seed script, log in as `admin@hrwarehouse.com` (or your `SEED_ADMIN_EMAIL`) with the
  `SEED_ADMIN_PASSWORD` you set. The other role accounts get random passwords that the seed script
  prints **once** - save them from its output.
- If you did **not** seed, go to **http://localhost:5173/setup** to create the first Admin account
  (the API only allows this once - when the `users` collection is empty). Locally (`NODE_ENV=development`)
  no setup token is needed unless you set `SETUP_TOKEN`.

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
  See §11 for the actual results observed while building this project.

> **First run is slow:** the first `npm test` on a machine downloads the `mongod` binary (about 57 MB)
> into `%USERPROFILE%\.cache\mongodb-binaries`, which can take a few minutes and may make the two
> integration suites time out on that run. Once the download finishes it is cached, and later runs take
> only seconds. **Do not start two test runs at the same time:** the download is guarded by a lock file,
> so a second run just waits on the first and times out. If a run seems stuck, close any other running
> `npm test` / `jest` processes and try again.

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
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASS` / `EMAIL_FROM` | Optional | SMTP email provider. Without these, notifications run in demo mode (see §8). |
| `WHATSAPP_API_URL` / `WHATSAPP_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` | Optional | WhatsApp Business API provider. Without these, notifications run in demo mode. |
| `SETUP_TOKEN` | **Yes in production** | Secret required by the `/setup` page to create the first Admin. Enforced whenever it is set; without it, first-Admin setup only works when `NODE_ENV` is `development` or `test`. Remove it once the first Admin exists. |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Optional | Used only by `npm run seed` (development only). The password must be your own, 12+ characters - the placeholder is refused - and is never printed. |

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

## 7. Sales Inquiry, Buyer Inquiry (manual-entry modules) & Inline Sticker Printing

### Sales Inquiry (`/sales-inquiries`)
A general sales lead. Captures contact/business info (name, company, phone, email, address, source),
manually entered product info (product name/description, an optional free-text Product ID, quantity,
expected price/budget, MRP, HR Mart Price), plus priority/status/follow-up/notes. This is intentionally
**independent of Inventory**: nothing is auto-populated from or overwritten by inventory data, and a
product does not need to exist anywhere else in the system first. `PUT /api/sales-inquiries/:id` only
touches fields present in the request body, so editing one field (e.g. status) never clears another
(e.g. a manually entered price). An explicit **Convert to Buyer** action creates a real `Buyer` record
from the inquiry's contact details - this never happens automatically.

### Buyer Inquiry (`/buyer-inquiries`)
The same manual-entry pattern for a potential buyer's interest in a product: buyer name, company,
phone, email, address, and manual product fields (name/description, Product ID, quantity, expected
buying price, MRP, HR Mart Price). Creating or editing one does **not** require picking an existing
Buyer or Inventory item - `buyer`/`item` are optional links, set only via the explicit **Convert to
Buyer** action (so no duplicate Buyer is ever created just because a name was typed into the form). A
running negotiation/offer history is kept alongside the primary manually entered price fields.

### Inline Sticker Printing (from Inventory - no separate page)
There is **no standalone Sticker Generator page or route**. Printing a sticker is an action on an
*existing* Inventory item only, available from both the Inventory list (a **Print Sticker** button on
every row) and the item detail page: both open the same `PrintStickerModal`.

- All sticker data (Product Name, Product ID, MRP, HR Mart Price, QR) is **read live from the item
  record** - nothing is typed into the sticker dialog itself. To change what's printed, edit the item.
- The QR code encodes the item's own **permanent, already-generated lookup URL**
  (`/inventory/<item id>`, the same one `qrService.js` stores in `item.qrCodeUrl` when the item is
  first created) - never random or session-only data. An item saved before QR generation existed gets
  one built locally on the fly, encoding that same URL pattern, so older items work too.
- If **MRP or HR Mart Price is missing**, printing is blocked with a clear message and an **Edit
  Pricing** action right there in the dialog - never a dash, `undefined`, `NaN`, or an invented ₹0. The
  on-screen preview itself shows "Not set" rather than hide or fake the missing value.
- Choose the number of copies, see a true-to-size preview, then print. Only the sticker(s) appear in
  the print output - sidebar, topbar, the dialog itself and all other page chrome are excluded.
- Prints at an **exact 80mm × 40mm** physical size, enforced by `Sticker.css`'s `@page { size: 80mm
  40mm; margin: 0; }` rule plus a `visibility: hidden` sweep of everything except the print content.
  Verified with a real headless-Chromium render (not just read from the CSS): every sticker measured
  exactly 302.36px × 151.17px (80mm × 40mm at 96dpi), and the on-screen preview, modal, sidebar and
  topbar were all confirmed `visibility: hidden` under print media emulation, leaving only the intended
  sticker copies visible.
- **Before printing on real label stock:** in the print dialog, set **Paper size** to your 80mm × 40mm
  label preset, turn off **"Fit to page" / "Scale to fit"** (scale must be 100%), and set margins to
  **None** - these settings live in the OS/browser print dialog and can't be forced from the page.

QR codes are still generated with the `qrcode` npm package (a real, scannable PNG - never a decorative
placeholder); `PrintStickerModal.jsx` and the shared `Sticker.jsx`/`Sticker.css` live under
`frontend/src/pages/inventory/` and `frontend/src/pages/stickers/` respectively.

### Inventory search by Owner
The Inventory list's search box also matches the item's **Owner/Customer name or business name**, in
addition to item name, SKU, item ID and serial number (`GET /api/items?search=`).

### Global quick search
The topbar search is a debounced, multi-entity search across Inventory, Customers/Owners and Buyers
(reusing each module's existing `?search=` endpoint - no new backend search service). Results are
grouped by type; selecting one opens that record's own existing detail page. Press Enter to jump to the
full Inventory list filtered by the typed term, as before.

### Customer / Owner Created Date
Every Customer/Owner record has an automatic, backend-assigned `createdAt` timestamp (Mongoose
`timestamps: true`) - never a client-entered date. It's shown in the Customers list ("Created" column)
and on the profile page, and `PUT /api/customers/:id` explicitly excludes `createdAt`, `customerId` and
`isActive` from what a request body can overwrite, so editing a customer can never shift its creation
date. The **Agreement Start/End Date** fields are a separate, genuine business field (the warehouse
rental agreement's validity period, alongside an Agreement Number and rate override) and were
deliberately left untouched - they are not a creation-date stand-in.

---

## 8. Notifications (Email / WhatsApp)

`backend/services/notificationService.js` implements a real send path for both channels, but only
when the relevant provider credentials are present in `backend/.env`. When they are not configured,
every notification call logs `[DEMO MODE]` to the server console and returns `{ demo: true, sent:
false }` - **the app never claims a message was actually delivered unless it was.** This applies to
item-received, sale-proposal, approval-decision, invoice-generated, payment-reminder,
dispatch-scheduled and delivery-confirmed events.

---

## 9. Cloud Deployment

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

### Creating the first Admin in production
The seed script is for development only and refuses to run when `NODE_ENV=production`. To create the
first Admin on a new production database:

1. On Render, set `SETUP_TOKEN` to a long random value (for example the output of
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) and redeploy.
2. Open `/setup` on the deployed frontend and enter the name, email, password and that setup token.
3. After the Admin account exists, remove `SETUP_TOKEN` from Render. Setup is closed permanently once
   any user exists; it can only succeed once, even if several requests arrive at the same time.

Without `SETUP_TOKEN`, `/setup` is disabled in production. If setup was interrupted before the Admin
account was created and stays locked, delete the `admin-bootstrap` document from the `counters`
collection and try again.

---

## 10. Troubleshooting

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
| Sticker print comes out larger/smaller than 80mm × 40mm, or on extra blank pages | Your print dialog has "Fit to page"/"Scale" turned on, or the wrong paper size selected. Set **Paper size** to a true 80mm × 40mm label, **Scale to 100%**, and margins to **None** (see §7). |
| Sales/Buyer Inquiry: a price I entered seems to have disappeared after editing | Shouldn't happen - `update`/`updateEnquiry` only change fields present in the request. If it does, check the browser console for a failed save (network error) before re-entering the value. |

---

## 11. Known Limitations / Not Yet Implemented

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
  path (see §8) was exercised, by design, since no provider credentials were supplied.
- **No automated end-to-end browser test** (e.g. Playwright/Cypress) was added to the test suite itself.
  That said, the inline sticker print output (exact 80mm × 40mm sizing and print-only isolation of the
  sidebar/topbar/modal/dialog chrome) **was** verified with a real headless-Chromium render against the
  actual `Sticker.css`/`Sticker.jsx`/`PrintStickerModal.jsx` - see §7 for the measured results.
- **Sales Inquiry / Buyer Inquiry / Customer createdAt / inventory owner-search database persistence**
  ("does a manually entered price, or an edited field, actually survive a save and page refresh?") could
  not be verified against a live MongoDB in the sandboxed sessions that built this project, because no
  test database or real Atlas credentials are reachable here (confirmed directly, not assumed -
  `mongodb-memory-server`'s binary download is blocked by this sandbox's network policy, and no `mongod`
  binary or Docker daemon is available either). What *was* verified instead, by running the actual
  shipped controller functions and real Mongoose schemas with only the DB socket stubbed: both inquiry
  schemas accept and validate fully manual documents with zero Item/Buyer references; both
  `express-validator` chains correctly accept valid manual payloads and reject missing required fields;
  the inquiry/customer/item `update*` controllers only ever touch fields present in the request body (so
  editing one field never clears another); `updateCustomer` specifically rejects an attempt to overwrite
  `createdAt`/`customerId`/`isActive` via the request body; and `listItems`'s owner-name search correctly
  resolves a matching Customer and adds it to the query filter. **You must confirm the actual
  save-and-reload behavior yourself** against your real MongoDB before relying on any of this in
  production - see §7's troubleshooting note if a value seems to disappear.
- **multer@1.x** is used for multipart uploads. The community `multer-storage-cloudinary` package only
  supports Cloudinary v1 as a peer dependency, which conflicts with the modern `cloudinary@^2` SDK used
  here, so a small custom storage engine (`backend/middleware/cloudinaryStorage.js`) streams uploads
  straight to Cloudinary v2 instead. multer 1.x itself carries known advisories versus 2.x; risk is
  mitigated here by the file-type/size validation in `backend/middleware/upload.js`. Consider migrating
  to `multer@2` (with a matching custom storage engine) when convenient.
- Business rules in §5 are **safe, documented defaults** - they should be reviewed and confirmed
  against the real contract with HR Warehouse before go-live.
