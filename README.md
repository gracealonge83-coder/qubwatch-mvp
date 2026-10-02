# QubWatch Version 1

**QubWatch — Giving you smarter eyes.**

QubWatch is a business monitoring and investigation application for business owners and authorized managers of inventory-based, high-transaction businesses. It monitors business activities, identifies unusual patterns using defined rules and presents relevant information for human review.

## Current implementation

The prototype currently includes:

- Responsive React interface built with Vite and JavaScript
- Express backend API
- PostgreSQL database using `pg`
- Persistent business, user, product, transaction, alert, investigation, and audit data
- Login sessions using HttpOnly cookies
- Four roles: Business Owner, Authorized Manager, Staff User, Administrator
- Server-enforced role permissions
- Rule-based monitoring and alert generation
- Investigation notes, findings, resolutions, and audit information
- AI Assistant demonstration responses
- Loading, empty, success and error UI states for backend-connected operations
- Installable PWA support and responsive mobile web experience

The initial MVP deliberately uses rule-based monitoring rather than advanced machine-learning anomaly detection. QubWatch identifies unusual activity for review; it does not automatically conclude that wrongdoing has occurred.

## Technology

- **Frontend:** React 19 + JavaScript + Vite
- **Backend:** Node.js + Express
- **Database:** PostgreSQL + `pg`
- **PWA:** vite-plugin-pwa
- **Styling:** CSS
- **Authentication:** server-side sessions with HttpOnly cookies and scrypt password hashing

## Project structure

```text
src/
  App.jsx                 Main application flow and screens
  api/client.js           Frontend API client
  components/             Reusable interface components
  storage/                Client-side/offline support

server/
  index.js                Express API server
  auth.js                 Authentication and authorization
  db.js                   Dual-database connection (PostgreSQL primary, SQLite fallback) and migrations
  routes/                 Backend API routes
  migrations/             Database schema migrations

docs/
  PRD.md                  Product requirements and implementation notes

design.html               Standalone prototype/design preview for design review
```

## Run locally

Install dependencies:

```sh
npm install
```

Run the frontend:

```sh
npm run dev
```

Run the API server in a second terminal:

```sh
npm run dev:api
```

Create a production frontend build:

```sh
npm run build
```

## Local demo mode (LOCAL ONLY — never production)

For local demonstration runs, the actual QubWatch dashboard can open
directly without typing a login, while keeping the full authentication
system intact. Both flags below are required at the same time:

1. Create a local-only frontend flag file named `.env.local` (already
   ignored by `.gitignore`, never commit it) containing:

```text
VITE_QUBWATCH_DEMO=1
```

2. Start the API server with the local-only backend flag:

```sh
QUBWATCH_DEMO_LOGIN=1 npm run dev:api
```

(PowerShell: `$env:QUBWATCH_DEMO_LOGIN = '1'; npm run dev:api`)

3. Start the frontend and open it:

```sh
npm run dev
```

Then opening `https://localhost:5173/` loads the dashboard directly as the
seeded Business Owner through the existing HttpOnly session mechanism and
the existing API. Login, logout, role permissions, and protected routes all
behave normally; after a manual logout the Login page shows until the next
reload. Without both flags, the application behaves exactly as production:
unauthenticated visitors see the Login page and `POST /api/auth/demo`
returns 404.

Do not set `QUBWATCH_DEMO_LOGIN` in any production environment and do not
commit `.env.local` or any credentials to the repository.

## Prototype preview

The repository contains a self-contained `design.html` preview so the prototype can be rendered directly by an HTML preview service without requiring the React development server or external assets.

## Development stages

1. Product Foundation
2. Core Business Functions
3. Monitoring
4. Investigation
5. AI Assistant
6. Mobile Application
7. Testing and Demonstration

The current work is focused on full-stack data implementation, responsive/mobile verification, testing, and demonstration preparation.

## Safety and product principle

QubWatch identifies unusual business activity and presents relevant information to the authorized user for review. It supports human decision-making rather than making accusations or autonomous business decisions.

Do not commit real passwords, API keys, session tokens, database files, or other secrets to the public repository.
