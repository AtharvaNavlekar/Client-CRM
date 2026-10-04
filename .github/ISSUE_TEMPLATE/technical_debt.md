---
name: Technical Debt & Architectural Cleanup
about: Track refactoring, simulated stub replacements, or technical truth alignment
title: "[DEBT] CRM-___: <Short Cleanup Title>"
labels: ["technical-debt", "maintenance"]
assignees: ""
---

### 1. Technical Debt Classification
- **Related Requirement ID:** `CRM-REQ-____` / `CRM-DB-____` / `CRM-INFRA-____`
- **Technical Truth Category:**
  - [ ] Replace `SIMULATED` stub with `REAL` production integration
  - [ ] Remove `LEGACY` deprecated code or unused tables
  - [ ] Complete `PARTIAL` edge-case handling
  - [ ] Align documentation with code reality (`TECHNICAL_TRUTH_AUDIT.md`)
  - [ ] Optimize database query performance / indexing

---

### 2. Current State vs Desired State
- **Current Technical Reality:** 
- **Desired Architectural State:** 
- **Files / Modules Involved:** 

---

### 3. Justification & Risk of Non-Action
*Why should this be addressed? What risk does it pose if neglected?*

---

### 4. Proposed Refactoring Plan
1. 
2. 
3. 

---

### 5. Verification Checklist
- [ ] Refactoring introduces zero behavioral regressions (`npm test`).
- [ ] No impact on tenant isolation or authorization boundaries.
- [ ] Updated `docs/TECHNICAL_TRUTH_AUDIT.md` and `docs/REQUIREMENT-TRACEABILITY.md`.
- [ ] `npm run lint` and `npm run build` pass cleanly.
