# QubWatch

## Business Monitoring and Investigation Application

**QubWatch — See what deserves your utmost attention.**

QubWatch is a business monitoring and investigation platform for small and medium-sized businesses, designed for business owners and their authorized managers. It helps them identify unusual business activities, review operational patterns and investigate transactions and events.

It is designed especially for inventory-based, high-transaction businesses such as supermarkets, retail shops and pharmacies where owners and managers may not always be available to supervise daily operations.

QubWatch gives authorized business users greater visibility into recorded business activities and helps them focus on activities that may need review.

### Core principle

QubWatch identifies activities that **require utmost attention**. It does not automatically accuse staff of theft, fraud or wrongdoing.

> **Signals for review. Not proof of wrongdoing.**

Alerts are based on configured monitoring rules and available business records. An authorized business user reviews the information, investigates when necessary and makes the final decision.

## The problem

Owners of high-transaction, inventory-based businesses cannot personally monitor every sale, refund, discount and stock movement throughout the day. Some rely on "their" managers and the reports they receive. Others operate without a dedicated manager or spend significant time away from their business premises.

Reports are important but a summary of recorded activity does not always make unusual transactions or recurring patterns easy to identify. Owners still need visibility into what deserves closer attention without manually checking every record, constantly contacting staff or investing in expensive monitoring systems that may be beyond the budget of a small and medium-sized business.

Examples include:

- Unexpected or unusually large transactions
- Unusual discount activity
- Repeated refunds
- Inventory discrepancies, such as when the recorded stock differs from the expected stock
- Unusual transaction patterns or frequency
- Unexpected changes in business records

QubWatch evaluates recorded activity against the monitoring rules configured by the business owner. It brings potentially unusual activity to authorized users' attention, helps explain alerts with AI and supports investigation while leaving the final decision to the responsible human.

## The goal

QubWatch gives small and medium-sized business owners and authorized managers better visibility into business activities and helps them identify unusual patterns that may otherwise go unnoticed.

The MVP demonstrates the complete monitoring and investigation journey, from business activity and alert generation through review, investigation, evidence gathering, findings and resolution. QubWatch highlights activities that deserve attention; an alert is a signal for review, not proof of wrongdoing.

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
| Dashboard | Overview of business activity, transactions, products, alerts and investigations. |
| Products | Create and manage product records and inventory information. |
| Transactions | Record and review business transactions. Sales reduce stock and refunds increase stock atomically; discounts do not move stock. |
| Monitoring Rules | Configure thresholds used to identify activity that may require attention. |
| Alerts | Flag activity such as large transactions, repeated refunds, excessive discounts and unusual transaction frequency. |
| Investigation | Review alerts and related records; document notes, findings and resolutions. |
| AI Assistant | Server-side Groq AI integration for questions about authorized QubWatch records. Responses support human review and do not replace it. |
| Audit | Record selected transaction, alert-status and investigation actions for accountability; audit coverage is incomplete. |

## Monitoring and alerts

The MVP uses rule-based monitoring for activities such as:

- Large transactions
- Repeated refunds
- Excessive discounts
- Unusual transaction frequency
- Inventory discrepancies

The Business Owner can configure the thresholds for large transactions, repeated refunds, discounts and transaction frequency. The inventory check is built in: QubWatch flags a difference between the stock recorded in the system and the stock expected. For example, if 50 loaves of bread are expected but the recorded stock is 48, QubWatch flags the difference for review. This does not automatically mean theft or wrongdoing. Inventory discrepancy detection itself is not configurable in Settings.

These checks generate alerts when the relevant conditions are met. An alert is **not a conclusion of wrongdoing**; it gives an authorized user something specific to review.

The first generation of a deterministic alert ID is saved as an immutable snapshot, including its reason, generation time, related record IDs, generation-time evidence and relevant rule values. Later Dashboard or Alerts reads do not create duplicates or rewrite the snapshot when product data or thresholds change. Alert statuses and investigation links remain attached to that stable ID.

The previous implementation stored alert statuses but not alert reasons or evidence. As a result, migration 008 cannot reconstruct exact snapshots for alerts that stopped matching the current rules before the migration; active alerts are snapshotted the next time they are evaluated.

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

The server-side Groq integration uses records scoped to the authenticated user's business, including alert and investigation context and the related transactions, products and users. Cross-business alert and investigation IDs are treated as not found. The assistant helps with investigation and analysis; it is read-only and does not make accusations or final business decisions. Selected records are sent to Groq, so AI processing is not entirely local.

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

The initial product focus is on business owners and authorized managers who need visibility into business activity. Access is role-based for supported backend routes; permissions vary by role and feature. Only the Business Owner can change configurable monitoring thresholds in Settings; Authorized Managers and Staff Users have read-only access to those settings. Inventory discrepancy detection is built in and is not configurable.

## Target users

QubWatch is initially designed for:

- Owners of supermarkets and supermarts
- Retail business owners
- Pharmacy owners
- Authorized business and operations managers
- Other authorized users responsible for monitoring inventory-based, high-transaction businesses

## Technology

- **Frontend:** React 19, JavaScript and Vite
- **Backend:** Node.js and Express
- **Database:** SQLite via `better-sqlite3` remains available for local development; production uses Supabase-hosted PostgreSQL via the Render backend's server-side `DATABASE_URL`. Database credentials are never placed in frontend configuration or source control.
- **Authentication:** Server-side sessions with HttpOnly cookies and scrypt password hashing
- **AI integration:** Groq API called by the server
- **Payment demonstration:** Paystack Test Mode; owner-only and server-verified
- **PWA:** `vite-plugin-pwa`
- **Styling:** CSS

## Android assessment APK

The assessment APK has been packaged and its core workflow has been reported as tested, including login, dashboard, transactions, owner-configured monitoring rules, alerts, investigations, backend/database connectivity and AI-assisted analysis. The Android package uses the QubWatch application UI and shared backend/API; the repository does not contain a separate native Android codebase. Remaining work is continued validation of the assessment build, not initial APK preparation. This assessment build demonstrates the working MVP and should not be confused with a fully hardened production mobile platform.

## Security and Data Protection

### Authentication and sessions

Passwords are stored as salted scrypt hashes rather than plaintext. Sessions use random tokens, while only hashed session tokens are stored server-side. Sessions expire after 12 hours. Session cookies use `HttpOnly` and `SameSite=Lax`; production sessions use the `Secure` cookie attribute. Passwordless demo login requires explicit local/demo configuration and is blocked when the server runs with `NODE_ENV=production`.

### Authorization

Important backend routes enforce authentication and role-based authorization. QubWatch has four application roles: **Business Owner**, **Authorized Manager**, **Staff User** and **Administrator**. Permissions vary by route and feature; this is not a claim of a complete enterprise RBAC system.

- **Business Owner:** Broadest business-management access.
- **Authorized Manager:** Operational access; cannot promote users to privileged Business Owner or Administrator roles.
- **Staff User:** Limited access and can record transactions for their own account.
- **Administrator:** Administrative/read access where implemented.

### AI and Your Data

When the QubWatch AI Assistant is used, selected authorized QubWatch records may be sent to Groq to generate an AI-assisted response. Depending on the question and context, this may include business, transaction, product, staff-related transaction, alert and investigation information.

The AI Assistant supports investigation and analysis. Its output is not proof of wrongdoing and does not make the final business decision. AI processing is not entirely local and QubWatch does not claim independent fact-checking of AI output. The AI integration has no tool or write path that directly modifies QubWatch records.

### Secrets and API Credentials

Groq and Paystack secret credentials are configured as server-side environment variables and are not intended to be exposed in frontend code. `.env` is excluded from Git. Never commit secret keys, passwords, session tokens or private certificates.

### Database Security

SQLite is used locally when `DATABASE_URL` is not configured. PostgreSQL uses `DATABASE_URL`; production on Render uses Supabase-hosted PostgreSQL. The connection string is handled only by the server-side database layer. PostgreSQL migrations 004-008 create/evolve the schema and preserve the assessment demo seed records. Migration 008 adds historical alert snapshots in both supported database modes. PostgreSQL migration startup is serialized with an advisory lock.

### Production deployment

QubWatch's production application is deployed on Render: [https://qubwatch.onrender.com](https://qubwatch.onrender.com). The Render service serves the production frontend and Express API, while production PostgreSQL is hosted by Supabase. Local Vite development continues to use the local API setup and proxy `/api` to `localhost:3001`.


### Production Security Considerations

QubWatch remains assessment/demo oriented and is not presented as a production-ready, fully hardened multi-tenant SaaS platform. Core business records used by AI, products, transactions, investigations, alerts and monitoring rules are scoped to the authenticated user's business. Monitoring rules are stored per business. Only the Business Owner can configure monitoring rules in Settings; Authorized Managers and Staff Users have read-only access and cannot change rule settings. The inventory-discrepancy rule is not configurable. This does not make the overall platform a fully hardened enterprise system.

Audit entries emitted for transaction creation, alert status changes and investigation operations are written in the same SQLite/PostgreSQL transaction as those operations. The audit trail is not complete, immutable or tamper-evident; other operations such as product and monitoring-rule changes do not currently create audit entries. This MVP does not establish encryption-at-rest, backup or disaster-recovery guarantees, penetration testing or regulatory compliance.

QubWatch is currently deployed on Render with Supabase-hosted PostgreSQL. Additional production hardening remains appropriate, including complete audit coverage, secure environment-variable and secret management, validated PostgreSQL TLS, backup and recovery procedures and appropriate operational controls. This remains an assessment/MVP product and should not be presented as a fully hardened multi-tenant SaaS.

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

## Demo data seeding (explicit — never automatic)

Server startup applies schema migrations only and never inserts demo records.
To prepare a demonstration database (Caring Supermart demo business, demo
users, sample products/transactions, default monitoring rules), run:

```sh
QUBWATCH_SEED_DEMO=1 npm run demo:seed
```

```powershell
$env:QUBWATCH_SEED_DEMO = '1'; npm run demo:seed
```

Target database: `DATABASE_URL` (PostgreSQL) when set, otherwise SQLite at
`DB_PATH` (default `data/qubwatch.sqlite`). The command prints its resolved
target before doing anything. It requires `QUBWATCH_SEED_DEMO=1`, refuses
`NODE_ENV=production` without `--production-confirmed`, is safe to rerun
(insert-only: existing rows are kept, nothing is deleted) and only ever
resets the passwords of the three documented demo accounts. There is no
destructive reset. Example against a disposable database:

```powershell
$env:QUBWATCH_SEED_DEMO = '1'; $env:DB_PATH = 'C:\temp\qubwatch-demo.sqlite'; npm run demo:seed
```

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

QubWatch highlights activities that deserve utmost attention, provides information for investigation and keeps the final judgment with the authorized human user.
