# FactoryMind AI

> **Detect anomalies. Prioritize maintenance. Protect production.**

FactoryMind AI is an industrial predictive-maintenance intelligence platform. It ingests plant sensor telemetry, executes statistical anomaly detection, quantifies financial downtime exposure, and provides bilingual (English / Urdu) investigation tools for plant technicians and reliability engineers.

## Key Features

1. **Multi-Channel Anomaly Detection**: Analyzes vibration velocity, temperature profiles, and motor current draws against baseline distributions (Median and MAD) to identify emergent machine degradation.
2. **Business Impact & Criticality Engine**: Deterministically quantifies downtime exposure (`Downtime_Hours × Loss_Rate + Repair_Cost`) and ranks asset maintenance priorities without LLM hallucination.
3. **Bilingual Support (English & Urdu)**: Comprehensive localization with automatic Right-to-Left (RTL) layout switching and typography tailored for Urdu users (Noto Naskh Arabic & IBM Plex Sans).
4. **Deterministic Demo Mode & CSV Ingestion**: Built-in 4-asset demo dataset (CNC-01, PRESS-04, PUMP-12, CONV-02) alongside drag-and-drop CSV upload with automatic column mapping and validation.
5. **Tool-Grounded Multilingual AI Assistant**: Interactive investigation assistant capable of querying live telemetry, past maintenance logs, and financial models, fully grounded in the active dataset ID.
6. **Downloadable Maintenance Reports**: One-click generation of evidence-backed reports with actionable inspection checklists in Markdown, Plain Text, or PDF format (via jsPDF).

---

## Architecture & Project Structure

### Canonical Frontend & Backend
- **Canonical Frontend**: Located at the workspace root (`/src`, `package.json`, `vite.config.ts`), built with **React 19 SPA, Vite, and Tailwind CSS v4**. This is the authoritative running application for FactoryMind AI.
- **Backend Service**: Located in `/backend`, built with **Python FastAPI, SQLAlchemy, and Pandas**, exposing REST endpoints under `/api/v1`.
- **Nested `frontend/` Directory**: Contains an alternate Next.js scaffold. It is preserved safely for reference but is unmounted in this deployment environment; the root Vite SPA is the canonical frontend communicating directly with the FastAPI backend.

---

## Development & Local Execution

### 1. Backend (FastAPI)
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### 2. Frontend (React / Vite)
In the project root:
```bash
npm install
npm run dev
```
(Vite development server runs on port 3000 and proxies API requests to backend).

### Build for Production
```bash
npm run build
```
