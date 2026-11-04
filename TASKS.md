# Tasks & Bugs

### Instructions
- **Status:** `[ ]` = Todo &nbsp;|&nbsp; `[-]` = In Progress &nbsp;|&nbsp; `[x]` = Done
- **Format:** `- [ ] [P0/P1/P2/P3] [Category] Description`
- **Priorities:** `P0` = Critical &nbsp;|&nbsp; `P1` = High &nbsp;|&nbsp; `P2` = Medium &nbsp;|&nbsp; `P3` = Low

---

## 🔥 Active Features & Roadmap

- [ ] [P1] [Feature] **Teacher Live Pointer:** Broadcast instructor cursor / laser pointer in real-time to all connected students during code explanations
- [ ] [P2] [Feature] **Git-like Revision & File Tracker:** Version snapshot history across all students (live code inspection is done; history/diffs remain)
- [ ] [P1] [Infra] **Shared rate limiting:** `/api/execute` and `/api/hint` limits are in-memory per server instance; move to a shared store (e.g. Upstash/Redis) for multi-instance deployments
- [ ] [P2] [Feature] **Lab history:** Let teachers browse ended labs and export attendance/PRN lists (ended labs are currently hidden from the dashboard)
- [ ] [P2] [Quality] **Automated tests:** Add an E2E suite (teacher signup → create lab → student join → run → dashboard) and SQL policy tests for `supabase/schema.sql`
- [ ] [P3] [Cleanup] **Deduplicate UIs:** `/login` vs `TeacherAuthModal` and `/join` vs `JoinLabModal` are near-identical copies

---

## ✅ Completed
- [x] [P0] [Security] **Remove server-side code execution:** Student code no longer runs on the host (`new Function`/`eval` fallbacks removed, local compilers opt-in via `LABSYNC_LOCAL_EXEC` in development only); input validation, size limits, timeouts and rate limiting on `/api/execute`
- [x] [P0] [Security] **Real teacher authentication:** Supabase Auth email/password (previously any password was accepted); `?role=teacher` no longer grants control — only the lab's creator can manage it
- [x] [P0] [Security] **Locked-down database:** RLS restricts lab changes to their owner and student rosters (names, PRNs, code) to the owning teacher; students write only through token-checked `join_lab` / `update_student_state` functions
- [x] [P0] [Bug] **Dashboard received no student data:** Students now report run results, error classification, code snapshots and heartbeats; dashboard derives stuck/idle states
- [x] [P0] [Bug] **Starter code never reached students:** Joining a lab loads its starter code; teachers can write custom starter code when creating a lab
- [x] [P1] [Bug] **Paused labs disappeared and were unjoinable;** pause now also blocks the Cmd+Enter shortcut
- [x] [P1] [Bug] **Silent localStorage fallback when Supabase errors** (teacher and students saw different data); errors are now surfaced
- [x] [P1] [Feature] **Raise hand / Mark done** for students, live student code view on the dashboard, help-queue sorting
- [x] [P1] [Bug] **Stop button didn't stop runs;** language switch wiped files without confirmation; C `scanf` guard broke `scanf(...) == 1` checks; teacher IDE broadcast stale code on open; AI hint endpoint accepted injected system messages
- [x] [P1] [Feature] **Teacher Institutional Auth & Student PRN Credentials:** Faculty login and registration restricted to `@mitaoe.ac.in` domain, student PRN verification before lab join (`202501040430`), multi-lab management, and start/pause/stop lab controls with student execution locks
- [x] [P1] [Feature] **Lab Lobbies System & Supabase Integration:** Unique 6-digit room code creation, PIN join flow, student attendance, multi-lab room switcher, and Supabase Realtime schema with offline fallback
- [x] [P1] [Optimization] **Lightweight Performance & Local Code Persistence:** High-performance rendering on Safari/Chrome/Firefox/low-spec PCs, full localStorage session persistence across reloads, and local compiler execution
- [x] [P2] [Feature] **Vim Mode for Monaco Editor:** Modal editing with normal, insert, and visual modes, status bar indicator with command line (:w), and 1-click toggle
- [x] [P2] [Feature] **Keyboard Shortcuts & Sound Effects:** Keybindings (`Cmd+Enter` / `Ctrl+Enter` to execute) and audio feedback effects on run success/failure
- [x] [P1] [Feature] **Stdin & Interactive CLI:** Console standard input stream for C, C++, Python, etc. to support interactive programs (`input()`, `cin`, `scanf()`)
- [x] [P1] [Feature] **Web Dev Mode with Live Preview & File Explorer:** HTML/CSS/JS multi-file editing, sandboxed real-time preview iframe with responsive viewports, and console logging proxy
- [x] [P1] [Feature] **Live Syntax Error Displayer:** Real-time red squiggly underlines and gutter warnings directly on the code editor
- [x] [P0] Replace default Next.js favicon with real LabSync branding
- [x] [P0] Enable free Judge0 cloud code execution without credit cards or API keys
- [x] [P1] Fix landing page lag (native 120 FPS scrolling + GPU compositor optimization)
- [x] [P1] Generate 1:1 square venture brand logo
- [x] [P1] Update hero copy with clear product explanation & balanced font sizes
- [x] [P2] Remove harsh white hotspots from glowing orbs
