---
name: Security Vulnerability Report
about: Report an authorization bypass, tenant leakage, or security flaw in DialPulse Client CRM
title: "[SECURITY] CRM-SEC-___: <Short Vulnerability Title>"
labels: ["security", "critical-review"]
assignees: ""
---

> **CONFIDENTIALITY NOTICE:** Security vulnerabilities should be handled with responsible disclosure. Ensure sensitive customer PII or active exploit payloads are redacted.

### 1. Vulnerability Metadata
- **Tracking ID:** `CRM-SEC-____`
- **Vulnerability Category:** [Authentication Bypass / IDOR / Privilege Escalation / Cross-Tenant Leakage / Secrets Exposure / Injection / Rate Limit Bypass]
- **Risk Severity:** [Level 3 (High) / Level 4 (Critical)]
- **Affected Endpoints / Files:** 

---

### 2. Threat Vector & Description
*Explain how the vulnerability operates and what an adversary could achieve:*
- **Attacker Profile:** [Unauthenticated / Authenticated Telecaller / Tenant Admin / Cross-Tenant User]
- **Exploitation Mechanism:** 
- **Potential Impact:** 

---

### 3. Proof of Concept (PoC)
*Provide step-by-step replication commands (e.g. curl requests or test snippets):*
```bash
curl -X POST http://localhost:3000/api/... \
  -H "Authorization: Bearer <token>" \
  -d '{"maliciousPayload": true}'
```

---

### 4. Remediation & Hardening Plan
- [ ] Implement server-side check in `server/policy.ts` or `server/tenantMiddleware.ts`.
- [ ] Add explicit `eq(table.tenantId, tenantId)` constraint to database query.
- [ ] Add automated adversarial test in `security-tests/`.
- [ ] Audit production logs for prior exploitation attempts.
- [ ] Verify fix with `npm run test:security`.

---

### 5. Sign-Off Requirements
- [ ] AppSec Reviewer Approval
- [ ] Tech Lead Approval
- [ ] Post-fix verification on staging
