---
name: Feature Request
about: Propose a new user or business capability for DialPulse Client CRM
title: "[FEATURE] CRM-REQ-___: <Short Title>"
labels: ["enhancement", "needs-triage"]
assignees: ""
---

### 1. Requirement Metadata
- **Requirement ID:** `CRM-REQ-____` *(Assigned during Phase 1 Requirements triage)*
- **Subsystem:** [Leads / Pipeline / Calling / WhatsApp / Reports / Settings / Compliance / Support / Platform]
- **Target Persona:** [Telecaller / Team Lead / Admin / Platform Staff]

---

### 2. User & Business Problem
*What user problem or business friction does this solve?*
> As a [user persona], I need [capability] so that [expected business value].

---

### 3. Proposed Scope & Solution
*Describe the proposed behavior, workflow, and interface:*

---

### 4. Acceptance Criteria (Definition of Done)
- [ ] **Given** [context], **When** [action], **Then** [expected outcome].
- [ ] **Given** [context], **When** [action], **Then** [expected outcome].
- [ ] **Given** [context], **When** [action], **Then** [expected outcome].

---

### 5. Risk & Impact Classification
- **Risk Level:** [Level 1 (Low) / Level 2 (Medium) / Level 3 (High) / Level 4 (Critical)]
- **Multi-Tenant Impact:** *How is tenant isolation maintained?*
- **Database Impact:** *Are new tables, columns, or indexes required in PostgreSQL / Drizzle?*
- **Security & RBAC Impact:** *What permission string will be registered in `server/policy.ts`?*
- **UX & Accessibility Impact:** *Does this comply with M3 surface tokens and Zero-Pill discipline?*

---

### 6. Dependencies & External Services
- [ ] PostgreSQL Schema Migration
- [ ] Redis / BullMQ Queue
- [ ] Meta WhatsApp Cloud API
- [ ] Gemini AI Audio Transcription
- [ ] Other: 
