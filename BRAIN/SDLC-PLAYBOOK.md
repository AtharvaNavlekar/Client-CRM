# DialPulse Client CRM — Engineering Software Development Life Cycle (SDLC) Playbook

> **Document ID:** BRAIN-SDLC-001  
> **Status:** APPROVED & MANDATORY  
> **Target Scope:** DialPulse Client CRM (`AtharvaNavlekar/CRM.git`)  
> **Classification:** Internal Engineering Standard  
> **Related Documents:**  
> - `docs/TECHNICAL_TRUTH_AUDIT.md` (Ground truth & active architecture)  
> - `docs/PRODUCTION_SECURITY_AUDIT.md` (Security hardening baselines)  
> - `docs/REQUIREMENT-TRACEABILITY.md` (Requirement ID schema & traceability matrix)  
> - `docs/TEST-STRATEGY.md` (Quality assurance layers & test harness)  
> - `docs/RELEASE-CHECKLIST.md` (Pre-flight release gate verification)  
> - `docs/GITHUB-WORKFLOW.md` (Branching, PRs, and commit standards)  
> - `docs/SDLC-BASELINE.md` (Current engineering posture & maturity)  
> - `BRAIN/CRM-PRODUCT-ELEVATION.md` (UI/UX design system & token standards)  
> - `BRAIN/DATA-PRIVACY-SPECIFICATION.md` (PII handling, retention, and isolation)

---

## 1. Scope, Mission & Authority

### 1.1 Scope
This document governs the Software Development Life Cycle (SDLC) for the **DialPulse Client CRM**, the customer-facing CRM application responsible for:
- Telecalling, telephony metadata logging, and audio transcription.
- WhatsApp Business API (WACA) conversational messaging.
- Multi-stage pipeline Kanban and lead relationship tracking.
- Multi-tenant tenant data isolation and RBAC security boundaries.
- Contact frequency compliance (quiet hours, fatigue capping, DND/opt-out registry).
- Tenant reporting, conversion analytics, and rep performance leaderboards.
- Support ticketing and SLA management.

*Note: DialPulse Central CRM / Control Center and the DialPulse Marketing Website operate under separate repositories and development charters. Cross-boundary APIs and shared tenant models must conform to mutual contract specifications.*

### 1.2 Mission
To transform DialPulse Client CRM from a rapid-iteration prototype into an enterprise-grade, highly resilient, auditable, and secure SaaS platform through a repeatable, evidence-based engineering lifecycle.

### 1.3 Core Engineering Principles
1. **Evidence-Based Engineering:** No feature is marked "Done" because a mock UI exists. Code must reflect the REAL / PARTIAL / SIMULATED / LEGACY / MISSING technical truth model defined in `docs/TECHNICAL_TRUTH_AUDIT.md`.
2. **Security by Construction:** Multi-tenant boundaries, RBAC authorization (`policy.ts`), and compliance checks (`compliance.ts`) must execute server-side before database mutation.
3. **No Unplanned Migrations:** Database schema modifications target PostgreSQL via Drizzle ORM exclusively; ad-hoc scripts or unmigrated state are strictly prohibited.
4. **Resilience & Fallback:** Systems degrade gracefully (e.g. BullMQ jobs, Redis telemetry, offline DB indicators) without unhandled exceptions or service crashes.

---

## 2. The 12-Phase Engineering Lifecycle

Every functional increment, bugfix, architectural migration, or security remediation must navigate the standard 12-phase lifecycle.

```
[1. REQUIREMENTS] ──► [2. ANALYSIS] ──► [3. UX/SYSTEM DESIGN] ──► [4. IMPLEMENTATION]
         ▲                                                                   │
         │                                                                   ▼
[12. CHANGE MGMT] ◄── [11. MAINTENANCE] ◄── [10. MONITORING] ◄── [9. RELEASE] ◄── [8. UAT] ◄── [7. SECURITY REVIEW] ◄── [6. TESTING] ◄── [5. CODE REVIEW]
```

---

### PHASE 1 — REQUIREMENTS

- **Purpose:** Capture user, business, operational, or security needs into clear, unambiguous, uniquely identified specifications before any technical work begins.
- **Required Inputs:**
  - Product problem statement or customer feature request.
  - Bug report, vulnerability disclosure, or technical debt ticket.
  - Relevant regulatory or compliance drivers (e.g., TRAI calling hours, DPDP privacy rules).
- **Activities:**
  - Assign a permanent Requirement ID (e.g., `CRM-REQ-xxx`, `CRM-SEC-xxx`, `CRM-UX-xxx`, `CRM-DB-xxx`, `CRM-INFRA-xxx`).
  - Draft user stories and explicit business value statements.
  - Formulate testable Acceptance Criteria (Gherkin format: Given-When-Then where possible).
  - Classify proposed change into Risk Level 1, 2, 3, or 4.
- **Outputs:**
  - Standard Requirement Ticket (GitHub Issue using appropriate `.github/ISSUE_TEMPLATE/`).
  - Traceability entry registered in `docs/REQUIREMENT-TRACEABILITY.md`.
- **Owner:** Product Manager / Lead Systems Architect.
- **Approval / Gate (Gate 1):** Product Owner & Tech Lead approval of functional scope and acceptance criteria.
- **Failure Conditions:**
  - Ambiguous criteria (e.g., "make calling fast", "better reports").
  - Unidentified risk level or missing requirement ID.
  - Conflicting regulatory or tenant boundary assumptions.

---

### PHASE 2 — ANALYSIS

- **Purpose:** Analyze technical feasibility, architectural blast radius, downstream dependencies, performance impacts, and security constraints.
- **Required Inputs:**
  - Approved Phase 1 Requirement Ticket.
  - Current codebase reference (`TECHNICAL_TRUTH_AUDIT.md`, `server/db/schema.ts`, `server.ts`).
  - Dependency tree and infrastructure contracts (PostgreSQL 15, Redis 7, BullMQ).
- **Activities:**
  - Audit existing components and repositories (`server/repositories/`, `src/components/`) to prevent duplicate implementations.
  - Identify data model modifications (new tables, column types, indexes, nullability).
  - Map API endpoints (method, path, request/response payload, error codes).
  - Verify tenant isolation requirements: How is `tenant_id` enforced on every query and mutation?
  - Evaluate third-party dependencies or external vendor rate limits (e.g., Gemini API, WhatsApp Cloud API).
- **Outputs:**
  - Technical Analysis section in GitHub Issue or RFC document.
  - Architectural impact checklist (Database, Auth, Frontend, Jobs, Compliance).
- **Owner:** Senior Software Engineer / Module Tech Lead.
- **Approval / Gate (Gate 2 - Definition of Ready):** Verified compliance with the **Definition of Ready (DoR)** (Section 5).
- **Failure Conditions:**
  - Unclear data ownership or unresolved multi-tenant leakage risk.
  - Unquantified external API costs or unmitigated quota limits.
  - Attempting implementation before satisfying DoR.

---

### PHASE 3 — SYSTEM / UX DESIGN

- **Purpose:** Formulate detailed structural designs for backend components and high-density, accessible interfaces for frontend experiences.
- **Required Inputs:**
  - Approved Technical Analysis.
  - Design system tokens from `BRAIN/CRM-PRODUCT-ELEVATION.md` and `BRAIN/CRM-THEME-EXPORT.md`.
  - Material Design 3 (M3) elevation and surface guidelines.
- **Activities:**
  - **Backend:** Draft Drizzle schema migrations, service interfaces, repository method signatures, and policy authorization rules.
  - **Frontend:** Design responsive layouts conforming to M3 surface tokens. Replace static "candy pills" with structured metadata or zero-pill status badges.
  - **UX States:** Explicitly define Loading (shimmers/skeletons), Empty (actionable onboarding), Error (actionable diagnostics), and Offline fallback states.
  - **Accessibility:** Design keyboard tab index flows, focus rings, contrast ratios (WCAG AA), and ARIA attributes.
- **Outputs:**
  - UI mockups / wireframes or component composition spec.
  - Backend schema migration draft (`drizzle/`) and API OpenAPI contract.
- **Owner:** Full-Stack Engineer / UI Designer.
- **Approval / Gate (Gate 3):** UX & Backend Architectural Sign-off.
- **Failure Conditions:**
  - Violates M3 design guidelines (e.g., introducing arbitrary raw hex colors, inconsistent border radii).
  - Missing error or empty states.
  - Failure to specify RBAC permission string in `policy.ts`.

---

### PHASE 4 — IMPLEMENTATION

- **Purpose:** Write production-quality, type-safe, performant, and clean executable code strictly adhering to approved specifications.
- **Required Inputs:**
  - Approved System & UX Design.
  - Clean local branch created from `main` following `docs/GITHUB-WORKFLOW.md`.
- **Activities:**
  - Write TypeScript code under strict compiler settings (`noEmitOnError`, strict null checks).
  - Implement server endpoints in `server.ts` or domain routers with mandatory `tenantMiddleware` and `policy.can()` authorization.
  - Write database operations utilizing Drizzle ORM query builders; never use raw concatenated SQL strings.
  - Ensure zero secrets or sensitive credentials are committed or exposed in client bundles.
  - Maintain structured JSON logging (`logger.info`, `logger.error`) with PII redaction.
- **Outputs:**
  - Clean code commits with conventional prefixes (`feat:`, `fix:`, `refactor:`, `security:`).
  - Automated tests covering new logic.
- **Owner:** Implementing Software Engineer.
- **Approval / Gate (Gate 4):** Local pre-flight check passing:
  - `npm run lint` (zero TypeScript errors).
  - `npm run build` (successful production bundle generation).
- **Failure Conditions:**
  - `any` types introduced without architectural justification.
  - Bypassing tenant boundary or executing queries without `where(eq(table.tenantId, tenantId))`.
  - Adding client-side API keys or hardcoded development credentials.

---

### PHASE 5 — CODE REVIEW

- **Purpose:** Peer review of all code changes for correctness, maintainability, architectural adherence, security, and edge-case handling.
- **Required Inputs:**
  - Pull Request opened using `.github/pull_request_template.md`.
  - Passing automated CI checks (Lint, Build, Tests).
- **Activities:**
  - Verify alignment with Requirement ID and acceptance criteria.
  - Audit database queries for index usage, N+1 query patterns, and tenant scoping.
  - Verify error handling: Are errors caught, logged with correlation IDs, and sanitized before returning to client?
  - Verify UI components adhere to `BRAIN/CRM-PRODUCT-ELEVATION.md` (no candy pills, consistent tokens).
  - Review git diff line-by-line; check for unintended modifications or stray debugging logs.
- **Outputs:**
  - Documented code review comments and approval in GitHub PR.
- **Owner:** Peer Engineer / Senior Code Reviewer.
- **Approval / Gate (Gate 5):** Minimum 1 approval for Level 1-2 changes; 2 approvals (including Tech Lead or Security Lead) for Level 3-4 changes.
- **Failure Conditions:**
  - Unaddressed review comments or unanswered architectural inquiries.
  - PR contains out-of-scope refactoring or unrelated functional modifications.
  - Missing tests for new business logic.

---

### PHASE 6 — TESTING

- **Purpose:** Validate code functionality, regression safety, boundary conditions, and performance across all automated testing tiers.
- **Required Inputs:**
  - Approved PR branch.
  - Execution of test suites as defined in `docs/TEST-STRATEGY.md`.
- **Activities:**
  - **Unit Testing:** Validate pure utility functions (`compliance.ts`, `deterrence.ts`).
  - **Integration Testing:** Execute API routes, session rotation, and JWT lifecycles (`npm test`).
  - **Security Testing:** Execute full automated harness (`security-tests/run-all.ts`).
  - **Regression Testing:** Verify existing lead, call, and reporting workflows remain unaffected.
- **Outputs:**
  - Test execution logs showing 100% pass rate.
  - Test evidence attached to Pull Request.
- **Owner:** Quality Assurance / Implementing Engineer.
- **Approval / Gate (Gate 6):** Green test runs across `npm run lint`, `npm test`, and `npm run test:security`.
- **Failure Conditions:**
  - Any failing automated test.
  - Flaky or skipped tests without explicit, documented architectural waiver.
  - Regressions in previously passing security or compliance benchmarks.

---

### PHASE 7 — SECURITY / PRIVACY REVIEW

- **Purpose:** Validate that changes do not introduce security vulnerabilities, privilege escalations, data leakages, or privacy violations.
- **Required Inputs:**
  - Completed code and test suite.
  - Security impact disclosure from PR template.
  - Reference to `docs/PRODUCTION_SECURITY_AUDIT.md` and `BRAIN/DATA-PRIVACY-SPECIFICATION.md`.
- **Activities:**
  - **Authentication & RBAC:** Validate session issuance, revocation, and permission checks (`policy.can()`).
  - **Tenant Boundary:** Verify impossible cross-tenant data access (IDOR on leads, calls, tickets, users).
  - **Privilege Boundaries:** Ensure non-admin roles cannot trigger admin actions (`POST /api/users`, `PUT /api/settings/*`, `POST /api/reset-data`).
  - **Privacy & PII Audit:** Verify customer phone numbers and emails are masked where appropriate; ensure no PII in logs.
  - **Impersonation Verification:** If platform staff impersonates a tenant, ensure audit log records both `platformUserId` and `targetTenantId`.
- **Outputs:**
  - Security review sign-off on PR.
- **Owner:** Security Engineer / AppSec Lead.
- **Approval / Gate (Gate 7):** Mandatory security sign-off for all Level 3 (High) and Level 4 (Critical) changes.
- **Failure Conditions:**
  - Potential IDOR or missing tenant filter.
  - Plaintext secret storage or client-side secret exposure.
  - Unauthenticated access to private tenant data.

---

### PHASE 8 — UAT / ACCEPTANCE

- **Purpose:** Validate feature behavior against original business objectives and user personas in a staging environment.
- **Required Inputs:**
  - Deployed staging / preview environment.
  - Acceptance criteria checklist from Phase 1.
  - Test user accounts across roles (`telecaller`, `tl`, `owner`, `platform_staff`).
- **Activities:**
  - Execute end-to-end user workflows (e.g., create lead -> initiate call -> log notes -> send WhatsApp message -> verify conversion in leaderboard).
  - Verify role-specific UI visibility (e.g., telecallers do not see billing, settings, or user management).
  - Validate responsive mobile viewports (360px - 768px) and touch target sizes.
- **Outputs:**
  - Formal UAT acceptance sign-off.
- **Owner:** Product Owner / QA Lead.
- **Approval / Gate (Gate 8):** Product Owner verification that Acceptance Criteria are 100% fulfilled.
- **Failure Conditions:**
  - Functional deviation from acceptance criteria.
  - Severe UI breakage on mobile viewports.
  - Inappropriate error messaging or dead-end states exposed to end users.

---

### PHASE 9 — RELEASE

- **Purpose:** Deploy validated artifacts to production safely, reliably, and with zero unexpected downtime.
- **Required Inputs:**
  - Merged PR into `main`.
  - Completed and signed `docs/RELEASE-CHECKLIST.md`.
  - Documented Rollback Plan.
- **Activities:**
  - Execute database migrations via Drizzle (`drizzle-kit migrate` or `bootstrap.ts`).
  - Trigger production container build and deployment (e.g., Google Cloud Run).
  - Verify environment variables and secret injection (`DATABASE_URL`, `JWT_SECRET`, `REDIS_URL`).
  - Execute post-release smoke test checklist (health probe `/api/health`, login test, lead view).
- **Outputs:**
  - Tagged Git Release (`vX.Y.Z`).
  - Published Release Notes in GitHub.
- **Owner:** DevOps / Release Engineer / Tech Lead.
- **Approval / Gate (Gate 9):** Production Deployment Authorization.
- **Failure Conditions:**
  - Failed health probe (`/api/health` returns non-200 or database disconnected).
  - Migration failure or schema locking timeout.
  - Incomplete release checklist.

---

### PHASE 10 — MONITORING

- **Purpose:** Observe system health, operational telemetry, error rates, and security alerts post-release.
- **Required Inputs:**
  - Active production workloads.
  - Monitoring infrastructure (Structured logs, Prometheus metrics, Security alert dispatcher).
- **Activities:**
  - Monitor HTTP 5xx error rates and p95/p99 request latencies.
  - Inspect `/api/platform/soc/alerts` and audit logs for anomalous rate-limiting or authentication failures.
  - Track background queue health (BullMQ active, completed, and failed jobs).
  - Monitor database connection pool saturation and query execution times.
- **Outputs:**
  - Post-release health confirmation (1 hour, 24 hours).
  - Performance and error rate baseline report.
- **Owner:** Site Reliability Engineer / On-Call Engineer.
- **Approval / Gate (Gate 10):** 24-hour stabilization sign-off.
- **Failure Conditions:**
  - Error rate spike (> 0.5% of total requests).
  - Database connection exhaustion.
  - Continuous job failure in BullMQ worker.

---

### PHASE 11 — MAINTENANCE

- **Purpose:** Maintain system health, resolve defect backlogs, manage technical debt, and update dependencies.
- **Required Inputs:**
  - Maintenance backlog, dependency security alerts (Dependabot, npm audit).
  - Performance profiling data and technical truth discrepancies.
- **Activities:**
  - Apply security patches to Node.js packages and container base images.
  - Clean up deprecated fields, legacy code, or dead routes.
  - Update `docs/TECHNICAL_TRUTH_AUDIT.md` whenever an architectural gap is resolved.
  - Run database vacuuming and analyze table statistics.
- **Outputs:**
  - Scheduled maintenance pull requests.
  - Updated architectural audits.
- **Owner:** Core Maintenance Engineering Team.
- **Approval / Gate (Gate 11):** Bi-weekly maintenance review.
- **Failure Conditions:**
  - Unpatched critical vulnerabilities (> 14 days).
  - Stale documentation that drifts from code reality.

---

### PHASE 12 — CHANGE MANAGEMENT

- **Purpose:** Systematically track, govern, and audit all non-standard changes, emergency hotfixes, or major architectural shifts.
- **Required Inputs:**
  - Change Request RFC or Incident Post-Mortem.
- **Activities:**
  - Review blast radius of major changes (e.g., auth redesign, storage tier migration).
  - Maintain historical change log in release documentation.
  - Conduct Root-Cause Analysis (RCA) on production incidents and feed preventative actions into Phase 1 (Requirements).
- **Outputs:**
  - Architecture Decision Records (ADRs).
  - Incident Post-Mortem Reports.
- **Owner:** Engineering Director / Tech Lead.
- **Approval / Gate (Gate 12):** Change Advisory Board (CAB) / Tech Lead Sign-off.
- **Failure Conditions:**
  - Unreviewed production changes or undocumented schema modifications.

---

## 3. Requirement ID Taxonomy & Conventions

To ensure end-to-end traceability from inception to production, every requirement, constraint, and architectural standard must possess a unique, persistent identifier.

| Prefix | Domain | Description | Example |
| :--- | :--- | :--- | :--- |
| **`CRM-REQ-xxx`** | Functional Requirements | Business logic, CRM features, user workflows, integrations. | `CRM-REQ-001` (Auth & Sessions) |
| **`CRM-SEC-xxx`** | Security Controls | Authentication hardening, RBAC, tenant isolation, encryption. | `CRM-SEC-002` (Tenant Isolation) |
| **`CRM-UX-xxx`** | User Experience | Design tokens, accessibility, responsive layouts, components. | `CRM-UX-001` (Pipeline Kanban M3) |
| **`CRM-DB-xxx`** | Database Architecture | Schema design, migrations, indexing, constraints, concurrency. | `CRM-DB-001` (Lead Schema & Indexing) |
| **`CRM-INFRA-xxx`**| Infrastructure | Jobs, Redis, Docker, CI/CD, logging, monitoring, backup. | `CRM-INFRA-001` (BullMQ Jobs Queue) |
| **`CRM-PRIV-xxx`** | Privacy & PII | Data retention, consent, redaction, export, DND compliance. | `CRM-PRIV-001` (Contact Frequency) |
| **`CRM-HOTFIX-xxx`**| Incident Hotfixes | Emergency production bug fixes requiring retroactive SDLC. | `CRM-HOTFIX-001` (Session Fix) |

### Requirement ID Rules:
1. **Immutability:** Once an ID is assigned, it is never re-used or re-assigned to another feature.
2. **Format:** Standard 3-digit zero-padded number (`001`, `002`, ... `999`).
3. **Traceability:** The ID must be cited in PR titles, commit messages (`feat(CRM-REQ-001): ...`), test descriptions (`describe('CRM-REQ-001 ...')`), and documentation.

---

## 4. Requirement Traceability Model

Every line of production code must trace back to an authorized requirement and forward to verified test cases:

```
[Requirement ID] ──► [Architecture / Design] ──► [Source Code Implementation]
        │                                                     │
        ▼                                                     ▼
[UAT Acceptance] ◄── [Production Release] ◄── [Security & Automated Tests]
```

The master mapping is maintained in **`docs/REQUIREMENT-TRACEABILITY.md`**. Every feature must be cataloged under the standard status model:
- `REAL` — Fully implemented in active executable code, backed by database schema and tests.
- `PARTIAL` — Core path works, but edge cases, persistence, or secondary actions are missing.
- `SIMULATED` — Stubbed, mock responses, or hardcoded return values.
- `LEGACY` — Relic from prior iterations (e.g. JSON persistence code, deprecated tables).
- `MISSING` — Documented or planned, but completely absent from source code.

---

## 5. Definition of Ready (DoR)

A backlog item or issue **MUST NOT** enter Phase 4 (Implementation) until the Definition of Ready is satisfied.

### 5.1 Universal DoR Checklist (All Changes)
- [ ] **Clear Objective:** Plainly states the problem being solved and the expected outcome.
- [ ] **Assigned Requirement ID:** Canonical ID assigned and referenced.
- [ ] **Acceptance Criteria:** Specific, testable criteria defined.
- [ ] **Risk Classification Assigned:** Categorized as Level 1, Level 2, Level 3, or Level 4.
- [ ] **Affected Modules Identified:** Frontend components, backend controllers, and database tables listed.

### 5.2 Major Change DoR (Level 3 & Level 4 Changes)
In addition to the universal checklist, high-risk changes require:
- [ ] **Security Impact Analysis:** Documented tenant boundary check, authz permission mapping in `policy.ts`.
- [ ] **Database Schema RFC:** Drizzle migration diff, column nullability, foreign keys, index evaluation.
- [ ] **Fallback / Rollback Strategy:** Plan for backward compatibility and rapid failure recovery.
- [ ] **UX / A11y Review:** Wireframe or component token adherence verified against `BRAIN/CRM-PRODUCT-ELEVATION.md`.

*Exemption for Level 1 (Low Risk): Minor copy or harmless styling fixes require only the Universal Checklist and may proceed without full architectural review.*

---

## 6. Definition of Done (DoD)

A code change is **NOT DONE** simply because it compiles or runs locally. A task is considered "Done" only when all of the following conditions are verified:

1. **Implementation Completeness:** All acceptance criteria are fully met in code.
2. **Type Safety & Linting:** `npm run lint` passes with 0 errors and 0 warnings.
3. **Build Verification:** `npm run build` generates production artifacts without bundle errors.
4. **Automated Testing:**
   - Unit and integration tests added or updated.
   - All tests pass via `npm test`.
   - Security regression suite passes via `npm run test:security`.
5. **Tenant Isolation Verification:** All queries enforce `tenant_id` scoping; zero IDOR vulnerabilities.
6. **Error & Edge Handling:** API endpoints catch exceptions, return typed error schemas, and log correlation IDs.
7. **UX & Accessibility Standards:**
   - Responsive across mobile (360px+) and desktop viewports.
   - Adheres to Zero-Pill discipline and M3 elevation.
   - Loading, Empty, and Error states implemented.
8. **Security & Privacy Audit:**
   - No hardcoded secrets, passwords, or exposed keys.
   - No PII logged in plaintext.
9. **Documentation & Traceability:**
   - `docs/REQUIREMENT-TRACEABILITY.md` updated with the feature status.
   - If architectural reality changed, `docs/TECHNICAL_TRUTH_AUDIT.md` updated.
10. **Code Review & Git Cleanliness:**
    - PR reviewed and approved by authorized reviewers.
    - Git history clean, conforming to conventional commit messages.

---

## 7. Change Risk Classification & Governance Gates

Changes are categorized into four distinct risk tiers, each requiring proportional review and verification gates.

| Risk Level | Impact & Scope | Examples | Required Reviewers | Mandatory Verification Gates |
| :--- | :--- | :--- | :--- | :--- |
| **LEVEL 1 — LOW** | Non-functional UI, copy, documentation, minor styling | - Typography fixes<br>- Label updates<br>- Markdown documentation | 1 Peer Engineer | - Lint & Build<br>- Visual sanity check |
| **LEVEL 2 — MEDIUM** | Component logic, new views, internal utility functions, non-breaking API tweaks | - New filter in Leads view<br>- Export modal improvements<br>- Chart visualization tweaks | 1 Senior Engineer | - Lint & Build<br>- Integration test<br>- UX check |
| **LEVEL 3 — HIGH** | Core business logic, RBAC, tenant middleware, database schema, calling compliance | - New Drizzle table migration<br>- Modifying `policy.ts`<br>- Changing quiet hours logic<br>- Adding user roles | 2 Reviewers (including Tech Lead) | - Full test suite (`npm test`)<br>- Security suite (`test:security`)<br>- Database migration review<br>- UAT sign-off |
| **LEVEL 4 — CRITICAL** | Platform authentication, session tokens, cross-tenant impersonation, data deletion, root infra | - Changing JWT signing / hashing<br>- `impersonation_sessions` logic<br>- Database wipe / reset logic<br>- Core Redis / BullMQ worker | 2 Reviewers (Tech Lead + AppSec Lead) | - All Level 3 gates<br>- AppSec Architecture Review<br>- Dry-run rollback verification<br>- Post-release 24h monitoring |

---

## 8. Security SDLC & Security Checkpoints

Security is not an afterthought; it is integrated across all lifecycle phases:

```
[Phase 1: Threat Identification] ──► [Phase 3: Threat Modeling & Authz Design]
                │
                ▼
[Phase 4: Defensive Coding] ───────► [Phase 6: Automated Security Harness]
                │
                ▼
[Phase 7: AppSec Review & IDOR Audit] ──► [Phase 10: SOC Telemetry & Alerting]
```

### Mandated Security Checkpoints:
1. **Authentication Boundary:** Passwords hashed with bcrypt (work factor 10+). JWT tokens signed with SHA-256 using 512-bit secrets (`resolveJwtSecret()`). Session rotation enforced on refresh.
2. **Authorization Boundary:** Every mutating API route must invoke `policy.can(req.securityContext, action, resource)`. Non-admin access to admin routes must return `403 FORBIDDEN`.
3. **Tenant Scoping:** All database selects, updates, and deletes must bind `eq(table.tenantId, req.securityContext.tenantId)`. No client-supplied `tenantId` override is accepted.
4. **Input Sanitization & Injection Prevention:** Formula injection (`=`, `@`, `+`, `-`) sanitized in CSV exports. SQL injection prevented by Drizzle parameterized queries.
5. **Session Revocation:** On logout, session is recorded as revoked in `sessions` table. Active tokens checked against revoked state.
6. **Crawler & Scraper Deterrence:** Enforce AI scraper blocking headers, `robots.txt`, and client-side anti-debugging deterrence (`src/utils/deterrence.ts`).
7. **Secrets Management:** Client bundles scanned to guarantee zero leaked secrets.

---

## 9. Privacy SDLC

Privacy requirements apply to all customer PII (Personal Identifiable Information) handled by DialPulse CRM:

1. **Data Minimization:** Only collect lead phone, email, and name necessary for telecalling and sales outreach.
2. **Purpose Limitation:** Customer phone numbers are strictly used for verified call connection and customer-consented WhatsApp updates.
3. **Consent & DND Guardrails:** Lead opt-out requests (`isOptedOut: true`) immediately block all outbound calls and WhatsApp dispatches (`compliance.ts`).
4. **Contact Frequency & Quiet Hours:** Calling hours constrained between 09:00 and 19:00 IST. Daily call attempt limits (maximum 3 attempts) enforced server-side.
5. **Audit Trail:** Any access to PII or customer data export must generate an audit log record with `actorUserId`, `tenantId`, `clientIp`, and `occurredAt`.
6. **Data Retention & Deletion:** Leads deleted via `DELETE /api/leads/:id` must cascade or permanently delete associated call records and message logs.

---

## 10. UX & Accessibility Gate

Every user-facing pull request must satisfy the UI foundation standards detailed in `BRAIN/CRM-PRODUCT-ELEVATION.md`:

1. **Zero-Pill Discipline:** Eliminate heavy rounded pill badges (`rounded-full bg-*-100`) for static metadata. Use subtle tonal chips, dot indicators, or clean typographic hierarchy.
2. **Material Design 3 Surface Elevation:** Respect elevation surfaces:
   - Canvas (Background: `#F8FAF8` light / `#111413` dark)
   - Surface (Cards, sidebars: `#FFFFFF` light / `#191C1B` dark)
   - Container (Dropdowns, dialogs: `#EAEFEA` light / `#222624` dark)
3. **Typography Scale:**
   - Headings: Plus Jakarta Sans / Roboto (SemiBold/Bold)
   - Body & Controls: System Sans / Roboto
   - Numbers, Phone Numbers, Timestamps, Latency: `JetBrains Mono`
4. **Corner Radius Hierarchy:**
   - Small controls (inputs, buttons): `rounded-lg` (8px) or `rounded-xl` (12px)
   - Cards & Containers: `rounded-2xl` (16px)
   - Large Modals: `rounded-[24px]` (24px)
5. **Accessibility (a11y) Baseline:**
   - All interactive elements must support keyboard Tab navigation and visual focus rings (`focus-visible:ring-2`).
   - Form inputs must have descriptive `<label>` or `aria-label` bindings.
   - Text contrast must meet WCAG 2.1 AA (minimum 4.5:1 for body text).
   - Icons must provide `aria-hidden="true"` or accessible labels.

---

## 11. Database Change Gate

PostgreSQL managed via Drizzle ORM is the sole persistence layer of DialPulse CRM. Any schema modification must follow this strict gate:

1. **RFC Justification:** Explicitly document why the schema change is necessary and what queries it serves.
2. **Schema Declaration:** Add definitions to `server/db/schema.ts` using typed Drizzle columns.
3. **Migration Generation:** Generate migration SQL using Drizzle Kit. Never write ad-hoc SQL files by hand.
4. **Multi-Tenant Constraint:** Every new business table must include `tenantId: text('tenant_id').notNull().references(() => tenants.id)`.
5. **Backward Compatibility:** All migrations must be non-breaking for running code:
   - Adding a column: Must be nullable or provide a safe default.
   - Renaming a column: Dual-write phase required before removing the old column.
   - Removing a column: Remove application references first, then drop the column in a subsequent release.
6. **Rollback Script:** Every migration PR must include an explicit down-migration or rollback command.

---

## 12. Release Gate

Before code is deployed to production, the formal **`docs/RELEASE-CHECKLIST.md`** must be signed off by the Release Owner.

### Core Release Gates:
1. `npm run lint` — Zero TypeScript compilation or linting errors.
2. `npm run build` — Clean production Vite bundle and Node server build (`dist/`).
3. `npm test` — All functional and integration tests passing.
4. `npm run test:security` — All security harness test cases passing.
5. Database migrations applied and verified against staging PostgreSQL.
6. Secrets verified: `DATABASE_URL`, `JWT_SECRET`, and optional `REDIS_URL` properly configured.
7. Rollback rehearsal complete and smoke test procedure ready.

---

## 13. Incident & Emergency Hotfix Process

When a high-severity production issue occurs (e.g. data corruption, security vulnerability, complete service outage), teams follow the streamlined Emergency Hotfix Workflow:

```
[1. DETECT] ──► [2. TRIAGE] ──► [3. CONTAIN] ──► [4. HOTFIX] ──► [5. TEST]
                                                                        │
[10. RCA] ◄── [9. RETRO-DOCS] ◄── [8. VERIFY] ◄── [7. DEPLOY] ◄─────────┘
```

1. **DETECT:** Automated alerts (Prometheus, SOC alerts) or customer incident reported.
2. **TRIAGE:** Severity assigned (P0: System down/Data leak, P1: Major feature broken, P2: Minor issue).
3. **CONTAIN:** Apply temporary mitigation (feature flag disable, rate-limit clamping, IP blocking).
4. **HOTFIX:** Create branch `hotfix/CRM-HOTFIX-xxx` directly from production tag. Minimal targeted code change only.
5. **TEST:** Run targeted tests and verify regression safety.
6. **DEPLOY:** Expedited deployment with 1 Tech Lead approval.
7. **VERIFY:** Immediate production smoke testing.
8. **RETRO-DOCS:** Retroactively complete standard PR documentation, tests, and traceability within 24 hours.
9. **ROOT-CAUSE ANALYSIS (RCA):** Publish formal 5-Whys RCA and schedule preventative technical debt tickets.

---

## 14. Maintenance & Technical Debt Management

Technical debt is tracked and prioritized alongside feature development using the Technical Truth taxonomy:

- **Bugs:** Prioritized according to severity; P0/P1 bugs preempt feature development.
- **Simulated / Stub Resolution:** Systematic migration of synthetic components (e.g. replacing simulated calling stubs with actual telephony gateway integrations) tracked in the maintenance backlog.
- **Dependency Hygiene:** Monthly review of outdated or vulnerable dependencies via `npm audit` and Dependabot.
- **Deprecation Policy:** Deprecated endpoints or database columns must be flagged for at least 1 minor release cycle before removal.

---

## 15. Feature Lifecycle Status Model

Every feature in the repository transitions through clear lifecycle states:

```
[PROPOSED] ──► [ANALYSIS] ──► [DESIGNED] ──► [READY] ──► [IN DEVELOPMENT]
                                                                │
[RELEASED] ◄── [APPROVED] ◄── [UAT] ◄── [SECURITY REVIEW] ◄─────┼──► [TESTING]
     │                                                          │
     ▼                                                          ▼
[MONITORED] ──► [MAINTAINED] ──► [DEPRECATED] ──► [RETIRED]  [CODE REVIEW]

Terminal / Exception States: [BLOCKED] | [REJECTED] | [ABANDONED]
```

- **PROPOSED:** Requirement identified; awaiting business/architectural prioritization.
- **ANALYSIS:** Technical feasibility, security implications, and blast radius under review.
- **DESIGNED:** Schema, API contracts, and M3 UI layouts drafted.
- **READY:** Definition of Ready (DoR) satisfied; ready for sprint planning.
- **IN DEVELOPMENT:** Active implementation in local or feature branch.
- **CODE REVIEW:** Pull request opened; under peer review.
- **TESTING:** Automated unit, integration, and security test execution.
- **SECURITY REVIEW:** AppSec audit, IDOR verification, and boundary checks.
- **UAT:** Stakeholder validation in staging environment against acceptance criteria.
- **APPROVED:** All gates cleared; ready for release tag.
- **RELEASED:** Deployed to production environment.
- **MONITORED:** Post-deployment observation and error tracking (first 24-48 hours).
- **MAINTAINED:** Steady-state operational maintenance.
- **DEPRECATED:** Scheduled for retirement; replacement available.
- **RETIRED:** Removed from codebase and schema.
- **BLOCKED:** Paused due to external dependencies or blockers.
- **REJECTED:** Rejected during Analysis or Review.
- **ABANDONED:** Deprioritized and discarded.

---

## 16. Governance & Compliance Auditing

This playbook is a living standard. Every pull request merged into `main` must demonstrate compliance with these lifecycle requirements. Violations or intentional bypasses of security gates, tenant isolation checks, or definition of done standards constitute a breach of engineering integrity and require immediate review by the Technical Architecture Board.
