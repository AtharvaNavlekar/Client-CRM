# DialPulse Client CRM — Engineering SDLC Baseline Assessment

> **Document ID:** DOC-BASE-001  
> **Status:** APPROVED BASELINE  
> **Target Scope:** DialPulse Client CRM (`AtharvaNavlekar/CRM.git`)  
> **Audit Date:** October 2026  
> **Governing Framework:** `BRAIN/SDLC-PLAYBOOK.md`  
> **Classification Legend:**  
> - `REAL` — Active in executable code, verified in PostgreSQL schema and passing tests.  
> - `PARTIAL` — Active core path, but secondary edge cases or background processing pending.  
> - `SIMULATED` — Functional stub, synthetic responses, or mock fallback.  
> - `LEGACY` — Retained historical relic from prior iterations.  
> - `MISSING` — Acknowledged gap or absent capability.

---

## 1. Executive Summary

This document establishes the official **Engineering SDLC Baseline** for the DialPulse Client CRM repository. The application originated as a high-velocity prototype and evolved into a robust, security-hardened SaaS codebase featuring production-grade multi-tenant boundaries, RBAC authorization, automated telecom compliance, and anti-scraping deterrence.

With the establishment of **STEP 1: ESTABLISH THE ENGINEERING LIFECYCLE**, the project transitions from ad-hoc feature additions to a disciplined, auditable, evidence-based engineering process.

---

## 2. Current Repository & Technical Profile

| Metric / Dimension | Baseline State | Ground Truth Classification |
| :--- | :--- | :--- |
| **Repository Name** | `DialPulse Client CRM` (`AtharvaNavlekar/CRM.git`) | `REAL` |
| **Primary Language** | TypeScript 5.8.2 (Strict null checks, `noEmitOnError`) | `REAL` |
| **Backend Runtime** | Node.js v20+ LTS / Express 4.21.2 | `REAL` |
| **Frontend Framework** | React 19.0.0 / Vite 6.2.3 / ESBuild | `REAL` |
| **Styling & Design System** | Tailwind CSS 4.1.14 / Material Design 3 (M3) Surface Tokens | `REAL` |
| **Database & ORM** | PostgreSQL 15 / Drizzle ORM (`drizzle-orm/pg-core`) | `REAL` |
| **Distributed Jobs / Cache** | BullMQ 5.41.0 / Redis 7 (`ioredis`) | `PARTIAL` *(Degraded when Redis absent)* |
| **External AI Integration**| `@google/genai` (Gemini 2.5 Flash) | `PARTIAL` *(Graceful simulated fallback)* |
| **Build & Bundle Pipeline** | Vite SSR/SPA build + ESBuild server bundling (`dist/`) | `REAL` |
| **Package Management** | Bun lockfile (`bun.lock`) with npm compatibility | `REAL` |

---

## 3. Architecture & Subsystem Baseline

### 3.1 Persistence & Data Architecture
- **Schema & Tables:** 18 relational PostgreSQL tables declared in `server/db/schema.ts` covering `users`, `tenants`, `teams`, `leads`, `calls`, `messages`, `tickets`, `ticket_replies`, `audit_logs`, `impersonation_sessions`, `security_alerts`, `billing_records`, `feature_flags`, `role_permissions`, `custom_fields`, `pipeline_stages`, `ai_usage`, and `sessions`.
- **Database Client:** Initialized via `postgres.js` in `server/db/client.ts`. Diagnostic connection probe (`server/db/diagnostics.ts`) runs at startup to detect configuration or network anomalies.
- **Resilience:** Implements seed data fallback when PostgreSQL is temporarily unreachable in developer preview mode, ensuring server bootability.

### 3.2 Authentication & Authorization (RBAC)
- **Password Security:** Salted bcrypt password hashing (work factor 10). Plaintext passwords are never persisted.
- **Session Tokens:** Cryptographically signed JWT access tokens (15-minute lifespan) paired with opaque, SHA-256 hashed refresh tokens. Refresh token rotation detects and revokes reused families.
- **Authorization Engine:** Dual-execution RBAC engine in `server/policy.ts` (`can()`) evaluating hierarchical scopes (`SELF`, `TEAM`, `ALL`) and action permissions (`leads:view`, `leads:create`, `leads:update`, `leads:delete`, `settings:manage`).
- **Tenant Middleware:** `server/tenantMiddleware.ts` enforces tenant isolation, rejects cross-tenant header tampering, locks out suspended tenants, and audits platform staff impersonation sessions.

### 3.3 Sales Outreach & Compliance Guardrails
- **Quiet Hours:** Server-enforced ban on outbound calls and WhatsApp messages outside 09:00 - 19:00 IST.
- **Fatigue Capping:** Server limits daily outbound call attempts to 3 per lead.
- **DND / Opt-Out Registry:** Leads with `isOptedOut: true` are blocked at the controller layer with HTTP 403 `LEAD_OPTED_OUT`.

---

## 4. Current Testing & Security Baseline

### 4.1 Automated Test Harness
1. **Integration & Compliance Suite (`npm test`):**
   - File: `tests/auth-and-compliance.test.ts`.
   - Coverage: 16 assertions validating bcrypt hashing, JWT validation, token tampering, algorithm "none" protection, admin route guards, quiet hours, and opt-out blocking.
2. **Crawler & Deterrence Suite:**
   - File: `tests/deterrence-and-crawlers.test.ts`.
   - Coverage: Validates anti-scraper headers, robots.txt directives, and client-side anti-debugging heuristics.
3. **Adversarial Security Harness (`npm run test:security`):**
   - File: `security-tests/run-all.ts`.
   - Coverage: 38 automated checks across 10 specialized modules:
     - Authentication & password complexity
     - Authorization, IDOR, and tenant isolation
     - Quiet hours and compliance time travel
     - Production build secret leakage scanning
     - SQL and formula injection prevention
     - Rate-limiting and burst protection
     - Redis infrastructure and key isolation
     - BullMQ queue security
     - Structured audit logging and PII redaction
     - PostgreSQL logical backup dump and checksum verification.

### 4.2 Security Audit Benchmark
- Validated via `docs/PRODUCTION_SECURITY_AUDIT.md`:
  - 0 Critical, 0 High, 0 Medium, 0 Low vulnerabilities detected across active security test runs.
  - Zero secrets exposed in production client bundle `dist/assets/*.js`.

---

## 5. Known Technical Debt & Product-Truth Discrepancies

Derived from `docs/TECHNICAL_TRUTH_AUDIT.md`:

| Subsystem | Documented Claim | Ground Technical Truth | Classification | Remediation Plan |
| :--- | :--- | :--- | :--- | :--- |
| **Telephony Audio** | Real-time call streaming and recording playback. | Metadata logging only (`POST /api/calls`). No WebRTC or PSTN integration. Recordings are simulated flags. | `SIMULATED` | Integrate Twilio / Exotel gateway in Phase 4 of telecom roadmap. |
| **WhatsApp Dispatch** | Live Meta WhatsApp Cloud API messaging. | In-CRM messages real; external dispatch simulated when `WHATSAPP_API_TOKEN` is unset. | `SIMULATED` | Add production WhatsApp Cloud API credentials. |
| **Background Jobs** | BullMQ workers process all heavy CSV imports and exports. | BullMQ queue code is real; shuts down gracefully if Redis is unconfigured, leaving jobs queued. | `PARTIAL` | Implement an in-memory worker fallback for standalone environments. |
| **SOC Alerts & Billing**| Real-time threat feed and subscription billing dashboard. | Endpoints `/api/platform/soc/alerts` and `/api/platform/billing` return dummy placeholder structures. | `SIMULATED` | Wire up active PostgreSQL `security_alerts` and `billing_records` tables. |
| **Concurrency Control**| Optimistic locking prevents simultaneous lead overwrite. | No version column check in `server.ts`; updates overwrite blindly. | `MISSING` | Add `version` column and check `eq(leads.version, expectedVersion)`. |

---

## 6. SDLC Process Maturity Rating

We evaluate the current engineering maturity of the Client CRM repository across standard CMMI/DORA-aligned SDLC dimensions:

| SDLC Dimension | Maturity Level (1-5) | Assessment & Current Reality |
| :--- | :---: | :--- |
| **1. Requirements & Traceability** | **Level 3 (Defined)** | Standardized requirement IDs (`CRM-REQ-*`), master matrix (`docs/REQUIREMENT-TRACEABILITY.md`), and GitHub issue templates now established. |
| **2. Architectural Design** | **Level 4 (Managed)** | Drizzle ORM PostgreSQL schema, M3 surface token specifications (`BRAIN/CRM-PRODUCT-ELEVATION.md`), and strict multi-tenant boundary models. |
| **3. Implementation & Code Quality** | **Level 4 (Managed)** | Strict TypeScript compiler rules, clean module organization, zero-pill UI guidelines, structured logging. |
| **4. Testing & Verification** | **Level 4 (Managed)** | Multi-tier test suite: type checks, integration tests (`npm test`), and 38 adversarial security tests (`npm run test:security`). |
| **5. Security & Privacy SDLC** | **Level 4 (Managed)** | Server-side RBAC, bcrypt passwords, automated secret scanning in builds, TRAI compliance, and PII redaction. |
| **6. Release & Deployment** | **Level 3 (Defined)** | Strict release checklist (`docs/RELEASE-CHECKLIST.md`), ESBuild + Vite bundling, automated rollback guidelines. |
| **7. Monitoring & Incident Handling** | **Level 2 (Repeatable)**| Structured JSON logging and Prometheus metric stubs; full SOC telemetry integration pending. Emergency hotfix workflow defined. |
| **8. Change Management & Governance**| **Level 4 (Managed)** | Formal Master SDLC Playbook (`BRAIN/SDLC-PLAYBOOK.md`), PR templates, Definition of Ready, Definition of Done. |

**Overall SDLC Maturity Score: 3.5 / 5.0 (Enterprise-Ready Transition)**

---

## 7. Immediate Process Gaps & Action Items

To maintain this engineering baseline, all future CRM development must follow these rules:

1. **Sprint Planning:** No task begins without an assigned Requirement ID and satisfied Definition of Ready.
2. **Technical Truth Discipline:** Never mark a feature "Done" or document it as "Production Ready" if it relies on simulated stubs without explicit notation in `docs/REQUIREMENT-TRACEABILITY.md`.
3. **Database Guardrail:** All future schema adjustments must be reviewed under the Database Change Gate in `BRAIN/SDLC-PLAYBOOK.md` §11.
4. **Adversarial Gate:** Every pull request touching authentication, authorization, or tenant boundaries must execute `npm run test:security`.
