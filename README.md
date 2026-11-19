<div align="center">

<img src="./public/images/labsync-brand.png" alt="LabSync" width="140" style="border-radius: 20px;" />

# LabSync

**Real-time code diagnostics for college programming labs.**

Diagnose every student’s code. Before they even raise a hand.

[Live Demo](https://labsync.vercel.app) · [Task Board](TASKS.md) · [Report Bug](https://github.com/Aazhs/labsync/issues) · [Request Feature](https://github.com/Aazhs/labsync/issues)

</div>

---

## What is LabSync?

LabSync combines a zero-setup browser IDE with **real-time diagnostic intelligence** — automatically classifying student code errors (Syntax → Logic → Conceptual) so professors can help every student in the room immediately.

In a typical 60-student programming lab, the professor has no idea who's stuck, who's idle, and who's copying. LabSync changes that with:

- **Real-time error classification** — every student error is categorized (Syntax → Logic → Conceptual) before it reaches the professor
- **AI-guided hints** — asks *"what happens when i reaches 5?"* instead of giving the answer
- **Live instructor dashboard** — a prioritized help queue with diagnosis already attached

> **Philosophy:** Remove guesswork, not the teacher.

---

## Features

| Feature | Description |
|---|---|
| **Zero-Setup Cloud IDE** | Students open a link and start coding. No compilers, no config. |
| **Live Code Sync** | Follow Mode mirrors the professor's editor to every student. |
| **AI Lab Assistant** | Guided Socratic hints — never spoon-feeds answers. |
| **Instructor Dashboard** | Real-time queue of stuck students with classified error diagnosis. |
| **Error Classification Engine** | Three-tier diagnosis: Syntax → Logic → Conceptual. |
| **Academic Integrity** | AST-level code similarity detection + AI-generation flagging. |

---

## Screenshots

### Landing Page
![Landing page with feature grid and stats](public/images/ide-preview.jpg)

### Instructor Dashboard
![Dashboard with student monitoring and error heatmap](public/images/dashboard-preview.jpg)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16](https://nextjs.org) (App Router) |
| **Language** | TypeScript |
| **Editor** | [Monaco Editor](https://microsoft.github.io/monaco-editor/) |
| **State** | [Zustand](https://zustand-demo.pmnd.rs/) |
| **Styling** | CSS Custom Properties + Tailwind v4 |
| **Code Execution** | [Judge0 CE API](https://judge0.com/) |
| **Auth & Realtime** | [Supabase](https://supabase.com/) (Auth, Postgres, Realtime) |
| **AI Hints** | Gemini API / OpenAI API / rule-based fallback |
| **Deployment** | [Vercel](https://vercel.com) (free tier) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm

### Installation

```bash
# Clone the repo
git clone https://github.com/aarshpatel1/labsync.git
cd labsync

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables (Optional)

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

| Variable | Purpose | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | **Yes, for real labs** — without it LabSync runs in single-browser demo mode |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | **Yes, for real labs** |
| `JUDGE0_API_URL` | Code execution engine | No — defaults to `https://ce.judge0.com` (free, no key needed) |
| `JUDGE0_API_KEY` | Private Judge0 key | No — only for a private/paid Judge0 instance |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Gemini hints and on-demand visualiser drawings | No |
| `GEMINI_DRAWING_MODEL` | Optional model override for drawings | No |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Alternative AI provider | No |
| `LABSYNC_LOCAL_EXEC` | `true` runs code with your local compilers instead of Judge0 | No — **development only**, ignored in production builds |

> **Zero-Config Execution:** Out of the box, LabSync executes code (Python, C, C++, Java, JS) on Judge0's public cloud. Student code is never executed on the LabSync server itself.

### Running real labs (Supabase)

Without Supabase, LabSync runs in **demo mode**: labs, teacher accounts and students live in one browser's localStorage, so it's only useful for trying the product. To run a real class:

1. Create a project at [supabase.com](https://supabase.com) and copy the URL and anon key into `.env.local`.
2. Open the SQL editor and run [`supabase/schema.sql`](supabase/schema.sql). It is safe to re-run and upgrades older LabSync schemas.
3. Under **Authentication → URL Configuration**, add your site URL (e.g. `http://localhost:3000`) so email confirmation links work.
4. For a quick demo, turn off **Authentication → Sign In / Providers → Email → Confirm email**, so teacher accounts work immediately without a confirmation email.
5. Add the same two variables in **Vercel → Project Settings → Environment Variables** and redeploy. `NEXT_PUBLIC_` values are baked in at build time, so a redeploy is required.

Updates are pushed over Supabase Realtime. If a network blocks websockets (common on college Wi-Fi), each screen falls back to checking every 2 seconds, so nothing waits for a refresh.

How access works:

- **Teachers** sign up with an `@mitaoe.ac.in` email and a password (Supabase Auth). Only they can create labs, and only the creator can pause, stop, broadcast or see a lab's students.
- **Students** have no accounts. They join with the 6-digit code, their name and PRN, and receive a private per-seat token. Re-joining with the same PRN reuses their seat, e.g. after switching computers.
- Students' code, run results, raised hands and "done" status stream to the instructor dashboard in real time.

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Landing page
│   ├── layout.tsx            # Root layout + metadata
│   ├── globals.css           # Design system (dark + light mode)
│   ├── ide/page.tsx          # Student IDE page
│   ├── dashboard/page.tsx    # Instructor dashboard
│   └── api/
│       ├── execute/route.ts  # Code execution API
│       └── hint/route.ts     # AI hint generation API
├── components/
│   ├── CodeEditor.tsx        # Monaco editor wrapper
│   ├── IDEHeader.tsx         # Header with run, settings, theme toggle
│   ├── IDESidebar.tsx        # Activity bar
│   ├── OutputPanel.tsx       # Terminal output + problems
│   ├── AIHintPanel.tsx       # AI assistant chat
│   └── StatusBar.tsx         # Bottom status bar
├── lib/
│   ├── store.ts              # Zustand state management
│   ├── classifier.ts         # Error classification engine
│   └── theme.ts              # Dark/light theme hook
└── public/
    ├── favicon.svg
    ├── logo.png
    └── images/
```

---

## How a Lab Session Works

1. Student opens the zero-setup cloud IDE — no local installation required
2. Professor begins in **Follow Mode** — code mirrors into every student's reference pane
3. Lab shifts to **Practice Mode** — students code independently
4. When a student hits an error, the classification engine tags it — Syntax, Logic, or Conceptual
5. The AI assistant offers a guided hint — prompting reasoning, not spoon-feeding
6. If unresolved, the issue escalates to the professor's dashboard with the diagnosis attached

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Vercel auto-detects Next.js — no config needed
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and optionally `GEMINI_API_KEY`) in Settings → Environment Variables
5. Deploy

> **Free tier is sufficient.** API routes run as serverless functions — no separate backend needed.

---

## Design System

LabSync uses CSS custom properties for theming with **dark** and **light** modes:

- **Dark mode:** True black `#080808` backgrounds, warm amber `#d4943a` accents
- **Light mode:** Warm ivory `#faf8f5` backgrounds, deeper amber `#b87d2f` accents
- **Typography:** Inter (UI) + JetBrains Mono (code)
- **Motion:** Expo easing curves, scroll-triggered reveal animations

Toggle between modes using the ☀️/🌙 button in the nav bar.

---

## Contributing

Contributions are welcome! Please check out [TASKS.md](TASKS.md) for open bugs, requested features, and priorities. To propose a change, open an issue or submit a pull request.

---

## License

Distributed under the MIT License. See `LICENSE` for more information.

---

<div align="center">

**LabSync** · Diagnostic intelligence for college programming labs

</div>


### Gemini drawings in the IDE

Set `GEMINI_API_KEY` on the server (locally in `.env.local`). Open **Visualise → Draw with Gemini** to send the selected file’s source to Gemini. LabSync reads the generated HTML figure and renders its SVG shapes. Source-map steps highlight the matching parts of the drawing. During a recorded run, variable labels and array cells use values captured by the runner. Playback and switching back to the built-in sketch reuse the drawing while the file is open.
