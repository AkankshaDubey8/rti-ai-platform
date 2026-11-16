# Changelog

## v2: civic-tech upgrade (this release)

### Phase 1: audit and fixes
Method: read the whole codebase, ran the existing tests, then built a harness that executes the **real API route handlers** in-process (`tests/helpers`) so every route could be tested for every role.
Fixed:
- Mutating requests had no CSRF defence beyond SameSite cookies: added Origin / Sec-Fetch-Site checks (`lib/api.js`).
- Old sessions survived a password change: added `tokenVersion` to the JWT and user (`lib/auth.js`).
- Rate limiting was IP-only and trusted any `X-Forwarded-For`: added per-account lockout and `TRUST_PROXY` (`lib/rateLimit.js`).
- Uploads were fully read into memory before the file-count check (`app/api/applications/route.js`).
- Three Tailwind opacity classes were invalid and silently ignored in the sidebar (`bg-white/12`, `/8`); notifications did not link to their application.
Files: `lib/api.js lib/auth.js lib/rateLimit.js models/index.js app/api/auth/{login,me}/route.js app/api/applications/route.js components/AppShell.jsx tests/**`.

### Phase 2: design system
Royal-blue/navy brand palette, Inter, CSS-variable dark mode (system / light / dark), text-size control, skip link, reduced-motion support, page transitions, animated counters, confirmation dialogs, toasts, skeletons, empty and error states, responsive shells, new public site shell with footer and disclaimer, rebuilt landing page (hero, how it works, live demo-labelled statistics, features, FAQ, fictional-labelled testimonials, CTAs).
Files: `tailwind.config.js app/globals.css app/layout.js app/template.js app/page.js components/{ui,Session,Confirm,AnimatedNumber,PrefsMenu,PublicShell,AppShell}.jsx`.

### Phase 3: citizen workspace and smart application builder
Seven-step wizard with live preview, per-step validation, saved drafts (resume / delete), AI suggestions (category, department, rule-based missing-information checks, similar-request warnings against the citizen's own requests only), real upload progress, explicit confirmation before submit, downloadable PDF acknowledgement. Personal dashboard (attention items, deadlines, activity, quick actions, recently viewed, progress tracker). Application list with search (including text found inside documents), status / category / date / department filters, sorting, page size. Detail page with deadline, PDFs, translation, documents, feedback.
Files: `app/citizen/** lib/{pdf,deadlines,requestRules,lang,csv}.js services/{drafts,assist,documents}.js app/api/{drafts,assist,applications/[id]/{receipt,feedback}}/**`.

### Phase 4: assistant and multilingual
Floating RTI assistant: grounded in a curated knowledge base (`ai-service/data/rti_knowledge.json`), intents for department suggestion, missing information and rewriting, LLM answers through the Python service when configured, otherwise a clearly labelled **fallback mode**. Never invents fees, deadlines, legal provisions or contact details (tested). English / Hindi interface (partial coverage, see limitations), Hindi detection, Hindi to English translation via local model or LLM (reports unavailable instead of faking), original text always preserved and translations clearly labelled.
Files: `lib/{i18n,kb}.js services/assist.js components/AssistantWidget.jsx ai-service/{assistant,translate}.py`.

### Phase 5: officer and administrator
Officer: queue ranked by explainable priority rules, deadlines, internal notes (never visible to citizens), server-enforced quality checklist before approval (cleared by any edit), letter preview, translation and applicant details. Administrator: health monitoring (database, AI service, model, LLM, OCR, translation, SMTP), activity charts, CSV exports (audited, no passwords, no request text), support / feedback / email outbox inbox, response-deadline setting, confirmation dialogs. Approval and issuing rules are unchanged: only the assigned officer can approve or issue; administrators cannot.
Files: `app/officer/** app/admin/** services/{applications,admin,account}.js lib/checklist.js`.

### Phase 6: transparency and document intelligence
Public `/transparency` dashboard (anonymous aggregates, date / department / category / data-source filters, demo vs platform data clearly separated, CSV download). Documents: authorised inline preview, text extraction (PDF text layer, Tesseract OCR for scans and images), extractive summaries, searchable contents, PDF receipts and responses.
Files: `app/transparency/page.js services/public.js ai-service/extract.py components/DocumentsPanel.jsx`.

### Phase 7: security, reliability, tests
Password recovery (hashed single-use tokens, no account enumeration), email notifications with outbox, per-user preferences, support tickets, CSV formula-injection protection, CSP on document responses. Fixed during browser testing: grid items stretching pages on phones, wizard stepper overflow on tablets, `<div>` inside `<p>` (hydration error), invalid CSP quoting, textarea height, toast position, checklist latency.
Tests: 40 Node (route-level) + 29 Python + 11 browser scenarios (see README, "Verification status").
