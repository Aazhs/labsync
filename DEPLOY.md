# Deploying LabSync

This guide covers deploying LabSync to production. The recommended platform is **Vercel** (free tier works).

---

## Option 1: Vercel (Recommended)

### Prerequisites

- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (free)
- The LabSync repo pushed to GitHub

### Steps

1. **Push your code to GitHub** (if not already done):

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/labsync.git
   git push -u origin main
   ```

2. **Import project on Vercel:**

   - Go to [vercel.com/new](https://vercel.com/new)
   - Click **"Import Git Repository"**
   - Select your `labsync` repository
   - Vercel auto-detects Next.js — no configuration needed

3. **Configure environment variables** (optional but recommended):

   Go to **Project Settings → Environment Variables** and add:

   | Variable | Default / Value | Purpose | Required? |
   |---|---|---|---|
   | `JUDGE0_API_URL` | `https://ce.judge0.com` | Official free public code runner | **No** — works automatically with 0 config |
   | `JUDGE0_API_KEY` | *(Optional)* | Only if using a custom/private Judge0 key | **No** — not needed for public instance |
   | `GEMINI_API_KEY` | Your Gemini key | AI-powered hints via Google AI Studio | **No** — falls back to rule-based hints |

   > **Out of the box with ZERO environment variables:**
   > - Code execution runs for real across Python, C, C++, Java, and JavaScript via Judge0's free public cloud.
   > - Socratic hints work via intelligent rule-based error classification.
   > - No credit cards, no subscriptions, no third-party accounts required.

4. **Deploy:**

   - Click **"Deploy"**
   - Vercel builds and deploys automatically
   - You'll get a URL like `https://labsync-xxxxx.vercel.app`

5. **Custom domain** (optional):

   - Go to **Project Settings → Domains**
   - Add your custom domain (e.g., `labsync.yourdomain.com`)
   - Follow DNS configuration instructions

### Automatic Deployments

Every push to `main` triggers a new deployment automatically. Pull requests get preview deployments.

---

## Option 2: Self-Hosted (Node.js Server)

### Prerequisites

- Node.js 18+
- npm or pnpm

### Steps

1. **Clone and install:**

   ```bash
   git clone https://github.com/YOUR_USERNAME/labsync.git
   cd labsync
   npm install
   ```

2. **Set environment variables:**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your API keys
   ```

3. **Build for production:**

   ```bash
   npm run build
   ```

4. **Start the server:**

   ```bash
   npm start
   ```

   The app runs on `http://localhost:3000` by default.

5. **Using PM2** (recommended for production):

   ```bash
   npm install -g pm2
   pm2 start npm --name "labsync" -- start
   pm2 save
   pm2 startup
   ```

### Behind a Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name labsync.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Option 3: Docker

### Dockerfile

Create a `Dockerfile` in the project root:

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["npm", "start"]
```

### Build and run:

```bash
docker build -t labsync .
docker run -p 3000:3000 labsync
```

---

## Getting API Keys

### Judge0 (Code Execution — Zero Setup)

- **Default:** LabSync automatically connects to Judge0's official free public cloud (`https://ce.judge0.com`).
- **No signup, no API key, and no credit card required.** Code runs out of the box on both localhost and Vercel.
- If you have your own self-hosted Judge0 instance or dedicated server, simply set `JUDGE0_API_URL` to your instance URL.

### Gemini (AI Hints)

1. Go to [aistudio.google.com](https://aistudio.google.com)
2. Click **"Get API Key"**
3. Create a new API key
4. Set `GEMINI_API_KEY` in your environment

---

## Troubleshooting

### Build fails on Vercel

- Make sure you're using Node.js 18+ (Vercel Settings → General → Node.js Version)
- Check that all dependencies are in `package.json` (not just installed locally)

### Code execution returns "Demo Mode"

- You need to set `JUDGE0_API_KEY` in your environment variables
- Without it, only JavaScript runs fully; other languages are mocked

### AI hints show generic responses

- Set `GEMINI_API_KEY` or `OPENAI_API_KEY` for AI-powered hints
- Without these, the system uses rule-based pattern matching (still useful, just less contextual)

### Monaco editor doesn't load

- Make sure `@monaco-editor/react` is in your dependencies
- This is a client-side component — check that your page has `'use client'` directive

---

## Architecture Overview

```
Browser ──→ Next.js (Vercel Serverless)
              │
              ├── /api/execute  ──→ Judge0 API (or sandboxed JS eval)
              ├── /api/hint     ──→ Gemini API (or rule-based fallback)
              └── Static pages  ──→ CDN (landing, IDE, dashboard)
```

Everything runs on Vercel's free tier. No separate backend, database, or infrastructure needed for the prototype.
