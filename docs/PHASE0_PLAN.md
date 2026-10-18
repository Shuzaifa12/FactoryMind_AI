# FactoryMind AI — Phase 0 Plan

**Status:** Draft for review. No application code has been written yet.
**Repo inspected:** `Shuzaifa12/FactoryMind_AI` (branch `main`): one commit ("Initial commit"), one file (`README.md`, two sentences). The project is empty, so we start from scratch.
**Local toolchain available when I checked (in my sandbox, not necessarily yours):** Python 3.12, Node 22, npm 10.

---

## 1. Requirements and acceptance criteria

Each requirement has a testable acceptance criterion (AC).

| ID | Requirement | Acceptance criterion |
|----|-------------|----------------------|
| R1 | Upload CSV/XLSX/XLS sensor data | A valid file produces a preview, a column-mapping step, and a validation report before processing. |
| R2 | Data validation | Bad timestamps, non-numeric values, duplicates, and missing data are each reported with counts and row examples. Nothing is silently filled in. |
| R3 | PDF ingestion | Text/tables are extracted and stored as maintenance *context*. PDF text is never loaded as sensor time-series. Extraction limits are shown to the user. |
| R4 | Anomaly detection | Isolation Forest runs on validated numeric features. If data is too small, a labeled rule-based fallback runs instead. |
| R5 | Alerts | Every alert holds machine ID, time range, score, rule-based severity, feature evidence, data-quality warnings, inspection steps, and the "not a confirmed failure" statement. |
| R6 | Business impact | Pure Python functions, unit-tested, no LLM involvement. Missing assumptions yield `null`/"unknown", never a made-up number. |
| R7 | Dashboard | All cards, charts, tables, and rankings come from backend endpoints. Uploading a new dataset visibly changes them. |
| R8 | Demo mode | One "Load Demo Data" action resets and loads a deterministic simulated dataset. It is labeled "SIMULATED" in the UI and in reports. |
| R9 | AI agent | Provider-independent. It answers only from tool results. With no provider configured, it returns a clear error and the rest of the app still works. |
| R10 | Bilingual | English and Urdu UI, agent output, and reports. Urdu renders right-to-left. Sensor names and numbers are preserved. |
| R11 | Reports | A downloadable report contains real alert evidence, labeled assumptions, and a human-review disclaimer. |
| R12 | Theme and responsiveness | Dark/light theme. Usable at 360px width through desktop. |
| R13 | Security | File type/size/content checks, narrow CORS, no stack traces to users, no secrets in code, and an agent restricted to a fixed tool allow-list. |
| R14 | Independent deploy | Frontend and backend deploy separately, configured only through environment variables. |

---

## 2. Assumptions and open questions

**Assumptions I am making (tell me if any are wrong):**

1. Single workspace, no login. Every table carries a nullable `workspace_id` (default `1`) so auth can be added later without a schema rewrite.
2. Report download format: **PDF and Markdown**. Urdu PDF needs a bundled Urdu-capable font (e.g., Noto Naskh Arabic) and text shaping, which is a known rough spot; Markdown/HTML export is the safe fallback.
3. Size limits: 10 MB per file and 200,000 rows per dataset for the MVP (configurable).
4. Anomaly detection runs per machine when a machine has at least 200 valid rows (configurable). Otherwise it uses a pooled model across machines, and if that is still too small, the rule-based fallback.
5. Severity is computed from explicit rules (score percentile, number of features deviating, duration), **not** from the raw model score alone.
6. Demo cost figures are illustrative and shown with an "illustrative assumption" label everywhere.

**Open questions (not blocking Phase 1):**

- **Hosting choice** for backend and database. My default is **Vercel (frontend) + Render or Railway (backend) + managed Postgres (e.g., Neon)**. Free tiers can sleep or wipe local disks, so I'd avoid relying on SQLite in production. Do you have a preference or existing accounts?
- Do you have **real sample data** (even a few rows) to test column mapping against, or should I design only against synthetic data for now?
- Is a **PDF report** mandatory, or is Markdown/HTML acceptable if Urdu PDF rendering proves unreliable?

I won't ask about the AI provider or authentication, per your instructions.

---

## 3. Architecture and data flow

```
 Browser (Next.js, TS, Recharts, i18n EN/UR, RTL, theme)
        │  HTTPS / JSON (typed client generated from OpenAPI)
        ▼
 FastAPI backend
   ├─ api/          routers (thin: validate, call service, return schema)
   ├─ services/     ingestion, validation, detection, alerts, impact,
   │                maintenance, reports, demo
   ├─ ml/           preprocessing, isolation_forest, fallback_rules, explain
   ├─ ai/           provider interface, adapters, tool registry, agent loop
   ├─ db/           SQLAlchemy models, session, Alembic migrations
   └─ core/         config, logging, errors, security
        │
        ▼
 SQLite (local)  /  Postgres (production)   +   file storage (uploads dir / object storage)
```

**Data flow for an upload:**

1. `POST /datasets/upload` stores the file under a random server-side name, records metadata, and returns a preview with detected columns and a suggested mapping.
2. The user confirms or edits the mapping with `POST /datasets/{id}/mapping`. The backend returns a validation report.
3. `POST /datasets/{id}/process` imports readings, then runs detection, generates alerts, and computes impact.
4. The frontend reads everything via GET endpoints scoped by `dataset_id`.

**Design principles:**

- **Separation of four things that must not blur:** model score → anomaly label → severity rule → business-impact rank. Each is stored in its own field.
- The LLM never computes numbers. Agent tools call the same service functions as the dashboard.
- Processing runs as a FastAPI background task, with a `processing_runs` status row the UI polls. No Celery or Redis.

---

## 4. Database schema (SQLAlchemy)

All tables have `id`, `created_at`, and `workspace_id` (nullable, default 1).

- **datasets**: `name`, `source` (`demo` | `upload`), `is_simulated` (bool), `original_filename`, `stored_path`, `file_type`, `size_bytes`, `status` (`uploaded|mapped|processing|ready|failed`), `column_mapping` (JSON), `quality_report` (JSON), `row_count`, `is_active`
- **machines**: `dataset_id`, `external_id`, `name`, `criticality` (1–5, nullable), `production_priority` (nullable), `loss_per_hour` (nullable), `maintenance_cost_estimate` (nullable), `assumption_source` (`user|illustrative|unknown`)
- **sensor_readings**: `dataset_id`, `machine_id`, `timestamp`, `temperature`, `vibration`, `current`, `status`, `extra` (JSON for additional numeric columns). Indexed on `(dataset_id, machine_id, timestamp)`.
- **processing_runs**: `dataset_id`, `method` (`isolation_forest|rule_fallback`), `config` (JSON: contamination, features, scaler, imputation, per-machine vs pooled, random_seed), `status`, `started_at`, `finished_at`, `error_summary`, `library_versions` (JSON)
- **alerts**: `dataset_id`, `run_id`, `machine_id`, `start_ts`, `end_ts`, `anomaly_score`, `is_anomaly_label`, `severity` (`low|medium|high|critical`), `severity_reason` (JSON of rules fired), `evidence` (JSON: per-feature value vs baseline median/MAD or z-score), `data_quality_warnings` (JSON), `inspection_steps` (JSON), `status` (`open|reviewed|dismissed`)
- **impact_estimates**: `alert_id`, `assumed_downtime_hours`, `downtime_loss`, `maintenance_cost`, `total_estimated_impact`, `priority_score`, `inputs_used` (JSON), `missing_inputs` (JSON), `formula_version`
- **maintenance_records**: `dataset_id`, `machine_id` (nullable if unmatched), `date`, `description`, `source` (`csv|pdf`), `source_document_id`, `match_confidence` (`exact_id|user_confirmed|unmatched`)
- **documents**: `dataset_id`, `filename`, `stored_path`, `extracted_text_preview`, `page_count`, `extraction_notes` (JSON limitations)
- **investigations**: `alert_id`, `language`, `provider`, `messages` (JSON), `tool_calls` (JSON), `status`
- **reports**: `dataset_id`, `alert_id` (nullable), `language`, `format`, `file_path`, `is_simulated`, `assumptions` (JSON)
- **app_settings**: key/value (default sensitivity, size limits, language)

---

## 5. API contract (v1, prefix `/api/v1`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness and DB check |
| POST | `/demo/load` | Reset and load the deterministic demo dataset, then process it |
| GET | `/datasets` · `/datasets/{id}` | List / detail |
| POST | `/datasets/upload` | Upload CSV/XLSX/XLS/PDF, returns preview and suggested mapping |
| POST | `/datasets/{id}/mapping` | Confirm column mapping, returns validation report |
| GET | `/datasets/{id}/quality` | Data-quality report |
| POST | `/datasets/{id}/process` | Run detection (body: sensitivity, features) |
| GET | `/datasets/{id}/runs/{run_id}` | Processing status |
| POST | `/datasets/{id}/activate` | Set the active dataset |
| GET | `/datasets/{id}/summary` | Overview card figures |
| GET | `/datasets/{id}/machines` | Machine table with status and priority |
| GET | `/machines/{id}` | Machine detail |
| GET | `/machines/{id}/readings` | Time series (params: sensors, from, to, downsample) |
| GET | `/datasets/{id}/alerts` | Filters: severity, machine, status |
| GET | `/alerts/{id}` | Full evidence |
| PATCH | `/alerts/{id}` | Update review status |
| GET | `/alerts/{id}/impact` | Impact breakdown |
| PUT | `/machines/{id}/assumptions` | Set cost / criticality assumptions |
| POST | `/investigations` | Agent investigation (body: alert_id, question, language) |
| POST | `/reports` | Generate report (alert or dataset, language, format) |
| GET | `/reports/{id}/download` | Download the report |
| GET | `/ai/status` | Whether a provider is configured (never returns keys) |

Errors use one shape: `{ "error": { "code", "message", "details?" } }`. OpenAPI docs are served at `/docs`.

**Agent tools (allow-listed, read-only except report generation):** `get_alert_details`, `get_machine_history`, `get_sensor_summary`, `calculate_business_impact`, `get_dataset_quality_report`, `search_maintenance_records`, `generate_maintenance_report`. Each has typed arguments and checks that the referenced IDs belong to the active workspace.

---

## 6. Proposed directory structure

```
FactoryMind_AI/
├── README.md
├── docs/                 PHASE0_PLAN.md, ARCHITECTURE.md, DEMO.md, DATASET.md, LIMITATIONS.md
├── backend/
│   ├── pyproject.toml
│   ├── .env.example
│   ├── alembic/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/    (config.py, logging.py, errors.py, security.py)
│   │   ├── db/      (models.py, session.py)
│   │   ├── schemas/
│   │   ├── api/     (health.py, datasets.py, machines.py, alerts.py, ai.py, reports.py, demo.py)
│   │   ├── services/ (ingestion.py, validation.py, pdf_extract.py, detection.py,
│   │   │              alerts.py, impact.py, maintenance.py, reports.py, demo.py)
│   │   ├── ml/      (preprocess.py, iforest.py, rules.py, explain.py)
│   │   └── ai/      (base.py, registry.py, adapters/, tools.py, agent.py, prompts/)
│   ├── data/demo/   (generator script and generated files)
│   └── tests/
├── frontend/
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── app/          (dashboard, machines, alerts, upload, assistant, reports)
│       ├── components/
│       ├── lib/          (api client, i18n)
│       ├── messages/     (en.json, ur.json)
│       └── tests/
└── .github/workflows/ci.yml
```

---

## 7. Dependency plan

I will use current stable releases at install time and pin the versions that actually resolve. I will not guess version numbers from memory. Context7 docs aren't available in my environment, so I'll check official docs and `pip`/`npm` output directly.

- **Backend:** fastapi, uvicorn, pydantic (v2) + pydantic-settings, sqlalchemy, alembic, pandas, numpy, scikit-learn, openpyxl (xlsx), xlrd (legacy xls), pdfplumber (PDF text/tables), python-multipart, httpx, reportlab or weasyprint for report PDFs (decide in Phase 7 after an Urdu rendering test), pytest, ruff, mypy.
- **Frontend:** next, react, typescript, recharts, a small i18n solution (`next-intl`), `next-themes`, a lightweight component layer (Tailwind + Radix primitives or shadcn/ui), lucide-react, vitest + React Testing Library, and Playwright only if time allows.
- **Not adding:** Celery, Redis, Docker-compose orchestration, vector databases, or auth libraries (for now).

---

## 8. Deployment strategy

- **Frontend:** Vercel (or any Node host). Env: `NEXT_PUBLIC_API_BASE_URL`.
- **Backend:** Render or Railway as a web service. Env: `DATABASE_URL`, `CORS_ORIGINS` (the exact frontend origin only), `AI_PROVIDER`, `AI_API_KEY`, `MAX_UPLOAD_MB`, `UPLOAD_DIR`.
- **Database:** SQLite locally, managed Postgres in production (same SQLAlchemy models, Alembic migrations).
- **Uploads:** local disk in development. Free-tier hosts usually have ephemeral disks, so uploaded files and generated reports can disappear on restart; for production I'd store them in the database or object storage. Processed data in Postgres survives either way.
- **Cold starts:** free tiers may sleep. The demo flow should be rehearsed shortly before judging.
- A single `ci.yml` runs backend tests/lint/types and frontend lint/tests/build.

---

## 9. Main technical risks

| Risk | Mitigation |
|------|-----------|
| Urdu PDF rendering (shaping, RTL, fonts) | Test early in Phase 7; fall back to HTML/Markdown export and say so |
| Messy real-world column names/units | Mapping UI plus user-confirmed units; never auto-convert silently |
| Isolation Forest flags many "anomalies" with no operational meaning | Severity rules, minimum duration, grouping of consecutive anomalous rows into events, and clear labeling as "unusual", not "failing" |
| Small datasets | Explicit minimum-row checks and a labeled rule-based fallback |
| Agent hallucination | Tools return structured evidence. The prompt forbids unsupported claims, tests assert that the answer references tool output, and a "no evidence" path is covered |
| Ephemeral hosting storage | Postgres in production; documented limits |
| Provider unknown | Adapter interface plus a mock provider used in all tests |
| Scope | Phases 2–5 are the priority; the agent and PDF work come after a working core |

---

## 10. Milestone plan

Phases 1–9 as in your master prompt. At the end of each I will give: files changed, start commands, a verification checklist, and the test output I actually ran. A running log (completed / remaining / assumptions / known issues) will live in `docs/PROGRESS.md`.

**Phase 1 will deliver:** monorepo skeleton, FastAPI app with `/health`, config and logging, SQLAlchemy models and first migration, Next.js shell with navigation, theme toggle, EN/UR switch with RTL, an API client, and a passing smoke test on each side.
