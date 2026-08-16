# Ganpati Mandal Digital Donation & Receipt Management System

A complete, production-quality, secure, and PWA-ready web application designed for Ganpati Mandals to digitize their donation (Vargani) collection. This platform replaces traditional paper-based receipt books, preventing duplicate serial numbering, calculation mistakes, and lack of transparency.

---

## Key Features

1. **Mobile-First PWA Design**: Optimized for touch inputs on iPhone Safari and Android Chrome, featuring large touch targets, minimal typing, dynamic safe-area safe-zone adjustments (notch displays), and installable app capabilities via Service Worker cache configurations.
2. **Atomic Sequential Receipt Numbering**: Uses transactional database locking to ensure distinct sequential receipt numbers (e.g., `SR-001`, `SR-002`) are allocated per colony/line per year, even when multiple workers submit entries concurrently.
3. **Role-Based Access Control (RBAC)**:
   - **Mandal President / Admin**: Full dashboard statistics, worker approvals/disabling, area creations, settlements confirmation, report exporting (CSV/Excel), and read-only audit log visibility.
   - **Worker / Collection Agent**: Quick-action buttons to generate receipts (caching colony and building values for rapid door-to-door typing speeds), view history, search, and mark pending receipts as paid.
4. **Pending Receipt System**: Allows Worker A to search and collect payments for pending receipts originally issued by Worker B, separately logging creators and collectors.
5. **Immutable Audit Trail**: Logs every financial action, cancellation reason, settings change, and admin operation. Receipts can only be **CANCELLED** with a required reason, never deleted.
6. **Cash Handover Settlements**: Reconciles collected cash against worker expected totals, logging differences and admin verifications.
7. **PWA Offline App Shell**: Caches layout pages to load instantly on poor mobile connections and alerts workers when offline.
8. **Digital Receipt with QR Verification**: Standardized receipt design with verification checkmarks, masked donor mobiles, and dynamic QR Codes that open secure verification links.
9. **Mandal Configuration & Year Lock**: Admins can customize Mandal details (name, contact, address, logo, terms) and lock historical years to prevent editing.

---

## Directory Architecture

```
ganpati-mandal-receipt-system/
├── backend/
│   ├── db/
│   │   ├── index.js          # SQLite native connector (node:sqlite DatabaseSync)
│   │   ├── schema.sql        # Database tables, constraints, and indexes
│   │   └── seed.js           # Testing seeder script (Admin, workers, receipts)
│   ├── services/
│   │   ├── authService.js    # Bcrypt PIN hashing and JWT session tokens
│   │   ├── auditService.js   # Auditing logs writer
│   │   ├── receiptService.js # Transactional atomic receipt creators
│   │   ├── qrService.js      # Base64 QR code generator
│   │   └── notificationService.js # Simulated SMS & WhatsApp link triggers
│   ├── tests/
│   │   └── verify.js         # Concurrent load runner test
│   ├── server.js             # Express API router & production frontend static host
│   └── package.json
├── frontend/
│   ├── public/
│   │   ├── manifest.json     # PWA manifest
│   │   └── sw.js             # PWA service worker app shell cache
│   ├── src/
│   │   ├── assets/           # React logo assets
│   │   ├── components/       # Layout structures
│   │   ├── pages/
│   │   │   ├── AdminPages.jsx # Dashboard, Workers, Areas, Handovers, Reports
│   │   │   ├── WorkerPages.jsx # Dashboard, Creation, History, Settlements
│   │   │   └── PublicReceipt.jsx # Secure verification receipt lookup
│   │   ├── utils/
│   │   │   └── api.js        # API connector client (fetch with JWT headers)
│   │   ├── App.jsx           # Tab router, session checks, offline listener
│   │   ├── index.css         # Custom mobile CSS variables, layouts, and print queries
│   │   └── main.jsx          # React renderer & service worker registration
│   ├── index.html
│   └── package.json
├── package.json              # Root package.json running concurrent dev scripts
└── README.md
```

---

## Setup & Running Locally

Ensure you have **Node.js (v22.5.0+ or v24+)** installed. The project uses Node's native built-in `node:sqlite` module, so **no external database engine installation is required for local running**.

### 1. Install Dependencies
Run from the root directory to install dev tools (`concurrently`) and all backend/frontend packages:
```bash
npm run install:all
```

### 2. Seed Database
Create tables, indexes, default active festival years, admin accounts, workers, lines, and mock receipt history:
```bash
npm run seed
```

### 3. Run Development Servers
Start the Express API server (on port `5000`) and the Vite React dev server (on port `5173`) concurrently:
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser to load the app.

---

## Default Login Credentials (Demo/Mock Data)

### A. Mandal President (Admin)
- **Login Mobile / ID**: `9999999999`
- **PIN / Password**: `admin123`

### B. Worker / Collection Agent (Approved)
- **Login Mobile / ID**: `8888888888` (Worker A: Sanket Patil)
- **PIN / Password**: `worker123`

### C. Worker / Collection Agent (Pending Approval)
- **Login Mobile / ID**: `6666666666` (Worker C: Amol Gawde)
- **PIN / Password**: `worker123`

---

## Building for Production Deployment

To package and compile the application for production hosting (serving the entire app through a single node port):

1. **Build the frontend assets**:
   ```bash
   npm run build:frontend
   ```
   This compiles React files into `/frontend/dist`.

2. **Start the single unified server**:
   ```bash
   npm start
   ```
   The backend Express server will now host **both** the REST API and the static React PWA frontend on port **5000** ([http://localhost:5000](http://localhost:5000)).

---

## Automated Concurrency Testing

To verify the sequential numbering database lock:
```bash
npm run test:concurrency
```
This triggers 15 parallel receipt submissions for the same colony to verify that sequential numbers (e.g. `SR-006` through `SR-020`) allocate cleanly without duplicates.

---

## Deployment & Production Infrastructure

For production hosting (e.g. Render, Railway, Fly.io):
1. Use an environment variable file (`.env`) to override `JWT_SECRET` and `PORT`.
2. Configure **Persistent Volumes (Disks)** if deploying SQLite on ephemeral cloud containers, mapping the path to preserve `backend/database.sqlite`.
3. To switch the database driver to **PostgreSQL**, simply replace the database connector module `backend/db/index.js` with a `pg` client, as SQL syntax is written in standard ANSI SQL.
