# QubWatch MVP Product Requirements Document (PRD)

## 1. Product Name

**QubWatch**

### Tagline

**See what deserves your utmost attention.**

---

# 2. Product Overview

QubWatch is a business monitoring and investigation application designed for small and medium-sized business owners and authorized managers.

It helps business owners maintain visibility into important business activities when they cannot personally watch the business throughout the day.

QubWatch monitors business activity and identifies unusual patterns that may require attention.

Examples include:

* unusually large transactions
* repeated refunds
* unusual discount activity
* unusual transaction frequency
* inventory discrepancies

QubWatch presents these activities to authorized users for review and investigation.

An alert indicates that something may require attention. It does not automatically establish that fraud, theft, or wrongdoing has occurred.

---

# 3. Problem Statement

Many business owners cannot remain physically present in their businesses throughout the day.

When the owner is away, important activities can occur without the owner immediately knowing about them.

Examples include:

* unusually large sales
* repeated refunds
* excessive discounts
* unusual transaction patterns
* unexpected inventory changes

Without a simple monitoring system, it can be difficult for the owner to know what deserves attention.

QubWatch provides a central view of business activity and brings unusual activity to the user's attention.

---

# 4. Target Users

## 4.1 Business Owner

The primary QubWatch user.

The business owner can:

* set up the business
* manage products
* view transactions
* monitor business activity
* receive alerts
* review alerts
* investigate unusual activity
* record findings
* resolve investigations

## 4.2 Authorized Manager

A manager authorized by the business owner to monitor and manage business activities.

The Authorized Manager has role-based operational management permissions within the business, including management of Staff Users. The role does not include privileged Business Owner or Administrator control.

## 4.3 Staff User

A staff member who may record or be associated with business transactions.

Staff access is more limited than owner or manager access.

## 4.4 Administrator

The Administrator is a review/read-oriented role with access to permitted business information and AI assistance.

The Administrator does not have normal business-management write permissions, including permissions to manage teams, products, monitoring rules, or transaction status.

---

# 5. Product Goal

The goal of QubWatch is to give business owners and authorized managers better visibility into business activities and help them notice unusual activity that may otherwise be missed.

The MVP should demonstrate the complete monitoring and investigation journey from business activity to resolution.

---

# 6. Main User Journey

The primary QubWatch user journey is:

**Business Setup → Products → Transactions → Monitoring → Alert → Review → Investigation → Evidence → AI Assistance → Finding → Resolution**

The MVP should allow this journey to be demonstrated using realistic business data.

---

# 7. MVP Objectives

The MVP should allow a user to:

1. Set up a business.
2. Add and view products.
3. Record and view transactions.
4. Monitor business activity.
5. Identify unusual activity using defined rules.
6. Generate alerts.
7. Review alerts.
8. Start an investigation.
9. Examine related business information.
10. Add investigation notes.
11. Record an investigation finding.
12. Resolve an investigation.
13. Use the AI Assistant to help understand available information.

---

# 8. Platforms

QubWatch MVP should support:

### Responsive Web App

The web application should work properly on:

* Desktop
* Laptop
* Tablet
* Mobile phone browsers

The interface should adapt to different screen sizes.

The current implementation is a responsive web application and installable Progressive Web App (PWA), with mobile-responsive navigation and UI, using the QubWatch backend/API.

### Android and iOS

QubWatch is intended to be available on Android and iOS as well as the web. Android and iOS are deployment/package targets of the same QubWatch product and should use the shared application backend/API.

The existing responsive PWA provides the current web and mobile UI foundation. Android packaging, including the APK required for the current assessment, remains deployment work. iOS packaging and distribution are also product targets; no native Android or iOS implementation is currently present in the repository.

The Android and iOS experiences should provide access to the core QubWatch monitoring workflow, prioritizing:

* Dashboard
* Alerts
* Transactions
* Investigations
* Notifications
* AI Assistant

The product should maintain a consistent QubWatch experience across web and mobile.

---

# 9. MVP Scope

The MVP includes:

* Business setup
* User access and basic roles
* Team management (basic)
* Backend/database persistence of operational records: SQLite for local development when `DATABASE_URL` is not configured, and Supabase-hosted PostgreSQL in production through the Render backend's server-side `DATABASE_URL`
* Products
* Transactions
* Dashboard
* Business monitoring
* Rule-based alerts
* Configurable monitoring rules (basic)
* Alert review
* Investigations
* Investigation notes
* Findings
* Resolution
* Basic evidence view
* AI Assistant
* In-app notifications
* Basic search and filtering
* Basic activity/audit information
* Backend API with database persistence for business, team, operational, and audit records
* Basic user authentication (login sessions) using the existing four roles
* Server-enforced role permissions for sensitive actions
* Complete UI states (loading, empty, success, error) for backend-connected operations
* Server-side validation of all writes
* Responsive web interface and installable PWA with mobile-responsive navigation/UI
* Android and iOS deployment/package targets using the QubWatch product and shared backend/API

The PWA may cache application assets. QubWatch does not currently implement browser-local operational data storage as the system of record or operational-data offline synchronization.

---

# 10. MVP Features Not Included

The following are outside the first MVP:

* Advanced machine-learning anomaly detection
* Autonomous investigations
* Autonomous employee decisions
* Automated disciplinary actions
* Accounting integrations
* Payment gateway integrations
* POS integrations
* Advanced inventory integrations
* Advanced enterprise integrations
* Email notification system
* SMS notification system
* WhatsApp notification system
* Single Sign-On (SSO)
* Advanced Multi-Factor Authentication
* Advanced enterprise permission management
* Complex multi-company administration
* Advanced analytics and forecasting
* User deletion
* Active/inactive user status
* Password recovery
* Advanced permission administration beyond the MVP's server-enforced role checks

These features may be considered in later versions.

Assessment exception: the current assessment build includes a Paystack Test Mode subscription/payment demonstration solely to demonstrate a payment-gateway integration. It is not QubWatch's operational payment-processing functionality, does not process supermarket/customer payments, uses Test Mode only with no real-money transactions, and full payment integrations remain outside the normal MVP scope.

The demonstration is available only to the Business Owner in Settings. It offers a server-validated QubWatch monthly plan of ₦5,000 (50,000 kobo); plan and amount are defined by the server. The Paystack secret key must be configured as `PAYSTACK_SECRET_KEY` in the API server's private `.env` file using a Test Mode secret key (`sk_test_...`). Production deployments must set `APP_URL` to the exact HTTPS application origin for the Paystack return URL. Successful subscription status is recorded only after the server verifies the transaction with Paystack.

---

# 11. Main Navigation

The main QubWatch navigation should include:

1. Dashboard
2. Products
3. Transactions
4. Alerts
5. Investigations
6. AI Assistant
7. Settings

The mobile application should use an appropriate mobile navigation pattern while maintaining access to the same core areas.

---

# 12. Business Setup

The user should be able to create or configure a business profile.

Basic business information may include:

* Business name
* Business type
* Business location
* Owner
* Contact information
* Business operating hours

The MVP may initially use a simple business setup form.

The business profile remains editable through Settings after initial setup.
Saving updates the business information, and the saved business information is reflected on the Dashboard and header where applicable.
Business and operational records persist through the QubWatch backend/database. Local development can use SQLite when `DATABASE_URL` is not configured; production uses Supabase-hosted PostgreSQL through the Render backend's server-side `DATABASE_URL`. The PWA may cache application assets, but QubWatch does not currently implement browser-local operational data synchronization or offline database synchronization.

---

# 13. Dashboard

The Dashboard is the main monitoring screen.

It should provide a quick view of the current state of the business.

### Business information

Display:

* Business name
* Current date
* User name
* User role

### Key indicators

Examples include:

* Today's sales
* Today's refunds
* Today's discounts
* Open alerts
* Inventory issues

### Recent activity

Display recent business transactions and other relevant activity.

### Activity requiring attention

Display alerts that require review.

### Dashboard actions

The user should be able to select an alert and move directly to the relevant alert review screen.

---

# 14. Products

The Products section allows authorized users to manage and view business products.

A product may contain:

* Product ID
* Product name
* Category
* Selling price
* Cost price where applicable
* Current stock
* Expected stock
* Product status

The MVP should provide basic product creation, viewing, editing, and stock information.

---

# 15. Transactions

The Transactions section records business activity.

A transaction may contain:

* Transaction ID
* Date and time
* Transaction type
* Product
* Quantity
* Amount
* Staff/user
* Discount
* Payment status
* Transaction status

Transaction types may include:

* Sale
* Refund
* Discount

The MVP should allow authorized users to record transactions. A successful sale reduces the selected product's stock by the transaction quantity; a successful refund increases stock by that quantity. A discount does not change stock. The transaction and stock movement are atomic, and a sale that would make stock negative is rejected.

---

# 16. Transaction Monitoring

QubWatch should monitor transaction activity using defined rules.

The initial MVP should use rule-based monitoring rather than machine-learning anomaly detection.

The system should evaluate relevant business activity and generate an alert when a defined condition is met.

### Configurable Rules (MVP)

The Business Owner and Authorized Manager may modify monitoring rule values in Settings. Staff users cannot modify monitoring rules.

Configurable rules and their defaults:

* Large Transaction: above ₦500,000
* Repeated Refunds: more than 3 within 120 minutes
* Excessive Discount: 20% or more
* Unusual Transaction Frequency: more than 5 transactions within 60 minutes
* Inventory Discrepancy: stock vs expectedStock; not configurable

Alerts are evaluated from the business's current recorded data. The first time a deterministic alert ID is generated, QubWatch stores an immutable snapshot of its reason, related IDs, evidence, generation time, and applicable rule values. Later reads do not duplicate or rewrite that snapshot when products, stock, or rule settings change. Existing statuses and investigation links remain attached to the stable alert ID. Because the previous implementation stored statuses but not reasons or evidence, alerts that stopped matching before migration 008 cannot be reconstructed exactly. Rule configuration is currently a shared singleton, not a per-business setting.

Rule settings persist in the current database configuration and can be restored to the defaults above.

---

# 17. Initial Monitoring Rules

The MVP should include initial monitoring rules such as:

### Large Transaction

Example:

> Transaction amount is greater than ₦500,000.

### Repeated Refunds

Example:

> More than 3 refunds occur within 2 hours.

### Excessive Discounting

Example:

> Discounts are at or above the defined percentage threshold (currently 20% by default).

### Unusual Transaction Frequency

Example:

> Transaction activity exceeds the defined frequency threshold within a specified period.

### Inventory Discrepancy

Example:

> Recorded stock differs from expected stock.

These thresholds are initial demonstration values and may be adjusted as the product is tested.

---

# 18. Alerts

An alert is created when monitoring identifies activity that requires attention.

Examples:

* Large transaction requires review
* Unusual refund activity
* High discount activity
* Unusual transaction frequency
* Inventory discrepancy

Alerts should provide enough information for the user to understand why the alert was created.

---

# 19. Alert Severity

* Low
* Medium
* High

The implemented monitoring rules currently generate Low, Medium, and High alerts. Critical may be used as a conceptual or future severity and may appear as a UI filter category, but no current rule generates Critical alerts.

Severity should communicate the level of attention an alert may require.

---

# 20. Alert Status

The MVP should support:

* New
* Under Review
* Investigating
* Resolved
* Dismissed

---

# 21. Alert Review

When an alert is opened, the user should see:

* Alert type
* Severity
* Date and time
* Reason for the alert
* Related transaction(s)
* Related product(s)
* Relevant staff/user information
* Current status

Available actions may include:

* Review
* Start Investigation
* Resolve
* Dismiss

---

# 22. Investigations

An investigation allows an authorized user to examine an alert in more detail.

An investigation may contain:

* Investigation ID
* Related alert
* Date opened
* Investigator
* Related transactions
* Related products
* Notes
* Evidence
* Finding
* Status
* Resolution date

Investigators may be Business Owners, Authorized Managers, or Administrators. Staff Users cannot be assigned as investigators.

---

# 23. Investigation Status

The MVP should support:

* Open
* Under Investigation
* Resolved
* Closed

The lifecycle remains Open → Under Investigation → Resolved → Closed, with Closed as the completed, retained investigation state.
Resolved and Closed investigations are retained. Their investigation history — notes, findings, resolution data, related records, and investigation-scoped audit records — is preserved. Completed investigations cannot be deleted through the application. The linked alert's review and status history is likewise retained.
No Archived status is used.

---

# 24. Investigation Notes

Authorized users should be able to add notes during an investigation.

A note may include:

* Note content
* Author
* Date and time

Notes should create a record of the investigation process.

---

# 25. Evidence

The investigation should allow the user to review relevant business information.

MVP evidence may include:

* Transaction records
* Product records
* Transaction dates and times
* Amounts
* Refund information
* Discount information
* Inventory information
* Investigation notes

The MVP does not require a complex document evidence-management system.

---

# 26. Investigation Findings

The user should be able to record a finding.

Possible findings include:

* No Issue Identified
* Legitimate Business Activity
* Process Error
* Policy Violation
* Further Review Required
* Confirmed Business Loss
* Other

The user selects the finding based on the information reviewed.

`Further Review Required` is a non-final finding. An investigation with this finding cannot be resolved; additional review and evidence are required before a final finding and resolution can be recorded.

---

# 27. Resolution

After reviewing an investigation, an authorized user should be able to record a resolution.

The resolution should include:

* Finding
* Resolution notes
* User who resolved the investigation
* Date and time
* Final status

---

# 28. AI Assistant

QubWatch should include an AI Assistant designed to help users understand business information.

The AI Assistant may help with:

* Summarizing an alert
* Explaining why an alert was generated
* Summarizing related transactions
* Highlighting relevant information
* Suggesting questions for further investigation
* Suggesting possible explanations that the user may consider

The AI Assistant should support the user's investigation rather than replace the user's judgment.

The current implementation uses a server-side Groq integration with the configured production AI model and controlled, authorized QubWatch context. The AI assists authorized human review and analysis; it does not independently accuse users of wrongdoing or decide guilt or innocence. Human users remain responsible for findings and resolutions.

---

# 29. AI Assistant Response Structure

AI responses should be organized where appropriate into:

### Known Information

Information directly available from the business records.

### Analysis

What the available information may indicate.

### Possible Explanations

Possible reasons for the observed activity.

### Suggested Next Steps

Actions the user may consider when reviewing the information.

The system should clearly distinguish recorded information from possible explanations.

---

# 30. Notifications

QubWatch should provide in-app notifications for important events.

Examples:

* New alert
* Alert requiring review
* Investigation opened
* Investigation updated
* Investigation resolved

The MVP should prioritize in-app notifications.

External notification channels can be added later.

---

# 31. Search and Filtering

The MVP should provide basic search and filtering.

Examples:

### Transactions

* Search by transaction ID
* Search by product
* Filter by transaction type

Date filtering is a future enhancement; it is not currently available in the Transactions screen.

### Alerts

* Filter by severity
* Filter by status
* Filter by alert type

### Products

* Search by product name
* Filter by category
* Filter by stock status

---

# 32. Audit Information

QubWatch should maintain basic records of important user actions.

Examples:

* Transaction created
* Alert reviewed
* Investigation opened
* Investigation note added
* Finding recorded
* Investigation resolved
* Investigation closed

Alert creation is not currently recorded as an audit event.

Where appropriate, records should include:

* User
* Action
* Date
* Time

---

# 33. User Roles and Access

The MVP should recognize basic user roles:

### Business Owner

The highest business-management permissions, including permitted management of business settings, team roles, products, transactions, monitoring rules, alerts, and investigations.

### Authorized Manager

Role-based operational management permissions within the business, including management of Staff Users. Authorized Managers cannot exercise privileged Business Owner or Administrator control or assign privileged roles.

### Staff User

Limited role-based access appropriate to staff activities, including recording transactions under their own account.

### Administrator

Review/read-oriented access to permitted business information and AI assistance, without normal business-management write permissions for teams, products, monitoring rules, transaction status, or other management functions.

Permissions are role-based; the MVP does not provide a granular custom-permission or permission-builder system. Business Owners can assign or manage roles where the application permits it.

---

# 33A. Team Management (MVP)

The Business Owner and Authorized Manager can view team members in Settings. Business Owners can assign roles where permitted. Authorized Managers can add and manage Staff Users, but cannot assign privileged roles or manage privileged owner/administrator control.

An added user has a name and one of the four roles defined in Section 33, subject to the role restrictions above. Users' names and roles can be edited only where the current role permissions allow it.

User references continue to resolve by user ID.

Team records persist through the backend API and database as the system of record. Local development can use SQLite when `DATABASE_URL` is not configured; production uses Supabase-hosted PostgreSQL through the Render backend's server-side `DATABASE_URL`. The PWA may cache application assets, but browser-local operational-data storage and offline database synchronization are not implemented. Record IDs and data-model concepts from Section 37 are preserved unchanged. This includes basic authentication (login sessions) for the existing four roles, but not advanced authentication.

The MVP does NOT include:

* User deletion
* Active/inactive user status
* Password recovery

---

# 34. Mobile Application Requirements

QubWatch targets web, Android, and iOS. The current responsive web application and installable PWA provide the mobile-responsive UI and navigation foundation and use the shared QubWatch backend/API. Android packaging/APK and iOS packaging/distribution are deployment targets; no native Android or iOS implementation is currently present in the repository.

The mobile experience should provide a simple mobile-first experience for important monitoring activities.

### Mobile Dashboard

Should display:

* Business name
* Key business indicators
* Open alerts
* Recent activity

### Mobile Alerts

Users should be able to:

* View alerts
* Open alert details
* Review related information
* Start an investigation

### Mobile Investigations

Users should be able to:

* View investigations
* Add notes
* Review evidence
* Record findings
* Resolve investigations

### Mobile Transactions

Users should be able to:

* View transactions
* Search/filter transactions
* Record appropriate transactions

### Mobile AI Assistant

Users should be able to access the AI Assistant from the mobile application.

---

# 35. Responsive Web Requirements

The web application should adapt to different screen sizes.

The interface should remain usable on:

* Desktop monitors
* Laptops
* Tablets
* Mobile browsers

Important functions should not depend on a large screen.

---

# 36. Mock Data for Initial Development

The initial development version should use realistic mock business data.

Example business:

**Demo Supermart**

Example products:

* Rice
* Cooking Oil
* Milk
* Bread
* Sugar
* Detergent

The mock transactions should contain both normal and unusual activities so that the monitoring and alert system can be demonstrated.

---

# 37. MVP Data Model

The initial application should work with these main data entities:

Record IDs defined below are preserved unchanged and serve as primary keys; the backend validates all writes.

### Business

* id
* name
* type
* location
* owner

### User

* id
* name
* role
* businessId

### Product

* id
* name
* category
* price
* stock
* expectedStock

### Transaction

* id
* date
* type
* productId
* quantity
* amount
* staffId
* discount

### Alert

* id
* type
* severity
* message
* date
* status
* relatedTransactionIds

### Investigation

* id
* alertId
* investigator
* notes
* evidence
* finding
* status
* createdAt
* resolvedAt

---

# 38. Technology Direction

The QubWatch MVP should be developed with a technology structure that can support both web and mobile experiences.

The current development project begins with:

* React
* JavaScript
* Vite
* CSS

The architecture should be kept modular so that shared business logic and UI concepts can later support the mobile application.

The final technology choice for packaging/developing the installable Android and iOS application should be made during the implementation stage based on the MVP requirements and available development resources.

---

# 39. Development Stages

## Stage 1 — Product Foundation

* Project structure
* Design system
* Navigation
* Business setup
* Mock data
* Basic responsive layout

## Stage 2 — Core Business Functions

* Products
* Transactions
* Dashboard
* Search and filtering

## Stage 3 — Monitoring

* Monitoring rules
* Alert generation
* Alert severity
* Alert status
* Alert review

## Stage 4 — Investigation

* Investigation creation
* Investigation notes
* Evidence
* Findings
* Resolution
* Audit information

## Stage 5 — AI Assistant

* AI Assistant interface
* Alert summaries
* Information analysis
* Possible explanations
* Suggested next steps

## Stage 6 — Mobile Application

* Responsive mobile web/PWA interface and navigation (implemented)
* Validate Dashboard, Alerts, Transactions, Investigations, and AI Assistant on mobile
* Prepare Android packaging/APK for the current assessment
* Prepare iOS packaging and distribution for the intended product target
* Mobile platform testing

## Stage 7 — Testing and Demonstration

* Test complete user journey
* Test responsive web interface
* Test the mobile-responsive PWA and the Android/iOS package targets
* Fix errors
* Review usability
* Run production builds
* Prepare MVP demonstration

---

# 40. MVP Definition of Done

The QubWatch MVP is ready for demonstration when a user can:

1. Open QubWatch.
2. Set up or view a business.
3. View products.
4. View transactions.
5. Record a transaction.
6. Monitor business activity.
7. Trigger or receive a demonstration alert.
8. Open and review the alert.
9. Start an investigation.
10. Review related information.
11. Add an investigation note.
12. Record a finding.
13. Resolve the investigation.
14. View the completed investigation status.
15. Use the AI Assistant for human review and analysis.
16. Perform the core workflow on a responsive web interface.
17. Perform the key monitoring workflow using the installable PWA on mobile.
18. Prepare the Android APK required for the current assessment; retain iOS packaging and distribution as an intended product target.

The application should build successfully without blocking errors.

---

# 41. Product Experience

QubWatch should feel:

* Simple
* Clear
* Professional
* Trustworthy
* Easy to understand
* Useful to a busy business owner

The application should present important information without overwhelming the user.
Operations connected to the backend show loading, empty, success, and error states.

The primary experience should help the user quickly answer:

**What is happening in my business?**

**What needs my attention?**

**What information should I review?**

**What action should I take next?**

---

# 42. Future Development

After the MVP has been tested, future versions may include:

* Expanded AI capabilities
* Machine-learning anomaly detection
* Advanced analytics
* Business forecasting
* Accounting integrations
* POS integrations
* Payment integrations
* Inventory integrations
* Email notifications
* SMS notifications
* WhatsApp notifications
* Advanced authentication
* MFA
* SSO
* Advanced role permissions
* Multi-business management
* Advanced reporting
* Advanced evidence management

---

# 43. Product Identity

**QubWatch**

**See what deserves your utmost attention.**

QubWatch is designed to help business owners see important business activities more clearly, notice unusual activity and investigate what deserves their attention.


---

# 44. Full-Stack Implementation and Technical Notes

This section records the current implementation state of the deployed full-stack MVP. It supplements the product requirements above without replacing the product scope.

## 44.1 Current Architecture

QubWatch is implemented as a full-stack application:

**React/Vite frontend and installable PWA → Express API → SQLite for local development or Supabase-hosted PostgreSQL in production**

The production application is deployed on Render. The frontend communicates with the Express API through routes under `/api`; the backend validates writes, applies server-side authentication and role checks, and persists production application data in Supabase-hosted PostgreSQL through the Render backend's server-side `DATABASE_URL`. Local development can use SQLite when `DATABASE_URL` is unset.

## 44.2 Technology Stack

- **Frontend:** React 19, JavaScript/JSX, Vite
- **Backend:** Node.js and Express
- **Database:** SQLite using `better-sqlite3` for local development when `DATABASE_URL` is unset; production uses Supabase-hosted PostgreSQL via the Render backend's server-side `DATABASE_URL`
- **PWA:** `vite-plugin-pwa`
- **Styling:** CSS
- **Authentication:** server-side sessions, HttpOnly cookies, scrypt password hashing
- **API communication:** native browser `fetch` with credentials included

## 44.3 Data and Accounts

The implementation uses the four product roles already defined in Section 33:

1. Business Owner
2. Authorized Manager
3. Staff User
4. Administrator

The main persisted entities are Business, User, Product, Transaction, Alert Snapshot, Alert Status, Investigation, Audit, and session data. SQL migrations create and evolve the database schema; migration 008 creates alert snapshots in both SQLite and PostgreSQL.

Demonstration accounts and business records use non-production test data. Real passwords, access tokens, and database files are not part of the public repository.

## 44.4 Important Implementation Files

- `src/App.jsx` — main frontend application state, navigation, screens, and backend-connected UI states
- `src/api/client.js` — shared frontend API client and HTTP error handling
- `server/index.js` — Express API entry point
- `server/auth.js` — session authentication and server-side role authorization
- `server/db.js` — dual-database connection and migration runner
- `server/routes/` — backend business/API routes
- `server/migrations/` — database schema migrations
- `vite.config.js` — Vite development proxy and PWA configuration
- `public/` — installable web-app assets and manifest
- `design.html` — standalone HTML design/prototype preview for design review

## 44.5 Implementation Decisions

- Production uses Supabase-hosted PostgreSQL through the Render backend's server-side `DATABASE_URL` with TLS enabled, using the application's configured Supabase connection compatibility settings.
- The MVP uses deterministic, rule-based monitoring rather than advanced machine-learning anomaly detection.
- Generated alerts are persisted as immutable historical snapshots with stable rule-generated IDs, generation-time evidence, related record IDs, and rule values. Statuses remain in the existing status workflow, and investigations continue to link by alert ID.
- Successful sales and refunds update product stock atomically with transaction creation; discounts do not move stock, and sales cannot take stock below zero.
- The server-side Groq AI Assistant is read-only. Its overview, alert, investigation, related-record, and user context is scoped to the authenticated user's business; cross-business alert and investigation IDs are treated as not found.
- Business records for the main application routes are business-scoped, but monitoring rule configuration is still a shared singleton. This is an MVP limitation, not a claim of complete multi-tenant production isolation.
- Authentication uses server-side sessions stored in the database; session tokens are delivered through HttpOnly cookies rather than localStorage.
- Role permissions are enforced on the server for protected operations.
- The frontend uses a shared API client so loading, empty, success, authentication, authorization, validation, and error states can be represented consistently.
- The standalone `design.html` contains no external scripts, fonts, or network dependencies so it can render through a static HTML preview service.
- The product keeps a human reviewer in the decision loop. Alerts identify activity for review and do not independently establish wrongdoing.

## 44.6 Design Notes

The visual direction is intentionally simple, clear, professional, and suitable for a busy business owner or authorized manager. The prototype emphasizes:

- business status at a glance
- activity requiring attention
- clear alert severity and reason
- direct movement from alert review to investigation
- readable tables and cards
- responsive layouts for smaller screens
- clear loading, empty, success, and error feedback in the application

The static `design.html` file is a standalone visual preview of these concepts. It is separate from the production React application and does not replace the actual application UI.

## 44.7 Agent Steering Notes

Implementation work should follow these constraints:

- Inspect and plan before modifying repository files.
- Preserve approved PRD requirements unless an explicit requirement change is requested.
- Keep MRT/business-monitoring-as-a-service material separate from QubWatch.
- Use OpenCode as the preferred repository development workflow for this project.
- Keep the QubWatch human-in-the-loop principle intact.
- Do not introduce autonomous accusations, disciplinary decisions, or autonomous business decisions.
- Keep secrets and real credentials out of the public repository.
- Validate sensitive writes on the server rather than relying only on frontend validation.
- Prefer small, verifiable implementation stages and confirm builds/tests after significant changes.

## 44.8 Current Phase and Roadmap

QubWatch is a deployed full-stack MVP with a React/Vite frontend, Express backend/API, Supabase-hosted PostgreSQL production database, and Render production deployment. Implemented functionality includes server-side authentication/session handling, role-based access control, monitoring and alerting, investigation workflows, server-side Groq AI assistance, a Paystack Test Mode subscription integration, responsive mobile UI, and an installable PWA.

The current roadmap is:

1. Validate the deployed full-stack implementation, error handling, and complete monitoring → alert → investigation → finding → resolution journey.
2. Complete assessment deployment work, including preparing the required Android APK from the existing web/PWA implementation.
3. Continue iOS packaging and distribution preparation for the intended multi-platform product.
4. Complete responsive/PWA and mobile-platform validation and prepare the product demonstration.

#### Project Status

**Current Phase Reached:** Deployed Full-Stack MVP / Assessment Deployment and Validation

**Current Status:** QubWatch is deployed on Render with a React/Vite frontend, Express backend/API, and production PostgreSQL hosted by Supabase. The application includes server-side authentication and sessions, role-based access control, business/team/product/transaction management, monitoring and alerting, investigations and audit records, server-side Groq AI assistance, and an owner-only Paystack Test Mode subscription integration. The responsive web application, mobile UI, and installable PWA are implemented. Local development can use SQLite when `DATABASE_URL` is not configured; production database connections use Supabase PostgreSQL through the Render backend's server-side `DATABASE_URL`.

**What Comes Next:** Validate the deployed workflows and prepare the Android APK required for the current assessment. Android packaging is deployment work for the existing QubWatch product, not a prerequisite for the core product to exist. Continue iOS packaging/distribution preparation and any remaining platform validation; no native Android or iOS implementation is currently present in the repository.


## 44.9 Design Refinement Note

For the design preview, the initial dashboard concept was refined to make the interface clearer and easier to review. The refinement uses a readable Inter/system typography stack, a high-contrast dark navigation area, restrained neutral card/background colors, clear severity styling, and a prominent blue action button. A sample monitoring-rule input and action were also added so the preview demonstrates a styled form control alongside the button and dashboard elements.
