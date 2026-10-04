---
name: Bug Report
about: Report a defect or functional regression in DialPulse Client CRM
title: "[BUG] CRM-REQ-___: <Short Defect Title>"
labels: ["bug", "needs-triage"]
assignees: ""
---

### 1. Defect Metadata
- **Related Requirement ID:** `CRM-REQ-____` *(if known)*
- **Severity Level:** [P0 (Critical Outage) / P1 (Core Workflow Blocked) / P2 (Degraded Feature) / P3 (Cosmetic/Minor)]
- **Environment:** [Development / Staging / Production]
- **Affected User Role:** [Telecaller / Team Lead / Admin / Platform Staff]

---

### 2. Defect Description & Impact
*Describe what happened versus what was expected:*
- **Expected Behavior:** 
- **Actual Behavior:** 
- **Business Impact:** 

---

### 3. Steps to Reproduce
1. Log in as user `[email]`.
2. Navigate to `[view/route]`.
3. Perform action `[action]`.
4. Observe error `[error message / status code]`.

---

### 4. Technical Diagnostics & Error Logs
- **HTTP Status Code:** [e.g. 500 / 403 / 404]
- **API Endpoint:** [e.g. `POST /api/calls`]
- **Console / Server Logs:**
```text
```

---

### 5. Architectural Blast Radius
- **Tenant Isolation Impact:** [Yes / No / Unknown] *(Could this expose cross-tenant data?)*
- **Database Consistency Impact:** [Yes / No] *(Did this corrupt or orphan records?)*
- **Proposed Fix Approach:** 

---

### 6. Verification Criteria for Resolution
- [ ] Reproducing test case created in `tests/` or `security-tests/`.
- [ ] Defect remediated and verified via `npm test`.
- [ ] No regression introduced to surrounding workflows.
