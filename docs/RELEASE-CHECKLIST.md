# DialPulse Client CRM — Production Release Checklist & Verification Gate

> **Document ID:** DOC-REL-001  
> **Status:** MANDATORY PRE-FLIGHT STANDARD  
> **Target Scope:** DialPulse Client CRM (`AtharvaNavlekar/CRM.git`)  
> **Governing Framework:** `BRAIN/SDLC-PLAYBOOK.md` (Phase 9 — Release)  
> **Rule:** Never mark a release "Production Ready" or deploy to production unless EVERY item on this checklist is explicitly verified and signed off.

---

## 1. Release Metadata & Identification

*Fill this metadata block for every production deployment.*

- **Release Version / Tag:** `v_____________`
- **Release Candidate Commit SHA:** `________________________________________`
- **Target Deployment Date/Time:** `YYYY-MM-DD HH:MM UTC`
- **Release Engineer / Owner:** `_____________________________`
- **Lead Security Reviewer:** `_____________________________`
- **Included Requirement IDs:**
  - [ ] `CRM-REQ-_____`: __________________________________________________
  - [ ] `CRM-REQ-_____`: __________________________________________________
  - [ ] `CRM-SEC-_____`: __________________________________________________
- **Change Risk Level:**
  - [ ] Level 1 (Low)  
  - [ ] Level 2 (Medium)  
  - [ ] Level 3 (High)  
  - [ ] Level 4 (Critical)

---

## 2. Pre-Release Verification Checklist

### 2.1 Requirements & Scope Completeness
- [ ] All scoped Requirement IDs have clear Acceptance Criteria.
- [ ] Every Acceptance Criterion is fulfilled in executable code (not mock UI).
- [ ] `docs/REQUIREMENT-TRACEABILITY.md` has been updated with the accurate status (`REAL`, `PARTIAL`, `SIMULATED`).
- [ ] Out-of-scope modifications have been removed from the release branch.

### 2.2 Code Quality & Static Typing
- [ ] `npm run lint` executed locally and in CI. Result: **0 errors, 0 warnings**.
- [ ] No unhandled `any` types or `@ts-ignore` comments introduced.
- [ ] Code formatting and conventional commit messages verified.

### 2.3 Automated Testing Gates
- [ ] Unit & Integration suite passed: `npm test` (**100% pass rate**).
- [ ] Automated security harness passed: `npm run test:security` (**38 / 38 passed, 0 vulnerabilities**).
- [ ] Zero skipped or flaky tests in the test run.
- [ ] Test execution logs attached or referenced in the Release Ticket.

### 2.4 Production Build Verification
- [ ] `npm run build` executed successfully.
- [ ] Client bundle (`dist/index.html`, `dist/assets/index-*.js`, `dist/assets/index-*.css`) created without warnings.
- [ ] Server build bundle (`dist/server.cjs`) generated cleanly via ESBuild.
- [ ] Bundle size analysis: Main JS bundle gzip size < 400 kB.

### 2.5 Security & Secret Scanning
- [ ] Static asset scan performed: No database credentials, JWT secrets, or Gemini API keys present in `dist/assets/*.js`.
- [ ] Environment variable configuration verified against `.env.example`.
- [ ] Production secrets injected securely via environment (e.g. Google Cloud Run Secret Manager / Kubernetes Secrets):
  - `DATABASE_URL` (mandatory PostgreSQL connection string)
  - `JWT_SECRET` (mandatory 512-bit cryptographically secure string)
  - `REDIS_URL` (mandatory for BullMQ background workers in production)
  - `GEMINI_API_KEY` (mandatory for AI call transcriptions)
  - `WHATSAPP_API_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID` (mandatory for live WhatsApp delivery)

### 2.6 Database & Migration Verification
- [ ] Schema changes (if any) defined strictly via Drizzle ORM in `server/db/schema.ts`.
- [ ] SQL migration generated via Drizzle Kit in `server/db/migrations/`.
- [ ] Non-breaking schema change verified (backward-compatible; nullable columns or safe defaults).
- [ ] Multi-tenant isolation verified: Every new table contains `tenant_id` foreign key.
- [ ] Pre-migration database backup taken via `scripts/backup.ts` and checksum recorded.
- [ ] Migration executed successfully on staging database without table-locking timeouts.

### 2.7 Multi-Tenant & RBAC Boundary Check
- [ ] All newly added or modified API endpoints enforce `tenantMiddleware.enforceTenantScope`.
- [ ] All database queries filter with `where(eq(table.tenantId, tenantId))`.
- [ ] Authorization checks verified via `policy.can()` in `server/policy.ts`.
- [ ] Administrative routes verified to return `403 Forbidden` for non-administrative roles.

### 2.8 UI, Accessibility & Design System
- [ ] Zero-Pill discipline respected: No heavy pill badges (`rounded-full bg-*-100`) on static metadata.
- [ ] M3 surface elevation and color tokens respected (`#F8FAF8` / `#111413`).
- [ ] All interactive elements support keyboard Tab navigation and visual focus rings.
- [ ] Mobile responsive layout verified on 360px, 390px, and 768px viewports.
- [ ] Skeletons / Shimmers displayed during asynchronous data fetching.

### 2.9 Rollback Plan & Disaster Recovery
- [ ] Step-by-step rollback procedure documented below.
- [ ] Previous stable container image tag or git SHA identified: `_________________________`
- [ ] Database rollback script or down-migration tested and ready.
- [ ] Maximum Tolerable Downtime (MTD) and Recovery Time Objective (RTO < 15 min) established.

---

## 3. Rollback Procedure (Emergency Fallback)

If any critical failure occurs during deployment (e.g. database migration deadlock, container crash loop, failed health checks):

1. **TRIGGER ABORT:** Release Owner announces deployment rollback.
2. **REVERT APPLICATION CONTAINER:** Redeploy previous stable container image tag.
3. **REVERT DATABASE MIGRATION (If Applicable):**
   - If backward-compatible migration: Leave schema intact.
   - If destructive schema failure: Execute down-migration or restore pre-migration logical dump via `scripts/restore.ts`.
4. **CLEAR REDIS CACHES & WORKERS:** Restart BullMQ queue workers.
5. **VERIFY SYSTEM HEALTH:** Confirm `/api/health` returns HTTP 200 with database status `ok`.
6. **INCIDENT POST-MORTEM:** Open P1 tracking issue and initiate Phase 12 Change Management review.

---

## 4. Post-Deployment Smoke Test (Verification in Production)

*Execute immediately upon successful deployment to production.*

| Test Step | Verification Endpoint / Action | Expected Result | Verified By |
| :--- | :--- | :--- | :--- |
| **1. Service Health** | `GET /api/health` | HTTP 200, `{ status: "ok", database: "connected" }` | [ ] |
| **2. Security Headers** | Inspect response headers via `curl -I` | Helmet headers active: `X-Content-Type-Options: nosniff`, `X-Frame-Options` | [ ] |
| **3. Web Crawler Shield**| `GET /robots.txt` | Returns Disallow rules for aggressive AI scrapers | [ ] |
| **4. Authentication** | `POST /api/auth/login` | Valid credentials return JWT access + refresh cookies | [ ] |
| **5. Invalid Auth Rejection**| `POST /api/auth/login` (bad pass) | Returns HTTP 401 `INVALID_CREDENTIALS` | [ ] |
| **6. User Profile** | `GET /api/auth/me` | Returns current user profile scoped to tenant | [ ] |
| **7. Lead List Retrieval**| `GET /api/leads` | Returns tenant leads; no cross-tenant leakage | [ ] |
| **8. Pipeline Kanban** | Access `/pipeline` in browser | Kanban board renders stages and lead cards smoothly | [ ] |
| **9. Telephony Console** | Access calling console | UI opens, dials, records duration, logs outcome | [ ] |
| **10. Compliance Gate** | Attempt call outside quiet hours | System blocks call and returns HTTP 403 `QUIET_HOURS_ACTIVE` | [ ] |
| **11. WhatsApp Message** | Send test WhatsApp template | Message logged in chat history and updates lead activity | [ ] |
| **12. Reporting Dashboard**| Access `/reports` in browser | Conversion stats, call volume charts render live metrics | [ ] |
| **13. Audit Log Stream** | `GET /api/audit-logs` | Recent login and lead interactions visible in log | [ ] |
| **14. Token Revocation** | `POST /api/auth/logout` | Token invalidated; subsequent calls return HTTP 401 | [ ] |

---

## 5. Sign-Off & Release Authorization

Release will NOT proceed to general user traffic without all three signatures:

1. **Release Engineer Sign-Off:**  
   *Name:* ___________________________ *Date:* _______________ *Signature:* _________________

2. **Security & Compliance Sign-Off:**  
   *Name:* ___________________________ *Date:* _______________ *Signature:* _________________

3. **Product Owner / Business Sign-Off:**  
   *Name:* ___________________________ *Date:* _______________ *Signature:* _________________
