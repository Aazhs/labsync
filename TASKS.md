# 📋 Project Tasks & Issue Tracker

Welcome to the **LabSync** task and bug tracking board. Contributors, maintainers, and reviewers can use this file to log bugs, track upcoming features, and update project progress.

---

## 📖 Syntax & Formatting Guide

When adding or updating tasks, follow the standardized syntax below so everyone can read and filter items consistently.

### 1. Status Markers

Use standard markdown checkboxes to represent task lifecycle:

| Marker | Status | Meaning |
|:---:|:---|:---|
| `[ ]` | **To Do / Open** | Backlog item ready to be picked up |
| `[-]` | **In Progress** | Actively being worked on by someone |
| `[x]` | **Completed** | Finished, tested, and merged into `main` |
| `[~]` | **Blocked** | On hold due to an external dependency or question |
| `[!]` | **Dropped** | Won't fix / abandoned after review |

### 2. Priority Tags

Assign one priority level to every task or bug:

| Priority | Label | Definition | Action Required |
|:---|:---|:---|:---|
| **P0** | `[P0-CRITICAL]` | Production outage, security issue, broken build | Drop everything; fix immediately |
| **P1** | `[P1-HIGH]` | Core feature broken, critical IDE/eval bug | Fix in current milestone |
| **P2** | `[P2-MEDIUM]` | Normal feature request, UI flaw, non-blocking bug | Standard sprint / milestone backlog |
| **P3** | `[P3-LOW]` | Nice-to-have, cosmetic polish, future experiment | Pick up when core tasks are done |

### 3. Category Tags

Prefix the task with its domain:

- `[Bug]` — Something is malfunctioning or throwing an error
- `[Feature]` — New functionality or workflow addition
- `[UI/UX]` — Layout, animations, colors, accessibility, responsiveness
- `[Perf]` — Latency, memory, bundle size, frame rate optimization
- `[Security]` — Sandboxing, auth, token safety, input validation
- `[Docs]` — Documentation, guides, README, comments

---

## 📝 Format Example

### Quick One-Liner Format
```markdown
- [ ] [P1-HIGH] [Bug] Fix C++ compiler timeout when code has infinite while loops (@username)
- [-] [P2-MEDIUM] [Feature] Add keyboard shortcut (Cmd+Enter) to execute code in IDE (@contributor)
- [x] [P0-CRITICAL] [UI/UX] Remove default Next.js favicon and replace with LabSync brand
```

### Detailed Bug Report Template
If a bug requires steps to reproduce, use this expandable block format:

```markdown
- [ ] [P1-HIGH] [Bug] Brief title describing the issue
  - **Found In:** `/ide` (Python 3)
  - **Steps to Reproduce:**
    1. Open IDE and write `input()`
    2. Click Run Code without providing Stdin
    3. Notice execution hangs with no error message
  - **Expected:** Should timeout after 5 seconds with a prompt to provide stdin
  - **Actual:** Spinner runs indefinitely
  - **Assignee:** @username
```

---

## 🚨 Active Task Board

### 🔥 High Priority / Urgent (`P0` & `P1`)
- [ ] [P1-HIGH] [Feature] Add Stdin input box in the IDE output console for interactive CLI programs
- [ ] [P1-HIGH] [Security] Sanitize and rate-limit student code execution submissions on `/api/execute`
- [ ] [P1-HIGH] [Bug] Handle WebSocket disconnection reconnects in Follow Mode gracefully

---

### 🛠️ In Progress (`[-]`)
- [-] [P2-MEDIUM] [UI/UX] Add keyboard shortcut `Cmd + Enter` / `Ctrl + Enter` to trigger "Run Code"
- [-] [P2-MEDIUM] [Docs] Add troubleshooting tips for WebSocket proxy configurations in university firewalls

---

### 📋 Backlog (`P2` & `P3`)
- [ ] [P2-MEDIUM] [Feature] Add code diff view in Instructor Dashboard when reviewing student submissions
- [ ] [P2-MEDIUM] [UI/UX] Add full-screen toggle button for Monaco Editor inside the Student IDE
- [ ] [P2-MEDIUM] [Feature] Export lab analytics report as CSV/PDF for professors
- [ ] [P3-LOW] [Perf] Lazy-load Monaco language workers to decrease initial bundle size
- [ ] [P3-LOW] [UI/UX] Add sound effect toggle for successful test case passes
- [ ] [P3-LOW] [Feature] Add vim/emacs keybinding modes option in IDE Settings modal

---

### ✅ Completed Tasks (`[x]`)
- [x] [P0-CRITICAL] [UI/UX] Replace default Next.js starter favicon with real LabSync RGBA icon
- [x] [P0-CRITICAL] [Feature] Switch remote code execution to free `ce.judge0.com` cloud without requiring credit card or API keys
- [x] [P1-HIGH] [Perf] Eliminate landing page lag by removing nested scroll, reducing GPU blurs, and isolating counter RAF loops
- [x] [P1-HIGH] [UI/UX] Generate 1:1 square venture brand logo (`labsync-brand.png`)
- [x] [P1-HIGH] [Docs] Remove obsolete SIH 2025 references across the codebase
- [x] [P1-HIGH] [UI/UX] Redesign hero section with clear product value proposition and balanced font scaling
- [x] [P2-MEDIUM] [UI/UX] Fix glowing orbs center glare to use rich chromatic ambient lighting
