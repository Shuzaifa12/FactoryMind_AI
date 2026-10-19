# FactoryMind AI

> **Detect anomalies. Prioritize maintenance. Protect production.**

FactoryMind AI is an AI-powered predictive maintenance platform designed to help factories identify unusual machine behavior, investigate potential maintenance issues, and understand their estimated business impact.

The application combines sensor-data analysis, anomaly detection, maintenance prioritization, and an English/Urdu AI assistant in one platform.

**Live Application:** https://factory-mind-ai-2frh.vercel.app/
**Backend API:** https://factory-mind-ai-seven.vercel.app/docs
**GitHub Repository:** https://github.com/Shuzaifa12/FactoryMind_AI

---

## 1. Problem Statement

Factories depend on industrial machines to maintain production. Unexpected machine problems can lead to:

- Unplanned downtime and production delays.
- Expensive emergency maintenance and repairs.
- Difficulty identifying unusual machine behavior early.
- Limited visibility into which machines require attention first.
- Time-consuming investigation of sensor data and maintenance records.

Traditional maintenance approaches may rely heavily on scheduled inspections or repairing equipment after a problem occurs. Smaller manufacturers may also lack access to expensive predictive-maintenance systems.

## 2. Our Solution

FactoryMind AI helps maintenance teams analyze machine data, identify unusual patterns, and prioritize inspections.

The platform aims to make predictive maintenance more accessible by combining machine-learning techniques with transparent business-impact calculations and AI-assisted investigations.

Its results are intended to support maintenance decisions, not replace professional inspection or confirm that a machine has failed.

## 3. Key Features

- **Anomaly Detection:** Analyze machine sensor readings to identify unusual behavior and potential maintenance concerns.
- **Sensor Data Upload:** Upload supported CSV data and inspect the resulting analysis.
- **Data Validation:** Help identify data-quality problems before relying on analysis results.
- **Business Impact Analysis:** Estimate potential downtime-related losses and repair costs when the required inputs are available.
- **Maintenance Prioritization:** Help users focus on machines and alerts that may require earlier investigation.
- **AI Investigation Assistant:** Ask questions about alerts, sensor evidence, maintenance information, and available impact estimates.
- **English and Urdu:** Support bilingual interaction, including right-to-left presentation for Urdu.
- **Maintenance Reports:** Generate downloadable reports in supported formats, including PDF.
- **Demo Workflow:** Explore the application using prepared simulated data.
- **Interactive Dashboard:** Review machine information, alerts, and analysis results.

## 4. How the Application Works

The typical workflow is:

1. **Load demo data or upload a dataset.** Provide prepared demonstration data or supported machine sensor data.
2. **Validate the data.** Review available columns, missing values, and data-quality concerns.
3. **Analyze machine behavior.** Apply the configured anomaly-detection approach to identify unusual observations.
4. **Review alerts.** Examine the relevant machine, sensor evidence, and anomaly information.
5. **Evaluate business impact.** Review estimates based on available downtime, production-loss, and repair-cost information.
6. **Investigate with AI.** Ask questions about an alert and the evidence available to the assistant.
7. **Generate a maintenance report.** Produce a report that helps technicians review findings and suggested inspection steps.

An anomaly is an unusual pattern, not proof of equipment failure. Recommendations and financial estimates should be reviewed by qualified personnel.

## 5. Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Lucide React
- jsPDF and jsPDF AutoTable

### Backend

- Python
- FastAPI
- SQLAlchemy
- pandas and NumPy
- scikit-learn
- Pydantic
- Uvicorn

### Database and AI

- SQLAlchemy-supported database configuration
- PostgreSQL-compatible database support through the configured database connection
- Configurable AI integration using the backend's environment settings

### Architecture

The project contains two main application components:

- **Frontend:** The root project directory contains the React and Vite application.
- **Backend:** The `backend/` directory contains the FastAPI application and its API services.

The frontend and backend can be developed and deployed independently.

The `frontend/` directory also contains a separate Next.js scaffold; the root React/Vite application is the canonical frontend described in this README.

## 6. Project Structure

```text
FactoryMind_AI/
├── src/                    # React frontend source
├── public/                 # Public frontend assets
├── backend/
│   ├── app/                # FastAPI application
│   ├── tests/              # Backend automated tests
│   └── requirements.txt    # Python dependencies
├── frontend/               # Separate Next.js scaffold
├── package.json            # Frontend scripts and dependencies
├── vite.config.ts          # Vite configuration
├── README.md               # Project documentation
└── .gitignore              # Git ignore rules
```

Some additional configuration and environment files may exist in the repository.

## 7. Prerequisites

Install the following before running the project locally:

- Git
- Node.js and npm
- Python
- A configured database, if required by the selected backend settings
- An AI provider configuration, if AI-provider functionality is required

Use compatible versions of Node.js and Python for the dependencies installed in your environment.

## 8. Run the Project Locally

Run the frontend and backend in separate Command Prompt windows.

### Step A — Clone the repository

If you do not already have the project:

```cmd
git clone https://github.com/Shuzaifa12/FactoryMind_AI.git
cd FactoryMind_AI
```

If the repository is already on your computer, open CMD in the existing project directory instead.

### Step B — Configure the backend

Open a new CMD window and enter the backend directory:

```cmd
cd /d "D:\AI Course\FactoryMind_AI\backend"
```

Create a virtual environment:

```cmd
py -m venv .venv
```

Activate it:

```cmd
.venv\Scripts\activate
```

Install the Python dependencies:

```cmd
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Before starting the server, inspect the backend's environment example and configuration. Set the required database and other environment variables according to those files. Do not commit real credentials or API keys.

Start the backend:

```cmd
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The backend should be available at:

- API base URL: http://127.0.0.1:8000
- Interactive API documentation: http://127.0.0.1:8000/docs

Keep this CMD window open while using the backend.

### Step C — Start the frontend

Open a second CMD window and enter the project root:

```cmd
cd /d "D:\AI Course\FactoryMind_AI"
```

Install frontend dependencies:

```cmd
npm install
```

Start the development server:

```cmd
npm run dev
```

Open the local application at:

http://localhost:3000

Keep both servers running during local development. The frontend's API proxy and backend environment configuration must match your local setup.

## 9. Build and Test

### Frontend type check

```cmd
npm run lint
```

### Frontend production build

```cmd
npm run build
```

### Backend tests

From the project root, activate the backend virtual environment if necessary, then run:

```cmd
python -m pytest backend\tests -q
```

These commands help verify the frontend code, production build, and backend behavior. Run them again after making changes.

## 10. Deployment

FactoryMind AI has separately hosted frontend and backend services.

- Frontend: https://factory-mind-ai-2frh.vercel.app/
- Backend: https://factory-mind-ai-seven.vercel.app

Deployment requires the appropriate build configuration, environment variables, database connectivity, and frontend-to-backend API settings.

For production deployment, use persistent database storage and configure secrets through the hosting provider's environment-variable settings. Never place database passwords or private API keys in this README.

## 11. Limitations

- Anomaly detection identifies unusual behavior; it does not independently diagnose a confirmed mechanical failure.
- Results depend on the quality, quantity, and suitability of the available sensor data.
- Business-impact values are estimates and depend on the configured inputs and assumptions.
- AI-generated explanations must be grounded in available evidence and reviewed by a human.
- AI-provider functionality may require valid environment configuration and provider credentials.
- Simulated demonstration data must not be interpreted as real factory telemetry.

## 12. Future Improvements

Potential future enhancements include:

- Additional sensor formats and ingestion options.
- More advanced machine-specific anomaly detection.
- Expanded maintenance-history analysis.
- More configurable business-impact models.
- Improved reporting and deployment monitoring.
- Authentication and multi-user workspaces.

## 13. Contributing

Contributions, bug reports, and suggestions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make and test your changes.
4. Submit a pull request describing the improvement.

## 14. License

A license has not yet been specified. Until a license is added to the repository, do not assume that the code is available for unrestricted reuse.

---

**FactoryMind AI — Detect anomalies. Prioritize maintenance. Protect production.**