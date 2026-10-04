# DialPulse Client CRM — Multi-Tier Quality Assurance & Test Strategy

> **Document ID:** DOC-TEST-001  
> **Status:** APPROVED & MANDATORY  
> **Target Scope:** DialPulse Client CRM (`AtharvaNavlekar/CRM.git`)  
> **Governing Framework:** `BRAIN/SDLC-PLAYBOOK.md` (Phase 6 — Testing)  
> **Related Documents:**  
> - `docs/TECHNICAL_TRUTH_AUDIT.md`  
> - `docs/PRODUCTION_SECURITY_AUDIT.md`  
> - `docs/REQUIREMENT-TRACEABILITY.md`  
> - `docs/RELEASE-CHECKLIST.md`

---

## 1. Quality Mission & Testing Philosophy

Quality in DialPulse CRM is an active engineering constraint, not a retroactive audit. Because the CRM handles sensitive telecalling logs, WhatsApp customer communications, and strict multi-tenant boundaries, our testing strategy enforces:

1. **Defense-in-Depth:** Every critical boundary (auth, tenant isolation, compliance rules) is tested at multiple distinct layers.
2. **Zero Regressions on Security:** All 38 adversarial security assertions in `security-tests/` must pass before any production deployment.
3. **No Flaky Tests:** Tests must execute deterministically; race conditions or asynchronous timing flakiness must be remediated at the root cause.
4. **Leverage Existing Tooling:** Rather than introducing bloated, heavy test frameworks, we leverage high-performance TypeScript runners (`tsx`, Node test runner, ESBuild) and native assertions already established in the codebase.

---

## 2. Multi-Layer Testing Architecture

```
┌────────────────────────────────────────────────────────┐
│ 1. STATIC TYPE & LINT CHECKS (TypeScript / ESLint)     │
├────────────────────────────────────────────────────────┤
│ 2. UNIT TESTS (Pure Functions, Heuristics, Math)       │
├────────────────────────────────────────────────────────┤
│ 3. API & INTEGRATION TESTS (Routes, Sessions, Authz)   │
├────────────────────────────────────────────────────────┤
│ 4. ADVERSARIAL SECURITY HARNESS (IDOR, Tampering, RBAC)│
├────────────────────────────────────────────────────────┤
│ 5. UI COMPONENT & STATE TESTS (React 19 / Vite)        │
├────────────────────────────────────────────────────────┤
│ 6. PERFORMANCE, ACCESSIBILITY & E2E REVIEWS            │
└────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Testing Layers & Mapping

### LAYER 1 — Static Type Verification & Code Quality
- **Focus:** Complete TypeScript type safety, unhandled `any` types, missing exports, and syntax correctness.
- **Tooling:** `tsc --noEmit` via `npm run lint`.
- **Scope:** Entire codebase (`src/`, `server/`, `tests/`, `security-tests/`).
- **Gate:** 0 errors permitted. Build fails if lint fails.
- **Execution:** Pre-commit, PR CI check, pre-build.

---

### LAYER 2 — Unit Testing
- **Focus:** Pure algorithms, mathematical functions, string sanitization, and compliance heuristics that execute in isolation without network or database dependencies.
- **Tooling:** `tsx` execution of isolated unit suites.
- **Active Suites:**
  - `tests/deterrence-and-crawlers.test.ts`: Validates crawler detection patterns, user-agent parsing, and client-side anti-debugging heuristics (`src/utils/deterrence.ts`).
  - Unit assertions in `server/compliance.ts`: Validates `isQuietHours()`, call fatigue caps, and date manipulation logic.
- **Target Pass Rate:** 100%.

---

### LAYER 3 — API & Integration Testing
- **Focus:** End-to-end HTTP request/response lifecycles, Express middleware chaining, JWT token issuance, session refresh rotation, and database interaction.
- **Tooling:** `tsx tests/auth-and-compliance.test.ts` via `npm test`.
- **Active Suites:**
  - `tests/auth-and-compliance.test.ts`:
    - **Category 1:** Password authentication, bcrypt hashing, invalid credentials rejection.
    - **Category 2:** JWT token validation, missing header rejection, tampered signatures, algorithm "none" bypass defense, expired token handling, and revoked session rejection.
    - **Category 3:** Admin route authorization and RBAC helpers (`POST /api/users`, `PUT /api/settings/roles`, `PUT /api/settings/fields`, `POST /api/reset-data`).
    - **Category 4:** Lead outreach compliance enforcement (opt-out blocking, quiet hours 403, fatigue cap enforcement).
- **Execution:** Mandated for every Pull Request and release candidate.

---

### LAYER 4 — Adversarial Security Harness
- **Focus:** Automated adversarial penetration testing, privilege escalation verification, secrets leakage scanning, and tenant isolation validation.
- **Tooling:** `tsx security-tests/run-all.ts` via `npm run test:security`.
- **Active Modules:**
  1. `security-tests/auth.test.ts`: Token tampering, brute-force simulation, password complexity.
  2. `security-tests/authorization.test.ts`: Horizontal tenant hopping, vertical role escalation, IDOR on leads/calls/tickets.
  3. `security-tests/compliance.test.ts`: Quiet hours time travel, cross-timezone compliance validation.
  4. `security-tests/config-secrets.test.ts`: Static bundle scanning of `dist/assets/` to ensure zero exposed API keys or credentials.
  5. `security-tests/input-validation.test.ts`: SQL injection, formula injection (`=cmd`), NoSQL injection, XSS payloads.
  6. `security-tests/rate-limiting.test.ts`: Burst request protection, auth endpoint throttling.
  7. `security-tests/redis-infrastructure.test.ts`: Redis connection degradation, safe key namespacing.
  8. `security-tests/jobs.test.ts`: BullMQ queue isolation, worker job handling.
  9. `security-tests/observability.test.ts`: PII exclusion in logs, structured JSON format, correlation ID tracing.
  10. `security-tests/backup-restore.test.ts`: PostgreSQL logical dump creation and checksum verification.
- **Target Pass Rate:** 100% (All 38 automated checks). Zero vulnerabilities permitted.

---

### LAYER 5 — Regression Testing
- **Focus:** Ensuring that new features, schema updates, or refactors do not break previously stable CRM workflows.
- **Procedure:**
  - Run full test harness (`npm test` and `npm run test:security`).
  - Verify core operational endpoints via health check and seed verification:
    - `/api/auth/me`
    - `/api/leads`
    - `/api/calls`
    - `/api/messages`
    - `/api/reports`
    - `/api/tickets`
    - `/api/audit-logs`
- **Trigger:** Any Level 2, 3, or 4 change.

---

### LAYER 6 — UI & Component Testing
- **Focus:** Type-safe React 19 component rendering, M3 token compliance, Zero-Pill design verification, and responsive layouts.
- **Tooling:** Vite build pipeline (`npm run build`) and developer preview verification.
- **Criteria:**
  - Zero bundle warnings or unresolvable imports.
  - Proper fallback rendering: Skeletons (`M3Skeleton.tsx`), Empty states, Error boundaries.
  - Verification against `BRAIN/CRM-PRODUCT-ELEVATION.md`.

---

### LAYER 7 — End-to-End (E2E) & User Acceptance Testing
- **Focus:** Validating real user journeys against business acceptance criteria across user personas:
  - **Persona 1: Telecaller:** Logs in -> views assigned leads -> dials lead via console -> logs disposition -> sends WhatsApp template -> checks personal stats.
  - **Persona 2: Team Lead:** Reviews team Kanban -> reassigns uncontacted leads -> monitors leaderboard -> exports weekly call summary.
  - **Persona 3: Administrator / Owner:** Configures custom lead fields -> updates pipeline stages -> inspects audit logs -> reviews compliance caps.
  - **Persona 4: Platform Staff:** Accesses `/platform` -> reviews cross-tenant directory -> tests impersonation flow -> verifies isolation.
- **Environment:** Staging / AI Studio Preview Environment.

---

### LAYER 8 — Performance & Resource Testing
- **Focus:** Latency under load, database query performance, bundle size limits, and memory utilization.
- **Benchmarks:**
  - Production frontend bundle: Gzip transfer size < 400 kB for core vendor/app chunks.
  - API response p95 latency: < 150ms for relational queries; < 300ms for aggregate report calculations.
  - Database pool: No connection pool leaks under 50 concurrent requests.

---

### LAYER 9 — Accessibility (a11y) Testing
- **Focus:** WCAG 2.1 AA compliance for sales rep productivity.
- **Checklist:**
  - Full keyboard navigation across Kanban columns and table rows.
  - Visible focus indicators on all interactive buttons and inputs (`focus-visible:ring-2`).
  - Minimum color contrast ratio of 4.5:1 on light and dark surfaces.
  - Accessible names and ARIA tags on icon-only action buttons.

---

## 4. Test Execution Matrix

| Test Command | Scope | Duration | Mandated Stage | Failure Policy |
| :--- | :--- | :--- | :--- | :--- |
| `npm run lint` | TypeScript Type Check | ~3s | Pre-commit, PR CI | Block merge |
| `npm run build` | Vite + ESBuild Production Build | ~8s | Pre-commit, PR CI | Block merge |
| `npm test` | Auth, Compliance & Integration | ~5s | PR CI, Release Gate | Block merge / release |
| `npm run test:security` | 38 Adversarial Security Checks | ~12s | PR CI, Release Gate | Block merge / release |
| `scripts/backup.ts` | Backup Dump & Checksum Test | ~5s | Pre-release (Level 3/4) | Block release |

---

## 5. Defect Management & Severity Protocol

When a test failure or defect is identified:

| Severity | Definition | SLA / Resolution Time | Action Required |
| :--- | :--- | :--- | :--- |
| **P0 — CRITICAL** | Security boundary breach, cross-tenant leakage, data corruption, total system crash. | Immediate (< 4 hours) | Deploy emergency hotfix (`CRM-HOTFIX-*`); freeze all other merges. |
| **P1 — HIGH** | Core workflow blocked (cannot log calls, send WhatsApp, or create leads). | < 24 hours | Block current release; prioritize fix in active sprint. |
| **P2 — MEDIUM** | Non-critical feature degraded (e.g. reporting chart glitch, filter edge case). | Next regular sprint | Create bug ticket with reproducing test case. |
| **P3 — LOW** | Minor cosmetic defect, non-blocking UI alignment, minor copy error. | Backlog | Schedule in maintenance cycle. |

---

## 6. Flaky Test Mitigation Policy

A test is classified as **flaky** if it produces different outcomes without code changes.
1. **Zero Tolerance:** Flaky tests must not be ignored or commented out.
2. **Quarantine Procedure:** If a test cannot be fixed immediately, it must be quarantined into a tracked issue with an assigned engineer and fixed within 48 hours.
3. **Common Causes in DialPulse CRM:**
   - Database state leakage between test cases: Resolved by utilizing deterministic setup/teardown transactions or isolated test tenant IDs (`tenant-test-*`).
   - Asynchronous timing in BullMQ/Redis: Resolved by awaiting job completion events rather than arbitrary `setTimeout`.
