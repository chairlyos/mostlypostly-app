# STACK.md — Technology Stack

## Runtime & Language
- **Runtime**: Node.js ≥18.0.0
- **Language**: JavaScript ES Modules (`"type": "module"` in package.json) — `import`/`export` everywhere, never `require()`
- **Entry point**: `server.js`
- **Dev server**: `nodemon server.js`

## Web Framework
- **Express.js** `^4.19.2` — primary HTTP server
- **express-session** `^1.18.2` — session management
- **cookie-parser** `^1.4.7`
- **body-parser** `^1.20.2`
- **helmet** `^8.1.0` — security headers
- **express-rate-limit** `^8.3.1` — rate limiting
- **multer** `^2.1.1` — file uploads

## Database
- **better-sqlite3** `^12.4.1` — synchronous SQLite (no `await` on DB calls)
- **better-sqlite3-session-store** `^0.1.0` — session persistence
- Single-file SQLite database, connection singleton at `db.js`
- Migrations in `migrations/` — numbered sequentially (001–043+)
- Migration runner: `src/core/migrationRunner.js`

## AI & Machine Learning
- **openai** `^6.8.1` — GPT-4o Vision for caption generation, GPT-4o-mini for celebration captions

## Communication Channels
- **twilio** `^5.10.4` — SMS/MMS (primary stylist channel), RCS chips
- **Telegram Bot API** — via raw HTTP (secondary channel)
- **resend** `^6.9.3` — transactional email (password reset, welcome)

## Image Processing
- **puppeteer** `^24.39.1` — headless Chrome for SVG→PNG rendering (availability/promo images)
- **sharp** `^0.34.5` — image manipulation
- `node-fetch` `^3.3.2` — HTTP requests for external image fetching

## Payments
- **stripe** `^20.4.1` — subscription billing, webhooks, customer portal

## Auth & Security
- **bcryptjs** `^3.0.3` — password hashing
- **otplib** `^13.3.0` — TOTP/MFA support
- **uuid** `^13.0.0` — UUID generation
- Custom token-based login links (7-day expiry) in `manager_tokens` table
- Custom encrypt/decrypt in `src/core/encrypt.js` and `src/core/encryption.js`

## Real-time
- **socket.io** `^4.8.1` — real-time updates (scheduler status, etc.)

## QR / CSV
- **qrcode** `^1.5.4`
- **json2csv** `^6.0.0-alpha.2`

## Date/Time
- **luxon** `^3.7.2` — timezone-aware datetime handling

## Rendering
- **Tailwind CSS CDN** — server-rendered HTML pages, no build step
- **Plus Jakarta Sans** — Google Fonts, loaded via CDN
- Server-rendered HTML via template literals in route files and `src/ui/pageShell.js`

## Bot Framework (unused/legacy)
- **botbuilder** `^4.23.3` — Microsoft Bot Framework (present but not actively used)

## Testing
- **vitest** `^3.2.4` — test runner
- Test files in `tests/` directory

## Dev Tools
- **nodemon** `^3.1.10` — dev auto-restart
- **ajv** `^8.17.1` + **ajv-formats** — JSON schema validation (dev)

## Deployment
- **Render.com** — auto-deploy from `main` (production) and `dev` (staging) branches
- Plan: Starter (512MB RAM)
- Build: `npm install && npx puppeteer browsers install chrome`
- Start: `node server.js`
- Port: 3000

## Configuration
- `dotenv` `^16.4.5` — environment variable loading
- All secrets via environment variables (never committed)
- `APP_ENV=local|staging|production` controls behavior
