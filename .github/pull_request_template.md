## Pull Request Description

### 1. Requirement & Objective
- **Requirement ID:** `CRM-REQ-____` / `CRM-SEC-____` / `CRM-HOTFIX-____`
- **User / Business Problem:** 
- **Summary of Changes:** 

---

### 2. Change Risk Classification
- [ ] **Level 1 — Low Risk** (Copy, typography, non-functional styling, docs)
- [ ] **Level 2 — Medium Risk** (UI component logic, internal utility, non-breaking API)
- [ ] **Level 3 — High Risk** (Core business logic, RBAC, tenant middleware, database schema, calling compliance)
- [ ] **Level 4 — Critical Risk** (Authentication, session tokens, platform impersonation, data deletion, root infra)

---

### 3. Affected Subsystems
- [ ] Frontend UI Components (`src/components/`)
- [ ] API Controllers / Routes (`server.ts`, `server/routes/`)
- [ ] Authentication / Policy / RBAC (`server/auth.ts`, `server/policy.ts`)
- [ ] Database Schema / Drizzle Migrations (`server/db/schema.ts`, `server/db/migrations/`)
- [ ] Background Jobs / Redis (`server/jobs/`, `server/infrastructure/`)
- [ ] Trust & Compliance Rules (`server/compliance.ts`)
- [ ] Documentation / Audits (`docs/`, `BRAIN/`)

---

### 4. Architectural & Safety Verification

#### Multi-Tenant Isolation
- [ ] All database queries explicitly scope to `tenant_id` (`eq(table.tenantId, req.securityContext.tenantId)`).
- [ ] Verified zero cross-tenant IDOR leakage on newly touched endpoints.
- [ ] Verified platform staff impersonation logging (if applicable).

#### Database Impact
- [ ] Schema changes (if any) defined via Drizzle ORM in `server/db/schema.ts`.
- [ ] Non-breaking schema change verified (nullable columns or safe defaults).
- [ ] Rollback strategy defined and tested.
- [ ] No raw concatenated SQL queries used.

#### Security & Privacy Impact
- [ ] No hardcoded API keys, bearer tokens, or secrets committed.
- [ ] No customer PII logged in plaintext console outputs or audit logs.
- [ ] Input sanitization applied (formula injection prevention, SQL injection defense).
- [ ] Role authorization verified via `policy.can()`.

#### UX & Design System Impact
- [ ] Adheres to Zero-Pill discipline (no static `rounded-full bg-*-100` badges).
- [ ] Respects M3 elevation surfaces (`#F8FAF8` / `#111413`).
- [ ] Loading, Empty, and Error states handled.
- [ ] Responsive across mobile (360px+) and desktop viewports.
- [ ] Accessible keyboard navigation and focus rings verified.

---

### 5. Automated Verification Evidence
- [ ] `npm run lint` — **Passed with 0 errors**
- [ ] `npm run build` — **Passed (Vite + ESBuild)**
- [ ] `npm test` — **100% Passed**
- [ ] `npm run test:security` — **38 / 38 Passed (Zero Vulnerabilities)**

*Paste relevant test output or execution summary below:*
```text
```

---

### 6. Documentation & Traceability
- [ ] Updated `docs/REQUIREMENT-TRACEABILITY.md` with current feature status.
- [ ] Updated `docs/TECHNICAL_TRUTH_AUDIT.md` (if architectural reality changed).
- [ ] Release checklist item noted (if applicable).
