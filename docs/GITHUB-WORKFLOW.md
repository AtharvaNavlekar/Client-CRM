# DialPulse Client CRM — GitHub Git & Pull Request Workflow

> **Document ID:** DOC-GIT-001  
> **Status:** APPROVED & MANDATORY  
> **Target Scope:** DialPulse Client CRM (`AtharvaNavlekar/CRM.git`)  
> **Governing Framework:** `BRAIN/SDLC-PLAYBOOK.md` (Phases 4, 5, 9, 16)  
> **Related Documents:**  
> - `docs/RELEASE-CHECKLIST.md`  
> - `docs/REQUIREMENT-TRACEABILITY.md`  
> - `docs/TEST-STRATEGY.md`

---

## 1. Overview & Golden Rules

All code contributions to the DialPulse Client CRM repository must proceed through a structured, auditable Git workflow. Direct pushes to `main` are strictly forbidden.

### The 5 Golden Rules:
1. **Never Commit Directly to `main`:** All changes must originate from a dedicated feature, fix, or security branch and merge via Pull Request.
2. **Every Change References a Requirement ID:** Branch names, PR titles, and commits must cite a canonical ID (e.g. `CRM-REQ-001`, `CRM-SEC-002`, `CRM-HOTFIX-001`).
3. **Green Local Pre-Flight Before PR:** Never open a PR without locally running `npm run lint` and `npm run build`.
4. **Conventional Commits Only:** Commit messages must follow the structured Conventional Commits specification.
5. **Clean Git History:** Rebase or squash commits to eliminate messy "WIP", "fix typo", or "test" commits before merging.

---

## 2. Standard Branching Strategy

The repository follows a Trunk-Based Development model with short-lived branches merging into `main`.

```
                  ┌── feature/CRM-REQ-003-leads ──► [PR & CI] ──┐
                  │                                             │
main (Protected) ─┴─────────────────────────────────────────────┴─► [Tag v1.1.0]
                  │                                             ▲
                  └── security/CRM-SEC-001-auth ──► [PR & CI] ──┘
```

### Branch Naming Conventions:
Branch names must be lowercase, hyphen-separated, and include the Requirement ID:

| Branch Type | Format Pattern | Example | Purpose |
| :--- | :--- | :--- | :--- |
| **Feature** | `feature/CRM-REQ-xxx-short-description` | `feature/CRM-REQ-004-kanban-m3` | New user feature or functional enhancement |
| **Bug Fix** | `fix/CRM-REQ-xxx-short-description` | `fix/CRM-REQ-003-lead-filter-bug` | Non-emergency defect fix |
| **Security** | `security/CRM-SEC-xxx-short-description`| `security/CRM-SEC-002-idor-patch` | Security vulnerability remediation |
| **Database** | `db/CRM-DB-xxx-short-description` | `db/CRM-DB-001-lead-indexes` | Schema migration or database optimization |
| **Hotfix** | `hotfix/CRM-HOTFIX-xxx-short-description`| `hotfix/CRM-HOTFIX-001-session-crash` | Expedited emergency production hotfix |
| **Documentation**| `docs/SDLC-xxx-short-description` | `docs/SDLC-playbook-update` | Process, architectural, or API documentation |
| **Refactor** | `refactor/CRM-xxx-short-description` | `refactor/CRM-005-calling-controller` | Code cleanup with no functional changes |
| **Chore** | `chore/CRM-xxx-short-description` | `chore/CRM-upgrade-vite-6` | Dependency updates, tooling, configuration |

---

## 3. Commit Message Standards (Conventional Commits)

Commit messages must provide a concise, readable history of changes.

### Commit Format:
```
<type>(<scope>): <subject>

[optional body explaining WHY the change was made]

[optional footer referencing Requirement ID, Breaking Changes, or Issue #]
```

### Mandatory Types:
- **`feat`**: A new feature for the user or system (e.g. `feat(CRM-REQ-004): add drag-and-drop to pipeline kanban`).
- **`fix`**: A bug fix (e.g. `fix(CRM-REQ-007): correct timezone offset calculation in quiet hours`).
- **`security`**: A security hardening change or vulnerability patch (e.g. `security(CRM-SEC-001): enforce SHA-256 session token hashing`).
- **`refactor`**: Code restructuring without changing functional behavior (e.g. `refactor(server): extract compliance service helpers`).
- **`test`**: Adding missing tests or correcting existing tests (e.g. `test(security): add test case for cross-tenant IDOR`).
- **`docs`**: Documentation only changes (e.g. `docs(sdlc): establish master engineering lifecycle playbook`).
- **`chore`**: Maintenance, dependency updates, build tooling (e.g. `chore(deps): update typescript to 5.8`).

### Commit Best Practices:
- Keep the first line under 72 characters.
- Use imperative mood: "add", "enforce", "fix", not "added", "enforcing", "fixes".
- Do not commit massive monster commits with mixed unrelated modifications.

---

## 4. Pull Request (PR) Lifecycle

### Step 1: Branch Creation & Preparation
1. Ensure your local `main` is up-to-date:
   ```bash
   git checkout main
   git pull origin main
   ```
2. Create your dedicated branch:
   ```bash
   git checkout -b feature/CRM-REQ-003-leads-filter
   ```

### Step 2: Implementation & Local Pre-Flight
1. Implement your changes.
2. Run local validation:
   ```bash
   npm run lint        # Must pass with 0 errors
   npm run build       # Must pass with zero build errors
   npm test            # Must pass 100%
   npm run test:security # Mandatory for Level 3/4 changes
   ```

### Step 3: Open Pull Request
1. Push branch to GitHub:
   ```bash
   git push origin feature/CRM-REQ-003-leads-filter
   ```
2. Open a Pull Request against `main`.
3. Complete every section of `.github/pull_request_template.md`:
   - State the Requirement ID and user problem.
   - Specify the Change Risk Level (Level 1, 2, 3, or 4).
   - Document testing evidence.
   - Verify tenant isolation and security impact.
   - Verify database and documentation impacts.

### Step 4: Code Review & Automated Gates
- Automated checks must report GREEN:
  - Linting (`npm run lint`)
  - Production Build (`npm run build`)
  - Integration & Auth Tests (`npm test`)
  - Security Tests (`npm run test:security`)
- Obtain required peer review approvals:
  - **Level 1 (Low):** 1 Peer Approval.
  - **Level 2 (Medium):** 1 Senior Engineer Approval.
  - **Level 3 (High):** 2 Approvals (including Tech Lead).
  - **Level 4 (Critical):** 2 Approvals (Tech Lead + AppSec Lead).

### Step 5: Merge & Release Tagging
1. Merge using **Squash and Merge** (or Rebase and Merge) to maintain a linear, clean `main` history.
2. Delete the remote feature branch post-merge.
3. For scheduled releases, create an annotated Git tag:
   ```bash
   git tag -a v1.2.0 -m "Release v1.2.0: Pipeline Kanban M3 and Calling Compliance"
   git push origin v1.2.0
   ```
