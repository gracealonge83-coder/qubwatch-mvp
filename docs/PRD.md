# QubWatch MVP Product Requirements Document (PRD)

## 1. Product Name

**QubWatch**

### Tagline

**Giving you smarter eyes.**

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

The manager's access depends on the permissions assigned to the user.

## 4.3 Staff User

A staff member who may record or be associated with business transactions.

Staff access is more limited than owner or manager access.

## 4.4 Administrator

An administrative user responsible for basic system administration.

Administrator functionality will remain limited in the MVP.

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

### Mobile App

The product should also have an installable mobile application for:

* Android
* iOS

The mobile experience should provide access to the core QubWatch monitoring workflow.

The mobile application should prioritize:

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
* Browser-local persistence of operational records
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
* Responsive web interface
* Mobile application

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
Saved business information persists via the backend database so it remains available after page refresh and when the user reopens QubWatch; browser-local storage may remain as an offline cache.
The backend database is the system of record for operational records (products, transactions, alerts, investigations and audit records). Browser-local persistence may remain as an offline/cache layer for the existing client experience; it is not the authoritative source of backend-connected records.

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

The MVP should allow authorized users to record transactions.

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

Because alerts are derived from the currently stored transaction data, changing a rule applies to all stored data. Existing alert statuses remain where the same deterministic alert ID continues to exist.

Rule settings persist locally on the same browser and device and can be restored to the defaults above.

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

> Discounts exceed the defined percentage threshold.

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

The MVP should support four severity levels:

* Low
* Medium
* High
* Critical

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

---

# 23. Investigation Status

The MVP should support:

* Open
* Under Investigation
* Resolved
* Closed

The lifecycle remains Open → Under Investigation → Resolved → Closed, with Closed as the completed, retained investigation state.
A completed investigation (Resolved or Closed) may be deleted by an authorized user after confirmation. Active investigations (Open or Under Investigation) cannot be deleted.
Deleting an investigation removes its notes, finding, resolution data, and investigation-scoped audit records. It does not change or erase the linked alert's review and status history.
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

For the initial MVP, the AI Assistant may use demonstration/mock responses before a real AI service is connected.

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
* Filter by date

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
* Alert created
* Alert reviewed
* Investigation opened
* Investigation note added
* Finding recorded
* Investigation resolved

Where appropriate, records should include:

* User
* Action
* Date
* Time

---

# 33. User Roles and Access

The MVP should recognize basic user roles:

### Business Owner

Access to business monitoring, products, transactions, alerts, investigations, and settings.

### Authorized Manager

Access to monitoring and management functions assigned by the owner.

### Staff User

Access to functions required for assigned business activities.

### Administrator

Basic administrative access.

More detailed role-based permissions may be expanded in later versions.

---

# 33A. Team Management (MVP)

The Business Owner and Authorized Manager can view team members in Settings.

They can add a user with:

* Name
* One of the four roles defined in Section 33

They can edit an existing user's name and role.

Added and edited users are saved in browser storage and remain available after page refresh and when the user reopens QubWatch in the same browser and device.
User references continue to resolve by user ID.

Persistence is provided by a backend API with database storage as the system of record; browser-local storage may remain as an offline cache. Record IDs and data-model concepts from Section 37 are preserved unchanged. This introduces basic authentication (login sessions) for the existing four roles. It does not introduce dedicated offline synchronization, conflict-resolution synchronization, or advanced authentication.

The MVP does NOT include:

* User deletion
* Active/inactive user status
* Password recovery

---

# 34. Mobile Application Requirements

The mobile application should provide a simple mobile-first experience for important monitoring activities.

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

* Mobile interface
* Mobile navigation
* Dashboard
* Alerts
* Transactions
* Investigations
* AI Assistant
* Mobile testing

## Stage 7 — Testing and Demonstration

* Test complete user journey
* Test responsive web interface
* Test mobile application
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
15. Use the AI Assistant.
16. Perform the core workflow on a responsive web interface.
17. Perform the key monitoring workflow on the installable mobile application.

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

* Real AI integration
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

**Giving you smarter eyes.**

QubWatch is designed to help business owners see important business activities more clearly, notice unusual activity and investigate what deserves their attention.


---

# 44. Full-Stack Implementation and Technical Notes

This section records the implementation state used for the working local prototype. It supplements the product requirements above without replacing the product scope.

## 44.1 Current Architecture

QubWatch is implemented as a small full-stack application:

**React/Vite frontend → Express API → PostgreSQL database (SQLite fallback)**

The frontend communicates with backend routes under `/api`. The backend validates writes, applies authentication and role checks, and persists application data in PostgreSQL (SQLite file fallback when DATABASE_URL is unset).

## 44.2 Technology Stack

- **Frontend:** React 19, JavaScript/JSX, Vite
- **Backend:** Node.js and Express
- **Database:** PostgreSQL using `pg`
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

The main persisted entities are Business, User, Product, Transaction, Alert, Investigation, Audit, and session data. SQL migrations create and evolve the database schema.

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

- PostgreSQL is the current database and system of record for backend-connected data, with SQLite retained as a local fallback.
- The MVP uses deterministic, rule-based monitoring rather than advanced machine-learning anomaly detection.
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

The project has progressed from the initial Vite/React foundation through core business functions, monitoring, investigation, AI Assistant work, and full-stack data implementation.

The current roadmap is:

1. Verify the full-stack implementation and error handling.
2. Verify responsive and installable mobile/PWA behavior.
3. Test the complete monitoring → alert → investigation → finding → resolution journey.
4. Prepare and record the prototype demonstration.
5. Continue with the remaining mobile and final testing work described in Stage 6 and Stage 7.

#### Project Status

**Current Phase Reached:** Initial Working Prototype / Full-Stack MVP Implementation

**Current Status:** QubWatch has reached a working local prototype phase. The actual React/Vite application opens locally in the browser as a working QubWatch interface, separate from the static `design.html` preview. The prototype includes the QubWatch Dashboard and core application pages, uses the local Express API and PostgreSQL database, and uses seeded/mock data for the local demonstration.

**What Comes Next:** Continue the QubWatch MVP implementation roadmap through further testing, refinement, validation, and preparation for the next development/release stage. Future work should remain aligned with the PRD scope.


## 44.9 Design Refinement Note

For the design preview, the initial dashboard concept was refined to make the interface clearer and easier to review. The refinement uses a readable Inter/system typography stack, a high-contrast dark navigation area, restrained neutral card/background colors, clear severity styling, and a prominent blue action button. A sample monitoring-rule input and action were also added so the preview demonstrates a styled form control alongside the button and dashboard elements.
