# DialPulse Client CRM — Requirement Traceability Matrix (RTM)

> **Document ID:** DOC-RTM-001  
> **Status:** ACTIVE & AUTHORITATIVE  
> **Target Scope:** DialPulse Client CRM (`AtharvaNavlekar/CRM.git`)  
> **Auditing Standard:** Ground Technical Truth (`docs/TECHNICAL_TRUTH_AUDIT.md`)  
> **Classification Legend:**  
> - `REAL` — Fully implemented in active executable code, backed by PostgreSQL schema and automated tests.  
> - `PARTIAL` — Core path works, but secondary features, edge cases, or full integrations are pending.  
> - `SIMULATED` — Stubbed, mock responses, synthetic latency, or hardcoded return values.  
> - `LEGACY` — Relic from prior iterations (e.g. JSON storage helpers) retained for backward compatibility.  
> - `MISSING` — Claimed in documentation or UI but completely absent from source code.

---

## 1. Traceability Architecture

The Requirement Traceability Model guarantees that every functional, security, UX, database, and infrastructure capability has clear provenance and verification evidence across the development lifecycle:

```
[Requirement ID] ──► [Design Specification] ──► [Code Implementation] ──► [Test Verification] ──► [Security Audit] ──► [Release Gate]
```

### Traceability Schema Fields:
1. **Requirement ID:** Stable, unique identifier (`CRM-REQ-*`, `CRM-SEC-*`, `CRM-UX-*`, `CRM-DB-*`, `CRM-INFRA-*`).
2. **Title & User Story:** Concise statement of user or business problem solved.
3. **Module / Layer:** Component area (Backend, Frontend, Database, Jobs, Policy).
4. **Implementation Artifacts:** Verified files and endpoints executing the logic.
5. **Verification Artifacts:** Test files, scripts, and suites validating the requirement.
6. **Technical Truth Status:** `REAL` | `PARTIAL` | `SIMULATED` | `LEGACY` | `MISSING`.
7. **Security & Compliance Impact:** Explicit verification of tenant boundaries, RBAC, and data privacy.

---

## 2. Requirement Identification System

| Category | Prefix | Scope & Responsibility |
| :--- | :--- | :--- |
| **Functional Requirements** | `CRM-REQ-xxx` | Core CRM user journeys, sales workflows, integrations, and lifecycle actions. |
| **Security Controls** | `CRM-SEC-xxx` | Authentication, RBAC authorization, tenant boundaries, secrets, session integrity. |
| **User Experience** | `CRM-UX-xxx` | Design tokens, M3 surface elevation, zero-pill discipline, responsive layouts, a11y. |
| **Database & Schema** | `CRM-DB-xxx` | PostgreSQL tables, Drizzle ORM definitions, indexes, foreign keys, migrations. |
| **Infrastructure & Jobs**| `CRM-INFRA-xxx`| Background workers (BullMQ), Redis telemetry, Docker, logging, health probes. |
| **Privacy & Compliance**| `CRM-PRIV-xxx` | TRAI quiet hours, DND registry, contact fatigue caps, PII retention and redaction. |

---

## 3. Master Traceability Matrix

### 3.1 Authentication, Identity & Sessions

#### `CRM-REQ-001` / `CRM-SEC-001` — Multi-Factor Ready Password Authentication & Session Lifecycle
- **User Story:** As an authorized CRM user, I must securely authenticate with my email and password, receive a cryptographically signed JWT access token and opaque refresh token, and have my session revoked upon logout.
- **Design Spec:** `BRAIN/SDLC-PLAYBOOK.md` §8; `docs/PRODUCTION_SECURITY_AUDIT.md` §1-4.
- **Implementation Artifacts:**
  - `server/auth.ts`: `hashPassword()`, `verifyPassword()`, `signAccessToken()`, `generateOpaqueRefreshToken()`, `authenticateToken()`, `resolveJwtSecret()`.
  - `server.ts`: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/me`.
  - `server/db/schema.ts`: `users` (password_hash, auth_version), `sessions` (refresh_token_hash, revoked_at, token_family_id).
- **Verification Tests:**
  - `tests/auth-and-compliance.test.ts` (Category 1: Password Authentication, Category 2: Token Validation & Revocation).
  - `security-tests/auth.test.ts` (Bcrypt work factor, token tampering, algorithm "none" bypass).
- **Status:** **`REAL`**
- **Notes:** Password verification uses bcrypt with work factor 10. Access token lifespan is 15 minutes; refresh tokens use SHA-256 hashed rotation and detect reuse.

---

### 3.2 Multi-Tenant Isolation & Impersonation

#### `CRM-REQ-002` / `CRM-SEC-002` — Strict Multi-Tenant Data Isolation & Platform Impersonation Safety
- **User Story:** As an enterprise tenant, all my CRM records (leads, calls, messages, users) must be strictly isolated by `tenant_id` at the database and middleware layers to prevent cross-tenant leakage or IDOR attacks.
- **Design Spec:** `server/tenantMiddleware.ts`; `docs/PRODUCTION_SECURITY_AUDIT.md` §3-4.
- **Implementation Artifacts:**
  - `server/tenantMiddleware.ts`: `enforceTenantScope()`, `verifyTenantActive()`, `requirePlatformStaff()`.
  - `server.ts`: All business routes filter via `where(eq(schema.*.tenantId, tenantId))`.
  - `server/db/schema.ts`: `tenants`, `impersonation_sessions`.
- **Verification Tests:**
  - `security-tests/authorization.test.ts` (Cross-tenant probing, IDOR lead modification).
  - `tests/auth-and-compliance.test.ts` (Tenant isolation assertions).
- **Status:** **`REAL`**
- **Notes:** Platform staff cannot access tenant data without creating an explicit, auditable impersonation session with expiration (`impersonation_sessions`). Suspended tenants are locked out in real-time.

---

### 3.3 Lead Management & Data Persistence

#### `CRM-REQ-003` / `CRM-DB-001` — Relational Lead Management with Custom Field Extensibility
- **User Story:** As a sales representative, I must create, view, update, filter, and delete customer leads with dynamic custom fields and assignment to reps/teams.
- **Design Spec:** `server/db/schema.ts` (`leads`, `custom_fields`); `BRAIN/CRM-PRODUCT-ELEVATION.md` §3.
- **Implementation Artifacts:**
  - `server.ts`: `GET /api/leads`, `GET /api/leads/:id`, `POST /api/leads`, `PUT /api/leads/:id`, `DELETE /api/leads/:id`.
  - `server/db/schema.ts`: `leads` table with indexed `tenant_id`, `assigned_rep_id`, `stage`, `status`.
  - `src/components/leads/LeadsListView.tsx`, `src/components/leads/LeadCard.tsx`.
- **Verification Tests:**
  - `security-tests/business-logic.test.ts` (Lead creation, update constraints).
  - `security-tests/authorization.test.ts` (Lead delete RBAC guard).
- **Status:** **`REAL`**
- **Notes:** Backed by PostgreSQL `leads` table. Includes fallback to seed memory when database is offline in local development.

---

### 3.4 Pipeline Kanban & Visual Stages

#### `CRM-REQ-004` / `CRM-UX-001` — Interactive Pipeline Kanban with M3 Visual Depth
- **User Story:** As a sales team lead, I need an interactive Kanban board to drag-and-drop leads across configurable stages (New, Contacted, In Discussion, Proposal, Won, Lost).
- **Design Spec:** `BRAIN/CRM-PRODUCT-ELEVATION.md` §1-2; `src/components/pipeline/KanbanBoard.tsx`.
- **Implementation Artifacts:**
  - `src/components/pipeline/KanbanBoard.tsx`, `src/components/pipeline/LeadCard.tsx`, `src/components/pipeline/AddLeadModal.tsx`.
  - `server.ts`: `PUT /api/leads/:id` (stage updating with audit logging).
  - `server/db/schema.ts`: `pipeline_stages`.
- **Verification Tests:**
  - `npm run lint` & `npm run build` (type-safe component composition).
  - Manual UI verification across desktop and mobile viewports.
- **Status:** **`REAL`**
- **Notes:** Adheres to M3 surface elevation tokens; stage transitions persist to PostgreSQL and update lead `lastContactDate`.

---

### 3.5 Telephony & Calling Console

#### `CRM-REQ-005` — Telecalling Console with Metadata Logging
- **User Story:** As a telecaller, I need a quick-dial console to initiate outbound calls to leads, record call duration, set call disposition (Connected, Busy, No Answer), and log notes.
- **Design Spec:** `src/components/calling/CallConsoleModal.tsx`, `src/components/calling/CallsView.tsx`.
- **Implementation Artifacts:**
  - `src/components/calling/CallConsoleModal.tsx`, `src/components/calling/CallsView.tsx`.
  - `server.ts`: `GET /api/calls`, `POST /api/calls`.
  - `server/db/schema.ts`: `calls` table (lead_id, rep_id, duration, outcome, recording_url, compliance_flags).
- **Verification Tests:**
  - `tests/auth-and-compliance.test.ts` (Call creation, rep identity binding).
- **Status:** **`PARTIAL` / `SIMULATED`**
- **Notes:** Call records and metadata are **`REAL`** and stored in PostgreSQL. However, telephony audio connection is **`SIMULATED`** (no real WebRTC or PSTN/SIP gateway integration such as Twilio or Exotel). Recordings are simulated flags.

---

### 3.6 WhatsApp Messaging & Template Delivery

#### `CRM-REQ-006` — WhatsApp Business API Messaging & Delivery Tracking
- **User Story:** As a sales agent, I need to send conversational WhatsApp messages and pre-approved templates to leads and monitor delivery status (Sent, Delivered, Read, Failed).
- **Design Spec:** `src/components/whatsapp/WhatsAppView.tsx`; `server.ts`.
- **Implementation Artifacts:**
  - `src/components/whatsapp/WhatsAppView.tsx`.
  - `server.ts`: `GET /api/messages`, `POST /api/messages`, `POST /api/messages/reply`.
  - `server/db/schema.ts`: `messages` table (channel, direction, text, delivery_status, template_id).
- **Verification Tests:**
  - `tests/auth-and-compliance.test.ts` (Message dispatch and lead opt-out blocking).
- **Status:** **`PARTIAL` / `SIMULATED`**
- **Notes:** In-CRM message history, lead binding, and delivery status analytics are **`REAL`** in PostgreSQL. Upstream Meta WhatsApp Cloud API dispatch is **`SIMULATED`** when `WHATSAPP_API_TOKEN` is unset in development.

---

### 3.7 Trust & Compliance Center (Quiet Hours & Fatigue Capping)

#### `CRM-REQ-007` / `CRM-SEC-003` / `CRM-PRIV-001` — Automated Telecom & Privacy Outreach Guardrails
- **User Story:** As a compliance officer, the system must automatically block outbound calls and WhatsApp messages outside permitted hours (09:00 - 19:00 IST), enforce a maximum of 3 call attempts per day, and strictly reject outreach to opted-out leads.
- **Design Spec:** `server/compliance.ts`; `server/services/complianceService.ts`; `BRAIN/DATA-PRIVACY-SPECIFICATION.md`.
- **Implementation Artifacts:**
  - `server/compliance.ts`: `isQuietHours()`, `evaluateCompliance()`, `validateLeadCommunicationCompliance()`.
  - `server/services/complianceService.ts`: `canContactLead()`.
  - `server.ts`: Gated in `POST /api/calls` and `POST /api/messages` returning `403 Forbidden` (`LEAD_OPTED_OUT`, `QUIET_HOURS_ACTIVE`, `CALL_CAP_EXCEEDED`).
  - `src/components/compliance/TrustComplianceView.tsx`.
- **Verification Tests:**
  - `tests/auth-and-compliance.test.ts` (Category 4: Lead Outreach Compliance Enforcement).
  - `security-tests/compliance.test.ts` (Quiet hours, timezone edge cases, fatigue caps).
- **Status:** **`REAL`**
- **Notes:** Fully enforced server-side before call or message record insertion. Cannot be bypassed by frontend tampering.

---

### 3.8 Role-Based Access Control (RBAC) & Authorization Engine

#### `CRM-REQ-008` / `CRM-SEC-004` — Fine-Grained Hierarchical Role Authorization
- **User Story:** As an administrator, I need fine-grained role permissions (`telecaller`, `tl`, `tl_head`, `it`, `owner`, `cto`, `platform_staff`) governing lead access (SELF vs TEAM vs ALL), export rights, and configuration privileges.
- **Design Spec:** `server/policy.ts`; `server/seed/defaultRolePermissions.ts`.
- **Implementation Artifacts:**
  - `server/policy.ts`: `can()`, `evaluateRoleAction()`, `actionMap`.
  - `server/auth.ts`: `authorize()`, `requireRole()`.
  - `server.ts`: Endpoint gates (`POST /api/users`, `PUT /api/settings/roles`, `POST /api/reset-data`).
  - `src/context/AuthContext.tsx`: `usePolicy()` React hook for client UI conditioning.
- **Verification Tests:**
  - `tests/auth-and-compliance.test.ts` (Category 3: Admin Route Authorization & RBAC Helpers).
  - `security-tests/authorization.test.ts` (Horizontal & vertical privilege escalation).
- **Status:** **`REAL`**
- **Notes:** Evaluated via dual-execution engine (`server/policy.ts`). Permissions stored in PostgreSQL `role_permissions` and aligned with canonical contract (`actions: Action[]`).

---

### 3.9 Operational Reporting & Leaderboards

#### `CRM-REQ-009` — Real-Time Conversion Analytics & Gamified Rep Leaderboards
- **User Story:** As a sales director, I need live conversion funnel reports, call volume metrics, hourly call activity distributions, and rep performance rankings scoped to my tenant.
- **Design Spec:** `server/db.ts` (`calculateReports()`); `src/components/reports/ReportsView.tsx`.
- **Implementation Artifacts:**
  - `server.ts`: `GET /api/reports`, `GET /api/leaderboard`.
  - `server/db.ts`: Dynamic calculation from active `leads`, `calls`, `users`, and `messages` tables.
  - `src/components/reports/ReportsView.tsx`, `src/components/leaderboard/LeaderboardView.tsx`.
- **Verification Tests:**
  - `tests/auth-and-compliance.test.ts` (`/api/reports` returns HTTP 200).
- **Status:** **`REAL`**
- **Notes:** All metrics are dynamically computed from active relational records scoped to `req.securityContext.tenantId`. Zero hardcoded stats.

---

### 3.10 Support Ticketing & SLA Tracking

#### `CRM-REQ-010` — Integrated Customer Support Ticketing with SLA Timers
- **User Story:** As a support agent, I need to create, track, assign, and resolve customer support tickets linked to leads, with automated SLA due timers and chronological reply threads.
- **Design Spec:** `server/db/schema.ts` (`tickets`, `ticket_replies`); `src/components/support/SupportView.tsx`.
- **Implementation Artifacts:**
  - `server.ts`: `GET /api/tickets`, `POST /api/tickets`, `POST /api/tickets/:id/reply`, `PUT /api/tickets/:id`.
  - `src/components/support/SupportView.tsx`.
- **Verification Tests:**
  - Integration verified via `npm test` and build checks.
- **Status:** **`REAL`**
- **Notes:** Multi-tenant isolated, persisted in PostgreSQL `tickets` and `ticket_replies` tables.

---

### 3.11 Background Job Processing & Queue Architecture

#### `CRM-REQ-011` / `CRM-INFRA-001` — BullMQ Redis Distributed Queue for Asynchronous Operations
- **User Story:** As an enterprise user, heavy operations like lead bulk imports, large CSV exports, and batch lead reassignments must process asynchronously in the background without blocking the HTTP event loop.
- **Design Spec:** `server/jobs/queue.ts`, `server/jobs/worker.ts`; `docs/TECHNICAL_TRUTH_AUDIT.md` §1.
- **Implementation Artifacts:**
  - `server/jobs/queue.ts`: BullMQ queue initialization (`crmQueue`).
  - `server/jobs/worker.ts`: Worker process executing `exportLeads`, `importLeads`, `bulkUpdate`.
  - `server/repositories/jobRepository.ts`: Database job status tracking (`background_jobs`).
- **Verification Tests:**
  - `security-tests/jobs.test.ts`.
  - `security-tests/redis-infrastructure.test.ts`.
- **Status:** **`PARTIAL` / `DEGRADED MODE`**
- **Notes:** Code is **`REAL`**. However, if `REDIS_URL` is unconfigured, worker shuts down and jobs queue in degraded state without an in-memory processor.

---

### 3.12 AI Audio Transcription & Rate Limiting

#### `CRM-REQ-012` — Server-Side AI Transcription with Quota Guardrails
- **User Story:** As a sales manager, call audio recordings should be automatically transcribed into text summaries using Gemini AI, with strict per-tenant monthly spend caps and rate limits.
- **Design Spec:** `server/services/ai/`; `docs/PRODUCTION_SECURITY_AUDIT.md` §2.
- **Implementation Artifacts:**
  - `server/services/ai/aiService.ts`, `server/services/ai/aiProvider.ts`, `server/services/ai/aiConfig.ts`.
  - `server.ts`: `POST /api/ai/transcribe`.
  - `server/db/schema.ts`: `ai_usage` table.
- **Verification Tests:**
  - Tested in `server/services/ai/aiService.ts` error handling and quota verification routines.
- **Status:** **`PARTIAL` / `SIMULATED`**
- **Notes:** AI pipeline, cost tracking in `ai_usage`, and server-side proxy are **`REAL`**. If `GEMINI_API_KEY` is not present, or if upstream model quota is exceeded, returns simulated transcript gracefully without crashing.

---

### 3.13 Platform Staff Administration & SOC Monitoring

#### `CRM-REQ-013` — Cross-Tenant Super-Admin Dashboard & Threat Intelligence
- **User Story:** As DialPulse platform staff, I need a centralized portal to monitor cross-tenant health, inspect security alerts, review tenant subscription status, and temporarily impersonate tenants for support investigations.
- **Design Spec:** `src/components/platform/PlatformDashboardView.tsx`; `server.ts`.
- **Implementation Artifacts:**
  - `server.ts`: `GET /api/platform/tenants`, `POST /api/platform/tenants/:id/suspend`, `POST /api/platform/impersonate`.
  - `src/components/platform/PlatformDashboardView.tsx`.
- **Verification Tests:**
  - `security-tests/authorization.test.ts` (Restricted platform routes, non-staff 403).
- **Status:** **`PARTIAL`**
- **Notes:** Tenant suspension, directory, and impersonation session generation are **`REAL`**. Telemetry alerts (`/api/platform/soc/alerts`) and billing endpoints currently return placeholder structures.

---

### 3.14 Audit Trail & Security Telemetry

#### `CRM-REQ-014` / `CRM-SEC-005` — Tamper-Resistant Structured Audit Logging
- **User Story:** As a compliance and security officer, all sensitive mutations (logins, logouts, lead creations, deletions, exports, privilege changes) must be permanently logged with request IP, actor ID, and correlation ID.
- **Design Spec:** `server/services/auditService.ts`; `docs/PRODUCTION_SECURITY_AUDIT.md` §3.
- **Implementation Artifacts:**
  - `server/services/auditService.ts`: `logCritical()`, `logNormal()`.
  - `server.ts`: `GET /api/audit-logs`.
  - `server/db/schema.ts`: `audit_logs` table (occurred_at, event_type, actor_user_id, client_ip, metadata).
  - `src/components/audit/ActivityLogsView.tsx`.
- **Verification Tests:**
  - `security-tests/observability.test.ts` (Audit log generation, PII exclusion).
  - `tests/auth-and-compliance.test.ts` (`/api/audit-logs` verification).
- **Status:** **`REAL`**
- **Notes:** Fully persisted in PostgreSQL `audit_logs` table; viewable by authorized administrators.

---

### 3.15 Anti-Scraping & Crawler Deterrence

#### `CRM-REQ-015` / `CRM-SEC-006` — Client-Side Anti-Debugging & Automated Scraper Blocking
- **User Story:** As a SaaS platform operator, malicious AI web crawlers and unauthorized automated scrapers must be blocked from harvesting lead or platform intelligence.
- **Design Spec:** `src/utils/deterrence.ts`; `server/crawlerAgents.ts`; `robots.txt`.
- **Implementation Artifacts:**
  - `robots.txt`: Disallow directives for aggressive AI web scrapers.
  - `server.ts`: Anti-crawler User-Agent screening middleware.
  - `src/utils/deterrence.ts`: Client-side automation heuristics, debugger deterrence.
- **Verification Tests:**
  - `tests/deterrence-and-crawlers.test.ts`.
- **Status:** **`REAL`**
- **Notes:** Verified active; passes automated unit test suite.

---

## 4. Traceability Gap & Debt Summary

| Requirement ID | Subsystem | Ground Reality | Remediation Target | Priority |
| :--- | :--- | :--- | :--- | :--- |
| `CRM-REQ-005` | Telephony Console | Calling metadata is real; audio stream is simulated. | Integrate WebRTC / Twilio / Exotel gateway. | Medium |
| `CRM-REQ-006` | WhatsApp API | In-CRM messages real; Meta API dispatch simulated without key. | Connect production Meta WhatsApp Cloud API credentials. | Medium |
| `CRM-REQ-011` | Background Jobs | BullMQ code real; requires active Redis container to process. | Provide in-memory fallback processor when Redis offline. | High |
| `CRM-REQ-012` | AI Transcription | Logic real; upstream Gemini quota can throttle audio summaries. | Implement multi-provider fallback (Whisper / Deepgram). | Low |
| `CRM-REQ-013` | SOC Alerts | Endpoints return empty dummy structures. | Connect live PostgreSQL `security_alerts` query. | Medium |

---

## 5. Traceability Governance Rule

No requirement may be marked `REAL` in this matrix without:
1. Executable code present in `server/` or `src/`.
2. Active persistence in PostgreSQL via `server/db/schema.ts`.
3. At least one passing automated test in `tests/` or `security-tests/`.
4. Peer review and technical truth confirmation.
