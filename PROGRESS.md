# FactoryMind AI: Progress Log

_Last updated at the end of Phase 1. Only things that were actually run are listed as verified._

## Where this was built
Built and tested in a **temporary Claude sandbox workspace** (a clone of the GitHub repo), not directly in
the GitHub repository. Nothing has been committed, pushed or deployed.

## Phase 1: Foundation: **complete and verified**

### Implemented
- **Backend (FastAPI):** app factory, `/api/v1/health` (checks the database), JSON structured logging,
  one error shape `{"error": {code, message, details?}}` with no stack traces to users, narrow CORS
  (exact origins only, wildcards rejected), OpenAPI docs at `/docs`.
- **Config:** all settings from environment variables (`backend/.env.example`). `DATABASE_URL` accepts Neon-style
  `postgresql://` / `postgres://` URLs and is converted to the `psycopg` v3 driver. Passwords are redacted by a helper.
- **Database:** SQLAlchemy models for all 11 tables in the Phase 0 schema, Alembic initial migration `0001`.
  Every table has `workspace_id` (default 1) for future multi-user support.
- **Frontend (Next.js 16, TypeScript, Tailwind):** responsive shell (sidebar becomes a drawer on mobile),
  dashboard page with a real backend-connection card (loading / connected / degraded / error + retry states),
  an honest empty state, light/dark theme, English/Urdu switch with RTL layout and Urdu font.
- **Deployment config (not deployed):** `backend/railway.json`, `backend/.python-version`, `frontend/vercel.json`,
  `.github/workflows/ci.yml`.

### Verified (commands actually run, from a fresh copy with clean installs)
| Check | Result |
|-------|--------|
| `ruff check .` (backend) | passed |
| `mypy app` (backend, strict) | passed, 16 files |
| `pytest` (backend) | **12 passed** |
| `alembic upgrade head` on SQLite | succeeded |
| `alembic upgrade head`, `downgrade base`, `upgrade head` on **local PostgreSQL 16** | succeeded; all 11 tables created |
| `/api/v1/health` against PostgreSQL | `"database_engine":"postgresql"`, status ok |
| `npm ci` | succeeded |
| `npm run lint`, `npm run typecheck` | passed |
| `npm test` (vitest) | **11 passed** (3 files) |
| `npm run build` | succeeded (static `/` and `/_not-found`) |
| Real backend + real built frontend, driven by headless Chromium | page showed "Connected" from the live API; Urdu set `lang=ur dir=rtl`; sidebar on the right in RTL and in view; mobile drawer opens in view; no horizontal scroll; no console errors |
| Live CORS | allowed origin gets the header; `https://evil.example` does not |

A real RTL bug (sidebar pushed off-screen on desktop in Urdu) was found in the browser check and fixed.

### NOT verified
- **A real Neon database.** I have no Neon credentials. PostgreSQL behaviour was checked on a local PostgreSQL 16 only.
  Neon-specific URL options (`sslmode=require`, `channel_binding`) are supported by the driver but untested here.
- **Railway and Vercel deploys**, and the **GitHub Actions workflow** (never run on GitHub).
- **Windows.** The Windows commands are standard, but I ran everything on Linux.
- Screen-reader behaviour and accessibility beyond basics (labels, focus styles, skip link, contrast by design).

## Deviations from the Phase 0 plan
1. **No `next-intl`.** This Next.js version has Cache Components enabled, where reading cookies in the root layout blocks
   rendering of every page. i18n is a small client-side provider (`frontend/src/lib/i18n`) using `localStorage`, plus an inline
   script that sets `lang`/`dir` before first paint. Fewer dependencies; no server cookie needed.
2. **Theme toggle is light/dark only** (it starts from the system setting); there is no separate "system" button.
3. **Fonts come from `@fontsource` npm packages** (not Google Fonts) so builds work offline and nothing is fetched at runtime.

## Known issues
- `npm audit` reports 5 high-severity findings, all in dev-only linting tooling (`eslint-config-next` -> `fast-glob`).
  Production dependencies: 0 findings. Not fixed on purpose (`npm audit fix --force` would force breaking upgrades).
- Pytest shows one deprecation warning from Starlette's test client about `httpx`; harmless for now.
- Urdu text is a first draft written by Claude; a fluent Urdu speaker should review wording before judging.
- Navigation items for later phases are shown as disabled with a "Planned" badge, not as working links.
- Next.js writes `frontend/AGENTS.md`; it is kept because Next regenerates it.

## Remaining (not started)
Phases 2-9 of `docs/PHASE0_PLAN.md`: CSV/Excel upload and validation, Isolation Forest and alerts, business-impact engine,
demo dataset, data-driven dashboard, multilingual AI agent, PDF and reports, deployment verification, hackathon prep.

## Assumptions still open
Hosting is now decided (Vercel / Railway / Neon). Still open: real sample sensor data for testing column mapping, and whether a
PDF report is mandatory or Markdown/HTML is acceptable.

## Pinned versions (as resolved during Phase 1)
Backend: fastapi 0.143.2, uvicorn 0.54.0, pydantic 2.14.1, pydantic-settings 2.16.0, sqlalchemy 2.1.4, alembic 1.20.0,
psycopg 3.3.6, python-multipart 0.0.32; dev: pytest 9.1.1, httpx 0.28.1, ruff 0.17.1, mypy 2.4.0.
Frontend: see `frontend/package.json` and `package-lock.json` (Next 16.4.1, React 19.3.0).
