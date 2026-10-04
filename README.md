# QubWatch

## AI-Powered Business Monitoring and Investigation Platform

**QubWatch — Giving you smarter eyes.**

QubWatch is a business monitoring and investigation platform for business owners and authorized managers. It helps them identify unusual business activity, review operational patterns, and investigate transactions and events.

It is designed especially for inventory-based, high-transaction businesses such as supermarkets, retail shops, and pharmacies, where owners and managers may not always be available to supervise daily operations.

QubWatch gives authorized business users greater visibility into recorded business activity and helps them focus on activity that may need review.

### Core principle

QubWatch identifies activities that **require attention**. It does not automatically accuse staff of theft, fraud, or wrongdoing.

> **Signals for review. Not proof of wrongdoing.**

Alerts are based on configured monitoring rules and available business records. An authorized business user reviews the information, investigates when necessary, and makes the final decision.

## The problem

Many business owners rely on employees and managers to handle sales, inventory, cash, products, and daily transactions. When the owner is away or unable to supervise operations, unusual activities or losses may be difficult to notice quickly.

Examples include:

- Unexpected or unusually large transactions
- Unauthorized or unusually large discounts
- Repeated refunds
- Inventory discrepancies
- Unusual transaction patterns or frequency
- Unexpected changes in business records

Traditional business records can show **what happened** without clearly highlighting **what deserves attention**. QubWatch evaluates recorded activity against configured monitoring rules and brings potentially unusual patterns to authorized users' attention.

## The goal

QubWatch helps authorized business users to:

1. Monitor business activities and transactions.
2. Identify unusual patterns that may require review.
3. Receive alerts based on configured monitoring rules.
4. Review related transactions and business records.
5. Investigate alerts and document findings.
6. Use AI to analyze available, authorized business information.
7. Make better-informed decisions based on the available evidence.

## Core product areas

| Area | Description |
| --- | --- |
| Login | Authentication for authorized users. |
| Business Setup | Configure the business profile and manage authorized users. |
| Dashboard | Overview of business activity, transactions, products, alerts, and investigations. |
| Products | Create and manage product records and inventory information. |
| Transactions | Record and review business transactions and related details. |
| Monitoring Rules | Configure thresholds used to identify activity that may require attention. |
| Alerts | Flag activity such as large transactions, repeated refunds, excessive discounts, and unusual transaction frequency. |
| Investigation | Review alerts and related records; document notes, findings, and resolutions. |
| AI Assistant | Server-side Groq AI integration for questions about authorized QubWatch records. Responses support human review and do not replace it. |
| Audit | Record important system and business actions for accountability and review. |

## Monitoring and alerts

The MVP uses rule-based monitoring for activities such as:

- Large transactions
- Repeated refunds
- Excessive discounts
- Unusual transaction frequency

These rules generate alerts when recorded activity meets configured conditions. An alert is **not a conclusion of wrongdoing**; it gives an authorized user something specific to review.

## Investigation

When an alert needs further review, an authorized user can examine relevant business records and document:

- Related transactions
- Investigation notes
- Findings
- Resolution

This creates a structured record of how an alert was reviewed and resolved.

## AI Assistant

The QubWatch AI Assistant provides a natural-language way to ask questions about available business information. Examples include:

- “Why was this transaction flagged?”
- “What unusual transactions should I review?”
- “Show me the transactions related to this alert.”
- “What patterns can be seen in these records?”

The server-side Groq integration uses authorized QubWatch records supplied by the application. The assistant helps with investigation and analysis; it does not make accusations or final business decisions.

> **AI assists the investigation; humans make the final decision.**

## Paystack assessment demonstration

QubWatch includes a **Paystack Test Mode** subscription/payment demonstration for the assessment. It is available to the Business Owner and verifies payment server-side. It demonstrates a QubWatch subscription only; it does **not** process supermarket or other customer payments and is **not production payment processing**. Test Mode is intended for demonstration, not real-money transactions.

## User flow

**Login → Business Setup → Dashboard → Products → Transactions → Monitoring → Alerts → Investigation → AI Assistant → Findings → Resolution**

## Roles and access

QubWatch uses role-based access control so users receive access according to their responsibilities. The MVP includes:

- **Business Owner**
- **Authorized Manager**
- **Staff User**
- **Administrator**

The initial product focus is on business owners and authorized managers who need visibility into business activity. Access is role-based for supported backend routes; permissions vary by role and feature.

## Target users

QubWatch is initially designed for:

- Owners of supermarkets and supermarts
- Retail business owners
- Pharmacy owners
- Authorized business and operations managers
- Other authorized users responsible for monitoring inventory-based, high-transaction businesses

## Technology

- **Frontend:** React 19, JavaScript, and Vite
- **Backend:** Node.js and Express
- **Database:** SQLite via `better-sqlite3` for local development by default; PostgreSQL with `pg` via local `DATABASE_URL` or Netlify's managed `NETLIFY_DB_URL`
- **Authentication:** Server-side sessions with HttpOnly cookies and scrypt password hashing
- **AI integration:** Groq API called by the server
- **Payment demonstration:** Paystack Test Mode; owner-only and server-verified
- **PWA:** `vite-plugin-pwa`
- **Styling:** CSS

## Security and Data Protection

### Authentication and sessions

Passwords are stored as salted scrypt hashes rather than plaintext. Sessions use random tokens, while only hashed session tokens are stored server-side. Sessions expire after 12 hours. Session cookies use `HttpOnly` and `SameSite=Lax`; production sessions use the `Secure` cookie attribute. Passwordless demo login requires explicit local/demo configuration and is blocked when the server runs with `NODE_ENV=production`.

### Authorization

Important backend routes enforce authentication and role-based authorization. QubWatch has four application roles: **Business Owner**, **Authorized Manager**, **Staff User**, and **Administrator**. Permissions vary by route and feature; this is not a claim of a complete enterprise RBAC system.

- **Business Owner:** Broadest business-management access.
- **Authorized Manager:** Operational access; cannot promote users to privileged Business Owner or Administrator roles.
- **Staff User:** Limited access and can record transactions for their own account.
- **Administrator:** Administrative/read access where implemented.

### AI and Your Data

When the QubWatch AI Assistant is used, selected authorized QubWatch records may be sent to Groq to generate an AI-assisted response. Depending on the question and context, this may include business, transaction, product, staff-related transaction, alert, and investigation information.

The AI Assistant supports investigation and analysis. Its output is not proof of wrongdoing and does not make the final business decision. AI processing is not entirely local, and QubWatch does not claim independent fact-checking of AI output. The AI integration has no tool or write path that directly modifies QubWatch records.

### Secrets and API Credentials

Groq and Paystack secret credentials are configured as server-side environment variables and are not intended to be exposed in frontend code. `.env` is excluded from Git. Never commit secret keys, passwords, session tokens, or private certificates.

### Database Security

SQLite is used locally when `DATABASE_URL` is not configured. Local PostgreSQL uses `DATABASE_URL`. On Netlify, the API prefers the managed database connection in `NETLIFY_DB_URL` and uses `DATABASE_URL` only if the managed variable is unavailable; it refuses to fall back to SQLite there. The connection string is read only by the server-side database layer. PostgreSQL migrations 004, 005, and 006 create the schema and preserve the assessment demo seed records. PostgreSQL migration startup is serialized with an advisory lock.

### Netlify assessment deployment

The Netlify build publishes `dist`, deploys the existing Express API through the ESM entry point `netlify/functions/api.mjs`, and rewrites `/api/*` requests to that function while retaining the React single-page-app fallback. The Function imports the same Express app and routes used by `npm run dev:api`; local Vite development continues to proxy `/api` to `localhost:3001`. Netlify provides `NETLIFY_DB_URL` for the managed PostgreSQL database, so no database connection string belongs in frontend configuration or source control.

### Production Security Considerations

QubWatch is assessment/demo oriented and is not presented as a fully hardened multi-tenant SaaS platform. Its current data model is designed around a single-business/demo context and does not provide complete isolation for unrelated businesses sharing one database.

The audit trail is not claimed to be complete, immutable, or tamper-evident. Some PostgreSQL audit writes are not transactionally coupled to the related business operation. This MVP does not establish encryption-at-rest, backup or disaster-recovery guarantees, penetration testing, or regulatory compliance.

For a future public production deployment, configure secure environment-variable and secret management, HTTPS, validated PostgreSQL TLS, and appropriate operational controls. These production considerations do not change the intended Qubators assessment/demo scope.

## Run locally

Install dependencies:

```sh
npm install
```

Start the API server in one terminal:

```sh
npm run dev:api
```

Start the frontend in a second terminal:

```sh
npm run dev
```

Create a production frontend build:

```sh
npm run build
```

## Local demo mode (local only — never production)

For local demonstration runs, the app can open directly to the dashboard using the existing Business Owner demo session. Both local-only flags are required:

1. Create a local `.env.local` file (ignored by Git) containing:

   ```text
   VITE_QUBWATCH_DEMO=1
   ```

2. Start the API server with the demo flag:

   ```powershell
   $env:QUBWATCH_DEMO_LOGIN = '1'; npm run dev:api
   ```

3. Start the frontend in another terminal:

   ```sh
   npm run dev
   ```

Then open `https://localhost:5173/`. Do not enable the demo login in production or commit local environment files or credentials.

## Project structure

```text
src/
  App.jsx                 Main application flow and screens
  api/client.js           Frontend API client
  components/             Reusable interface components
  pages/                  Application pages

server/
  index.js                Express API server
  auth.js                 Authentication and authorization
  db.js                   Database connection and migrations
  routes/                 Backend API routes
  migrations/             Database schema migrations

docs/
  PRD.md                  Product requirements and implementation notes
```

## Product philosophy

QubWatch highlights activity that may deserve attention, provides information for investigation, and keeps the final judgment with the authorized human user.
