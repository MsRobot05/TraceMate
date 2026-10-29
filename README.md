# TraceMate — MIT-WPU Campus Lost & Found (MERN PoC)

TraceMate is a proof-of-concept campus recovery platform. Students report lost/found belongings, browse and search reports, get explainable match suggestions, and coordinate safer handovers through private claims.

## Quick start (3 commands)

Requirements: **Node.js 20+** and a **MongoDB** (local server, Docker, or a free MongoDB Atlas cluster).

```bash
npm install            # root tooling (concurrently)
npm run install:all    # installs server/ and client/ dependencies
npm run setup          # creates server/.env with a random JWT secret (never overwrites an existing .env)
```

Make sure MongoDB is reachable, then:

```bash
npm run seed           # optional: demo accounts, reports, claims (safe to re-run)
npm run dev            # starts API (port 5000) and React app (port 5173)
```

- App: http://localhost:5173
- API health: http://localhost:5000/api/health (should show `"database":"connected"`)

**Getting MongoDB** (pick one):

| Option | Steps |
|---|---|
| Docker | `docker compose up -d` (uses `docker-compose.yml`), keep the default `MONGODB_URI` |
| Local install | Install MongoDB Community Server, start the service; default URI `mongodb://127.0.0.1:27017/tracemate` works |
| Atlas (cloud) | Create a free cluster → Database Access user → Network Access (allow your IP) → paste the connection string into `MONGODB_URI` in `server/.env` and add a database name, e.g. `.../tracemate` |

If the app shows "API not connected — showing sample reports", the API or MongoDB is not running. Sample cards are demo-only and cannot be saved.

**Windows PowerShell** works the same; to generate a secret manually instead of `npm run setup`:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` and paste it after `JWT_SECRET=` in `server/.env`. Keep `.env` private.

### Demo logins (after `npm run seed`, password `DemoPass#2026`)

| Account | Why use it |
|---|---|
| `asha@seed.tracemate.test` | Has a claim waiting for review and a match alert |
| `rohan@seed.tracemate.test` | Student with reports |
| `meera@seed.tracemate.test` | Has a pending claim on Asha's bottle |
| `admin@seed.tracemate.test` | Moderator: opens the **Moderation** dashboard |

To make your own account a moderator, put your email in `ADMIN_EMAILS` (comma-separated) in `server/.env` and register/sign in with it.

## Problem, users, objectives, scope

**Problem:** lost-and-found information is scattered across chats and noticeboards, so reports are hard to search and likely matches are easy to miss.

**Users:** MIT-WPU students and community members (primary); campus moderators (supporting, admin role).

**Objectives:** centralize reports; search by category/location/keywords; suggest likely opposite-type matches with reasons; protect contact details; support a verified claim → handover workflow; keep the feed safe through moderation.

**PoC scope:** registration/login, profile, report CRUD, search/filter/sort, private claims, photo uploads, in-app notifications and match alerts, community flagging with moderator dashboard, AI-assisted descriptions/category suggestions, explainable recovery matching, a human-in-the-loop agent workspace, and a safety guide. This is an academic PoC, not a production identity-verification system.

## Features

| Area | What it does |
|---|---|
| Accounts | bcrypt hashing, JWT (7-day), profile, rate-limited login, roles `student` / `admin` |
| Reports | Create / edit / delete (owner only), photos (JPEG/PNG/WebP, ≤5 MB, signature-checked), search, type/category/status filters, sort, "show more" |
| Matching | Pure, unit-tested scoring (category, shared clues, location, date) with human-readable reasons |
| Match alerts | Posting a report notifies owners of strongly similar opposite-type reports (score ≥ 50) |
| Claims | Claim with private proof → owner approves / rejects → handover → returned; contact details unlock only after approval |
| Notifications | Bell with unread count (claim received/approved/rejected/completed/withdrawn, match, moderation) |
| Moderation | Members flag reports; 3 distinct flags auto-hide; admins hide / restore / dismiss flags / remove, see stats and manage roles |
| AI helpers | Local heuristic analyzer + recovery assistant (works with no API key); optional server-side Gemini wording help |
| Agent | `/agent` inspects your reports and claims, saves a prioritized task plan to MongoDB; you approve, dismiss or reopen. It never approves claims or contacts anyone |
| Safety | helmet headers, CORS allow-list, global + login rate limits, input validation/sanitising, owner checks, private fields stripped from public responses |

## Technology and architecture

- **Frontend:** React 18, Vite, React Router, Lucide icons, plain CSS
- **Backend:** Node.js, Express REST API, middleware for JWT auth, validation, rate limiting, central error handler
- **Database:** MongoDB with Mongoose models `User`, `Item`, `Claim`, `AgentTask`, `Notification`
- **AI:** deterministic local heuristics work without a key; optional Gemini (server-side only)

Data flow: React form → `fetch` (`client/src/api.js`) → Express route/middleware → Mongoose model → MongoDB → JSON → React state/UI update.

```
client/src   pages/ (Overview, Reports, MyActivity, SafeRecovery, Agent, Admin)
             components/ (Shell, ItemCard, modals, NotificationBell, ErrorBoundary)
             context/AppContext.jsx (user, feed, notices, active modal)   api.js
server/src   index.js  config.js
             routes/ auth items claims uploads ai notifications admin
             models/ User Item Claim AgentTask Notification
             middleware/auth.js   services/notify.js   utils/ matching.js validate.js
server/scripts smoke-test.mjs  seed.mjs        server/test  matching.test.mjs
```

## API overview

- **Auth:** `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `PATCH /api/auth/profile`
- **Items:** `GET /api/items` (`type`, `category`, `status`, `search`, `page`, `limit`), `GET /api/items/mine`, `GET /api/items/:id`, `GET /api/items/:id/matches`, `POST /api/items`, `PATCH /api/items/:id`, `PATCH /api/items/:id/status`, `POST /api/items/:id/flag`, `DELETE /api/items/:id`
- **Claims:** `POST /api/claims`, `GET /api/claims/mine`, `GET /api/claims/received`, `PATCH /api/claims/:id/status` (owner: approved / rejected / completed), `DELETE /api/claims/:id` (claimant withdraws a pending claim)
- **Uploads:** `POST /api/uploads` (multipart field `photo`, JWT)
- **Notifications:** `GET /api/notifications`, `PATCH /api/notifications/read-all`, `PATCH /api/notifications/:id/read`
- **Admin (admin role):** `GET /api/admin/stats`, `GET /api/admin/items?filter=flagged|hidden|all`, `PATCH /api/admin/items/:id` (`hide` / `unhide` / `clear-flags`), `DELETE /api/admin/items/:id`, `GET /api/admin/users`, `PATCH /api/admin/users/:id/role`
- **AI:** `POST /api/ai/assist`, `POST /api/ai/analyze`, `POST /api/ai/recovery-assistant`, `GET /api/ai/agent/tasks`, `POST /api/ai/agent/plan`, `PATCH /api/ai/agent/tasks/:id`
- **Health:** `GET /api/health`

Privacy rules enforced by the API: contact name/email/phone are returned only to the report owner; a claimant sees the owner's contact details only after the owner approves; the owner sees the claimant's email/phone only after approval; flag details and owner ids are never public; hidden reports disappear from feeds, matches, AI search and agent suggestions.

## Testing

Start the API (`npm run dev` or `npm --prefix server run dev`), then in another terminal:

```bash
npm test                 # unit tests (no database needed): matching engine + input cleaners
npm run test:smoke       # 39 end-to-end API checks against the running API and MongoDB
```

The smoke test registers throw-away users and covers validation, auth and JWT tampering, ownership rules, contact privacy, the full claim workflow, notifications and match alerts, flagging and auto-hide, admin moderation, uploads (including a spoofed image), malformed JSON, matching, AI endpoints and the agent. The admin check needs `ADMIN_EMAILS=admin@tracemate.test` in `server/.env` (the default created by `npm run setup` leaves it empty, in which case that one check prints "skipped"). Keep the printed output as testing evidence, and only claim tests you have run.

Build check: `npm run build`.

## Feature demonstration checklist

1. Register a test account and sign in (or use a seeded login).
2. Create a lost and a found report with different categories/locations; attach a photo.
3. Search, filter and sort the feed; open **Find matches** and read the score and reasons.
4. Open **AI Recovery Assistant** and ask "black headphones near the library".
5. With a second account press **This is mine**, submit a claim with private proof. Check the owner's bell shows a notification. As owner open **My activity → Claims to review**, approve; the claimant's bell shows approval and **Claims I made** shows the handover details. Mark it returned.
6. Confirm a different account sees no Edit/Delete buttons, and contact fields are absent in `GET /api/items` (browser DevTools → Network).
7. Flag a report from three different accounts; confirm it leaves the feed. Sign in as the admin, open **Moderation**, restore it.
8. Open **AI Agent & Pending**, run the agent, complete/dismiss/reopen tasks, refresh and confirm they persist.
9. Confirm `/api/health` reports `database: connected`; run `npm test`, `npm run test:smoke`, `npm run build`.

## Rubric alignment (30 marks)

| Criterion | Evidence to present |
|---|---|
| Problem definition & PoC planning (3) | Problem, users, objectives, scope above |
| React frontend (5) | Components, routing (Overview/Reports/My activity/Agent/Admin), forms, context state, loading/error states, ErrorBoundary, responsive layout |
| Node.js & Express backend (5) | REST routes, auth + admin middleware, validation, rate limiting, central error handler |
| MongoDB integration (4) | Mongoose `User/Item/Claim/AgentTask/Notification` models with enums, indexes, references; persistent CRUD |
| MERN integration & data flow (4) | Create a report in the UI, refresh and see it persist; show the request in DevTools; `/api/health` |
| Application functionality (4) | Auth, reports, claims, matching, notifications, moderation, agent, profile, safety guide |
| Testing/debugging (2) | `npm test` + `npm run test:smoke` output; demo checklist screenshots |
| Code quality/documentation (2) | Modular routes/models/utils, comments, this README, `.env.example`, seed script |
| PoC demonstration & viva (1) | 5-minute demo and viva notes below |

## Suggested 5-minute demo

1. State the problem and users (30 s).
2. Sign in as `asha@…`, show the overview, the bell and **My activity → Claims to review** (60 s).
3. Create a report with a photo; show the instant match alert for another user (60 s).
4. Show search/filter, then **Find matches** with score reasons (45 s).
5. Approve a claim and show contact details unlocking only after approval (60 s).
6. Flag → auto-hide → admin restore, then show `/api/health` and the passing tests (45 s).

## Viva preparation

- **Why MERN?** One language end to end; MongoDB documents map naturally to reports with varying fields.
- **What does Express do?** Defines REST endpoints and middleware (auth, rate limiting, validation, errors) between UI and database.
- **Why Mongoose?** Schemas, validation, enums, indexes and a clean query API.
- **How is authentication handled?** bcrypt-hashed passwords; login returns a 7-day JWT sent as `Authorization: Bearer`; admin routes re-check the role in MongoDB so a demotion applies immediately.
- **How are privacy and authorization handled?** Owner checks on edit/delete/review; `safeItem()` strips contact fields, owner id and flag details from public responses; contact details unlock only after claim approval.
- **How does a claim work?** Claim with private proof → owner approves/rejects → completed; the item status follows the claims (open → claim-pending → claimed → returned).
- **How does moderation work?** Any member can flag; three distinct flags auto-hide a report; admins review the queue and can restore, hide, dismiss flags or remove.
- **Is the AI a trained model?** No. Matching is deterministic text/category/location overlap with visible reasons. Optional Gemini only rewrites descriptions or summarizes public results, server-side.
- **How is the upload safe?** Type allow-list, 5 MB limit, random server-side filenames, and a magic-byte check so a renamed text file is rejected.
- **Limitations:** no verified student identity or OTP, notifications are polled every 30 s (no websockets/email), moderation is basic, matching is not proof of ownership, search is regex based (no text index).

## Agentic AI workspace

`/agent` is a persistent workflow, not a chat reply:

1. **Inspect** your own open reports and pending claims, plus public opposite-type reports.
2. **Prioritize** with transparent rules (report age, category, location and wording overlap).
3. **Plan:** `POST /api/ai/agent/plan` creates deduplicated `AgentTask` records in MongoDB, and auto-closes tasks whose claim is no longer pending.
4. **Human approval:** complete, dismiss or reopen tasks via `PATCH /api/ai/agent/tasks/:id`.

The agent never approves claims, contacts students, discloses contact data or marks items returned.

## GitHub safety

Never commit `.env`, credentials, tokens, uploads or API keys (`.gitignore` already excludes them). If a secret was exposed in a public repository, rotate it immediately. Review `git status` before committing.

## Academic integrity note

Collect the required five signatures from real students in Divisions C, D and E yourself. Do not fabricate names or signatures. Keep test evidence authentic and explain the code in your own words during the viva.
