# RTI Assist: AI-Powered RTI Auto-Responder (academic project, v2)

A citizen-facing Right to Information (RTI) portal where an AI service analyses each application, finds similar historical records and drafts a response, and **an authorised officer reviews, edits, approves and issues every response**. The AI never approves, rejects or issues anything.

> **Not an official portal.** This is an independent college project. It is not affiliated with any government department. All departments, officers, citizens and historical records in the seed data are **fictional DEMO DATA**.

## Contents
1. [Key features](#key-features) 2. [Tech stack](#tech-stack) 3. [Architecture](#architecture) 4. [Folder structure](#folder-structure) 5. [Setup](#setup) 6. [Demo mode](#demo-mode-no-credentials-needed) 7. [Demo logins](#demo-logins) 8. [AI details](#ai-details) 9. [API reference](#api-reference) 10. [Testing](#testing) 11. [Verification status](#verification-status-read-this-first) 12. [Troubleshooting](#troubleshooting) 13. [Known limitations](#known-limitations)

## Key features
**Citizen:** seven-step application wizard (details, department, subject, request, documents, AI suggestions, review) with live preview, per-step validation, saved drafts, real upload progress and explicit confirmation; PDF acknowledgement; personal dashboard (needs attention, deadlines, activity, recently viewed, progress tracker); search including text inside documents, filters, sorting, pagination; detail page with status history, deadline, translation, private documents (preview, text extraction, summary), PDF / text response, feedback and rating; notifications and optional email; password recovery; profile.

**AI and language:** floating RTI assistant (knowledge-base grounded, LLM when configured, clearly labelled fallback otherwise, never invents fees, deadlines, legal provisions or contacts); category and department suggestions; semantic search over historical records (MiniLM) with a labelled TF-IDF fallback; RAG draft generation with gap detection; Hindi detection and Hindi to English translation with the original always preserved; English / Hindi interface (partial, see limitations); light / dark theme, adjustable text size, skip link, keyboard and screen-reader labels.

**Officer:** queue ranked by explainable priority rules (overdue, nearly due, life or liberty keywords, drafts waiting) with the reasons shown; full review page (AI analysis, similar records, scores, gaps, translation, documents with OCR / text extraction, internal notes, status and action history); editor with letter preview; **quality checklist that must be completed before approval** (cleared by any edit); approve, return for rework, issue, reject with reason.

**Administrator:** overview analytics and system health (database, AI service, MiniLM, LLM, OCR, translation, SMTP), people, departments, historical records, all applications (reassign, re-route, re-run AI pipeline), audit log, support / feedback / email outbox inbox, platform settings (including response-target days), audited CSV exports, confirmation dialogs.

**Public:** landing page, Help & FAQ (searchable), contact form, and a **transparency dashboard** with anonymous aggregate statistics, filters, charts and CSV download. Demo data and platform data are always distinguished, and the page states that the figures are not government statistics.

**Workflow (enforced on the server):** `Submitted -> AI Analysis Completed -> Draft Generated -> Assigned -> Under Review -> Awaiting Approval -> Response Issued -> Closed` (or `Rejected -> Closed`). Approval is separate from issuing; a draft with placeholders or an incomplete checklist cannot be approved; editing resets approval. **Only the assigned officer can approve or issue. Administrators and the AI cannot.**

## Tech stack
| Area | Technology (versions as listed in `package.json` / `requirements.txt`) |
|---|---|
| Frontend | Next.js 14.2 App Router, React 18, **JavaScript (no TypeScript)**, Tailwind CSS 3.4, Framer Motion 11, Lucide React, Recharts 2 |
| Backend | Next.js API Route Handlers + Python FastAPI |
| AI | Python, sentence-transformers + PyTorch, **all-MiniLM-L6-v2**, cosine similarity, RAG, pluggable LLM (OpenAI / OpenAI-compatible / Anthropic / Gemini) |
| Database | MongoDB Atlas via Mongoose 8 (or the built-in JSON-file demo store) |
| Auth | bcrypt hashing via `bcryptjs` (pure-JS bcrypt, cost 12), signed JWT in an httpOnly cookie (`jose`), server-side role checks on every API route |
| Storage | Local files in `uploads/` (outside `public/`, served only through authorised API routes). Cloudinary is **not implemented** (it was optional). |

Note: `bcryptjs` is used instead of the native `bcrypt` package so that no C++ build tools are needed. It implements the same bcrypt algorithm and hash format.

## Architecture
```
Browser (Next.js pages, client components)
   | fetch /api/*  (httpOnly JWT cookie)
Next.js API routes  --> services/ (business rules, workflow, RBAC) --> lib/store (MongoDB via Mongoose | JSON demo store)
   | HTTP (optional X-AI-Token)
Python FastAPI AI service (classify / semantic search / department match / draft)
   | if unreachable -> lib/localAi.js (clearly labelled keyword + TF-IDF + template fallback)
```
* `middleware.js` gates page routes by role (defence in depth). **Every API route re-verifies the session, loads the user from the database and checks the role** (`lib/auth.js`, `lib/api.js`).
* Citizens can only read their own applications; a wrong or other-user ID returns 404 (no information leak). Officers see applications assigned to them or in their department but may only act on their own. Document downloads use the same rule.
* Status changes go through one function (`services/common.js: transition`) that validates the transition table in `lib/workflow.js` and writes status history. Issuing and rejecting run inside a store transaction (real MongoDB multi-document transaction on Atlas; snapshot/rollback in demo mode).
* Audit logs are written for officer and administrator actions.

## Folder structure
```
rti-ai-platform/
  app/                 Next.js App Router: pages (landing, login, register, citizen/, officer/, admin/, settings/) and api/
  components/          ui primitives, AppShell, tables, charts, AnalysisPanel, Timeline, Toast, Session
  hooks/               useApi
  lib/                 auth, api helper, validation, workflow, ai client, localAi fallback, file storage, rate limit, store/ (memory + mongo), seedData
  models/              Mongoose schemas (users, applications, departments, historical_records, response_drafts, notifications, status_history, audit_logs, settings)
  services/            applications.js (core workflow), admin.js, common.js
  scripts/seed.js      database seeding
  tests/               Node tests (workflow, RBAC, features), helpers/ (route-handler harness), e2e/ (Chromium scenarios)
  ai-service/          main.py, embeddings.py, classifier.py, semantic_search.py, response_generator.py, department_matcher.py, textutil.py, data/categories.json, tests/
  uploads/             local attachment storage (git-ignored)
  data/                demo-db.json is created here in demo mode (git-ignored)
```

## Setup
### Requirements
Node.js 18.18+ (20 or 22 recommended), npm, Python 3.10-3.12 (for the AI service), ~2 GB disk for PyTorch, internet for the first install and the first model download (~90 MB).

### 1. Install and configure
```bash
cd rti-ai-platform
npm install
cp .env.example .env          # Windows: copy .env.example .env
```
Leave `MONGODB_URI` empty for demo mode. Set `JWT_SECRET` to a random string for anything beyond local demos.

### 2. Python AI service (recommended)
```bash
cd ai-service
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --port 8000
```
The first start downloads all-MiniLM-L6-v2 from Hugging Face and loads it once in the background. Check `http://localhost:8000/health` (`embedding_model.loaded` becomes `true`). Interactive docs: `http://localhost:8000/docs`.

### 3. Seed demo data (optional in demo mode)
```bash
npm run seed              # seeds an empty database
npm run seed -- --reset   # wipes ALL collections, then seeds
```
Seeding runs six sample applications through the **real workflow** (analysis, draft, assignment, officer actions), so start the AI service first if you want the seeded analyses to use the MiniLM model. In demo mode, an empty store is also seeded automatically on first use, so this step can be skipped.

### 4. Run the web app
```bash
npm run dev        # http://localhost:3000
# production:  npm run build && npm start
```

### MongoDB Atlas setup
1. Create a free cluster at cloud.mongodb.com, a database user, and allow your IP under *Network Access*.
2. Copy the connection string (`mongodb+srv://USER:PASSWORD@CLUSTER.mongodb.net/rti_ai_platform?retryWrites=true&w=majority`) into `MONGODB_URI` in `.env`.
3. Run `npm run seed`. Indexes are created by Mongoose on first connection.

### LLM configuration (optional)
Set in `.env` (read by the Python service): `LLM_PROVIDER` (`openai`, `openai_compatible`, `anthropic`, `gemini`), `LLM_API_KEY`, `LLM_MODEL` (use a model name your account has access to), and `LLM_BASE_URL` for `openai_compatible`. Restart the AI service. Without these, drafts are labelled **"Template fallback: no LLM was used"**. If a configured LLM call fails, the draft falls back to the template and the reason is shown to the officer. The mode is stored with every draft and displayed in the editor.

## Optional services and configuration
Nothing below is required for demo mode. See `.env.example` for every variable.
* **LLM** (`LLM_PROVIDER`, `LLM_API_KEY`, `LLM_MODEL`): enables LLM answers in the assistant, rewriting, Hindi translation fallback and RAG drafts. Without it the app says "Fallback mode".
* **Email** (`SMTP_*`, `APP_BASE_URL`, optional `nodemailer`): real delivery of notifications and password-reset links. Without it, see the admin email outbox. In demo mode (no SMTP, not production) the forgot-password page shows the reset link so the flow can be demonstrated.
* **OCR / PDF text** (Python): `pip install pypdf pytesseract pdf2image Pillow` plus system packages `tesseract-ocr` and `poppler-utils` (and extra Tesseract language data for `OCR_LANGS`).
* **Local Hindi translation:** `pip install transformers sentencepiece` (downloads `Helsinki-NLP/opus-mt-hi-en` on first use).
* **Behind a proxy:** set `TRUST_PROXY=1` only if your proxy sets `X-Forwarded-For`; set `JWT_SECRET` and `NODE_ENV=production`.

## Demo mode (no credentials needed)
With `MONGODB_URI` empty the app stores everything in `data/demo-db.json` and shows a "Demo mode" badge. If the Python service is not running, analyses and drafts use `lib/localAi.js` and are labelled `local-js-fallback` with the reason. Seeded records and accounts carry **DEMO DATA** badges; applications filed by newly registered users are not marked as demo data. The demo store is single-process and intended for local demonstrations only.

## Demo logins
All seeded accounts share one password: **`Demo@12345`** (override with `DEMO_PASSWORD` *before* seeding). These exist only in seed data, never in application code paths.

| Role | Email |
|---|---|
| Administrator | `admin@rti-demo.test` |
| Officers | `officer.education@`, `officer.health@`, `officer.municipal@`, `officer.water@`, `officer.pwd@`, `officer.power@` + `rti-demo.test` |
| Citizens | `citizen1@`, `citizen2@`, `citizen3@` + `rti-demo.test` |

Suggested demo: sign in as `citizen1`, file a request about street lights or scholarships, then sign in as the matching officer, open the application, start review, edit the draft, send for approval, approve and issue; sign back in as the citizen to read the response.

## AI details
* **Embedding model:** `sentence-transformers/all-MiniLM-L6-v2` (384-d, L2-normalised), loaded once per process (`embeddings.py`).
* **Classification (`classifier.py`):** each category has a description, example requests and keywords (`ai-service/data/categories.json`). The request and each category centroid are embedded; score = cosine similarity + 0.05 per distinct keyword hit (capped 0.20); below 0.20 -> "Other". Without the model, a keyword-only fallback is used and labelled. **Scores are uncalibrated similarity-style scores, not probabilities.**
* **Department recommendation (`department_matcher.py`):** `0.60 x category handled + 0.25 x TF-IDF similarity to the department description + 0.15 x share of retrieved records from that department`. Officers can override it.
* **Semantic search (`semantic_search.py`):** record embeddings are stored in MongoDB (`embedding`, `embeddingModel`) and reused; only missing/stale ones are computed and persisted. Cosine similarity over all records is computed in Python (a documented brute-force alternative to Atlas Vector Search, fine for hundreds or a few thousand records). Fallback when the model is unavailable: TF-IDF cosine, labelled. Similarity does not prove authenticity or legal correctness.
* **RAG drafting (`response_generator.py`):** prompt = application + category + department + retrieved records (with extracted sentences) + items with no support. The LLM is instructed to use only the supplied context and to mark gaps `[TO BE VERIFIED BY OFFICER: ...]`. Missing-information detection is a **heuristic** (term overlap between each requested sentence and retrieved records); it flags likely gaps but cannot guarantee completeness.

## API reference
All JSON unless noted. Auth = httpOnly cookie `rti_session`. Roles are checked server-side on every route; mutating requests must be same-origin.

| Method & path | Role | Purpose |
|---|---|---|
| `POST /api/auth/register`, `/login`, `/logout` | public | Sign-up (citizen only), sign-in (per-IP limit + per-account lockout), sign-out |
| `POST /api/auth/forgot`, `/api/auth/reset` | public | Password recovery (single-use hashed token; same answer for unknown emails) |
| `GET/PATCH /api/auth/me` | any | Current user; profile; password change (revokes other sessions) |
| `GET/PUT /api/prefs`, `DELETE /api/prefs/history` | any | Language, theme, text size, email opt-out, recent searches |
| `GET /api/search?q=` | any | Own applications (incl. document text) + help articles |
| `GET /api/public`, `GET /api/help?q=`, `POST /api/support` | public | Mode and banner; FAQs, guides, glossary; contact form |
| `GET /api/public/stats?from&to&department&category&source&format=csv` | public | Anonymous aggregates and CSV |
| `GET/POST /api/assistant` | public (optional auth) | Suggested questions; chat (rate limited) |
| `POST /api/translate` | citizen | Hindi to English (503 with an explanation when unavailable) |
| `POST /api/assist/analyze` | citizen | Wizard suggestions: category, department, missing info, own similar requests |
| `GET/POST /api/drafts`, `GET/DELETE /api/drafts/:id` | citizen | Saved application drafts (no files stored) |
| `GET /api/departments` | any | Active departments |
| `GET /api/applications?search&status&category&department&from&to&sort&attention&page&pageSize` | any (role scoped) | List |
| `POST /api/applications` (multipart) | citizen | Submit (`applicant`, `translation`, `draftId` optional) |
| `GET /api/applications/:applicationId` | owner / officer / admin | Details (citizens never see drafts, records or notes) |
| `POST /api/applications/:id/actions` | officer / admin | `start_review, save_draft, save_checklist, mark_ready, approve, reject_draft, issue, reject_application, close, add_note, regenerate_draft` (assigned officer); `override_department, reanalyze` (officer, admin); `reassign, run_pipeline` (admin) |
| `GET /api/applications/:id/receipt` | owner / officer / admin | Acknowledgement PDF |
| `GET /api/applications/:id/response[?format=pdf]` | owner / officer / admin | Issued response (txt or PDF) |
| `POST /api/applications/:id/feedback` | citizen | Rating and comment after a response |
| `GET /api/documents/:id/:docId[?inline=1]` | owner / officer / admin | Authorised download or preview (CSP, nosniff) |
| `GET/POST /api/documents/:id/:docId/text` | owner / officer / admin | Cached / run text extraction (PDF text, OCR) and summary |
| `GET/PATCH /api/notifications`, `GET /api/stats` | any | Notifications; role-specific dashboard numbers |
| `/api/admin/{users,departments,records,audit,settings,system,export,support,support/:id}` | admin | Management, health, CSV exports, inbox |

**AI service (FastAPI):** `GET /health`, `POST /classify | /semantic-search | /analyze | /generate-response | /embed | /assistant | /translate | /extract` (see `/docs`). Optional `X-AI-Token`.

## Testing
```bash
npm test                                                   # 40 Node tests: route handlers for all roles, workflow, PDFs, security
cd ai-service && python -m unittest discover -s tests -v   # 29 Python tests incl. real pypdf / Tesseract OCR when installed
sh tests/e2e/go.sh                                         # browser scenarios (sandbox harness, see below)
```
`tests/helpers` runs the real route handlers outside Next.js with small stand-ins for `next/server` and, only when they are not installed, `jose` / `bcryptjs` / `nodemailer`.

**Browser harness (`tests/e2e`).** It bundles the real pages with esbuild, compiles the real Tailwind config, serves the real API handlers over HTTP on a temporary demo database, and drives Chromium through Playwright at 1366, 820 and 390 px. Because it runs without Next.js it uses stand-ins for the Next router / link, framer-motion (no animation), lucide-react (placeholder icons) and recharts (placeholder charts). Paths are configurable (`E2E_TOOLS`, `CHROME`). With a normal install, run the same scenarios against `npm run dev` with `BASE=http://localhost:3000 node tests/e2e/run.mjs` after pointing `E2E_TOOLS` at a `node_modules` that contains Playwright.

## Verification status (read this first)
Written and tested in a sandbox **without network access**, so `npm install` and `next build` could not run.

| Check | Result |
|---|---|
| `npm test`: 40 route-level tests (3 roles, CSRF, lockout, session revocation, uploads, drafts, assistant honesty, translation unavailability, PDFs validated with `qpdf` and `pdftotext`, feedback, recovery, CSV safety, anonymity of public statistics) | **Passed** |
| Python: 29 tests including **real** `pypdf` text extraction and **real Tesseract OCR** (text PDF, scanned PDF, image) | **Passed** |
| esbuild bundle of all 76 entry points (pages, components, middleware, API routes) | **Passed** |
| Chromium end-to-end: 11 scenarios (all roles, wizard to issued response, Hindi and drafts, assistant, admin tools, access control, 390 / 820 px overflow and form-label checks, theme / language / text-size persistence) | **Passed** against the harness |
| Visual review of screenshots (landing light / dark / Hindi, dashboards, wizard, editor, admin, transparency) | Done by eye on harness renders |
| `npm install`, `next build`, `next dev`, Next.js server rendering and hydration | **NOT RUN** |
| Real framer-motion animations, lucide icons, recharts charts (stand-ins were used) | **NOT RUN**: chart appearance is unverified |
| Python service started with FastAPI; real MiniLM; LLM calls; local Hindi translation model | **NOT RUN** (the app ran on its labelled fallbacks) |
| MongoDB / Mongoose, real `bcryptjs` / `jose`, SMTP delivery | **NOT RUN** (a scrypt / HMAC stand-in and the demo store were used) |
| Screen readers, measured colour contrast, browsers other than Chromium, real phones | **NOT TESTED** |

Bugs found by this testing are listed in `CHANGELOG.md`. Expect a short first session of small fixes after `npm install`.

## Troubleshooting
* **First submission is slow:** the AI service is downloading or loading the model. Watch `/health`. Raise `AI_TIMEOUT_MS` if needed.
* **Analyses say "local-js-fallback":** the AI service is not reachable at `AI_SERVICE_URL`, or `AI_SERVICE_TOKEN` differs between the two sides.
* **Drafts say "Template fallback":** `LLM_PROVIDER`, `LLM_API_KEY` and `LLM_MODEL` are not all set, or the call failed (the reason is shown in the editor).
* **`Could not connect to MongoDB`:** check the connection string, the database user and Atlas *Network Access*.
* **Cannot approve a draft:** the text still contains `[TO BE VERIFIED BY OFFICER...]`, `[OFFICER TO INSERT...]` or the template banner. Resolve and remove them.
* **Reset everything:** demo mode: delete `data/demo-db.json`; MongoDB: `npm run seed -- --reset`.
* **Fonts missing offline:** Google Fonts are loaded by CSS and fall back to system fonts.

## Known limitations
* Not production hardened: in-memory rate limiter (per process), demo store is single-process, no email verification, no two-factor authentication.
* **Hindi interface coverage is partial**: navigation, landing hero, sign-in / registration, citizen dashboard, wizard headings, assistant and key labels. Other pages, the help articles and the assistant's built-in knowledge base are English (with an LLM configured the assistant answers in Hindi).
* Hindi to English translation needs the optional local model (`transformers`, `sentencepiece`) or an LLM; otherwise the app says translation is unavailable. Machine translations can be wrong; the original text is authoritative.
* OCR needs the Tesseract program (and Poppler for scanned PDFs); only English is installed by default (`OCR_LANGS`). OCR text can contain errors and the UI says so. Summaries are extractive (key sentences), not AI-written.
* PDF files use the standard Latin fonts: non-Latin text (for example Devanagari in a subject) is replaced by `?` in generated PDFs. The on-screen and plain-text versions keep the original text.
* The assistant knowledge base is a short curated set of general statements. It deliberately contains no fees, URLs, phone numbers or e-mail addresses and is not legal advice. Retrieval is TF-IDF plus curated keywords: it scored 13/13 on the 13 questions its keywords were tuned on, but only **4/8 on 8 fresh questions** (5/8 if the glossary entry for "proactive disclosure" counts). Paraphrases that share no words with an entry are missed; below a confidence threshold the assistant says it does not know, but a related-yet-not-exact article can still be returned and is shown with its source title. Embedding-based retrieval (MiniLM, already used for historical records) would be the natural next step.
* Response deadlines use a platform setting (default 30 days). It is a reminder and priority signal, not a legal determination.
* Email needs SMTP configuration and the optional `nodemailer` package; otherwise messages are stored in the admin outbox and marked "not sent".
* Statistics are of this installation only and say so. With tiny numbers a single request moves percentages a lot.
* All records are sent to the AI service for every analysis; use Atlas Vector Search for large corpora. Application search runs in the server over the user's rows (fine at demo scale).
* Cloudinary storage is not implemented; attachments are stored on local disk.

