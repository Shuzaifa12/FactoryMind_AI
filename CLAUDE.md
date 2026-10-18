# FACTORYMIND AI — MASTER IMPLEMENTATION PROMPT

## Your role

Act as my Principal AI Engineer, Senior Full-Stack Developer, Machine Learning Engineer, Data Engineer, UI/UX Designer, DevOps Engineer, and hackathon mentor.

Help me build **FactoryMind AI**, a working, polished, deployable predictive-maintenance platform, from an empty project to a competition-ready MVP.

I want you to implement the actual application, not merely provide suggestions, mockups, pseudocode, or disconnected code snippets.

Assume I am a beginner-to-intermediate developer. Explain important decisions in plain language, give exact terminal commands, identify file paths, and guide me through testing each stage.

## 1. Product vision

**Product:** FactoryMind AI
**Tagline:** Detect anomalies. Prioritize maintenance. Protect production.

Factories experience unexpected machine failures, costly downtime, production delays, and difficult maintenance decisions. Small and medium-sized manufacturers often cannot afford expensive predictive-maintenance platforms.

FactoryMind AI should help users:

1. Upload machine sensor and maintenance data.
2. Validate and understand the uploaded data.
3. Detect unusual sensor patterns using machine learning.
4. Rank unusual events by operational and estimated financial impact.
5. Investigate alerts through a multilingual AI agent.
6. Generate evidence-based maintenance reports.
7. Monitor machines and trends through a dynamic dashboard.

An anomaly is a potentially important unusual pattern, not proof of a machine failure. All maintenance recommendations must be reviewed by a human.

## 2. Finalized product decisions

Treat these as fixed requirements unless a genuine technical blocker requires a documented alternative.

- AI provider: configurable and provider-independent. The actual provider will be selected later.
- Languages: English and Urdu.
- Deployment: independently hosted frontend and backend.
- Judge testing: primarily through a prepared demo dataset, while retaining real file-upload functionality.
- Authentication: undecided. Build a simple single-workspace MVP with an architecture that can support authentication and multiple users later. Do not spend MVP time building complex authentication.
- The dashboard, charts, alerts, calculations, tables, reports, and chat context must use backend data rather than hardcoded demo values.
- Clearly distinguish simulated demo data from real uploaded data.

## 3. Technology stack

Use:

- Frontend: Next.js and TypeScript.
- UI: clean, responsive, accessible components and icons.
- Charts: Recharts.
- Backend: Python and FastAPI.
- Data processing: pandas and NumPy where appropriate.
- ML: scikit-learn Isolation Forest.
- Database: SQLAlchemy with SQLite for local development. Select a persistent production-compatible database based on hosting requirements.
- Validation: typed request/response schemas and clear upload validation errors.
- File parsing: appropriate CSV, Excel, and PDF parsing libraries.
- Testing: pytest for backend tests and suitable frontend tests.
- Configuration: environment variables and an example environment file without real secrets.

Use current stable, compatible library versions. Consult current official documentation through Context7 when available. If a Superpowers development workflow is available, use it; otherwise follow an explicit plan, implementation, review, and testing cycle.

Do not add unnecessary frameworks or services.

## 4. Architecture

Create a maintainable architecture with separate responsibilities:

Frontend:

- Dashboard and navigation.
- Machine overview and detail pages.
- File upload and column mapping.
- Alerts and alert investigation.
- Business-impact view.
- AI assistant.
- Maintenance report view and download.
- English/Urdu language selector.
- Dark/Light Theme
- Responsiveness

Backend:

- File ingestion and validation.
- Dataset and machine management.
- Anomaly detection.
- Alert generation and persistence.
- Business-impact calculations.
- Maintenance-history retrieval.
- AI provider abstraction and tool execution.
- Report generation.
- Health checks and API documentation.

Database:

- Datasets and upload metadata.
- Machines.
- Sensor readings or references to imported observations.
- Anomaly alerts and scores.
- Maintenance records.
- Production and cost assumptions.
- AI investigation records when appropriate.
- Generated report metadata.

Design a clean project structure and document all important architectural choices before implementation.

## 5. File upload and data understanding

Support these file types:

- CSV for sensor readings and structured records.
- Excel XLSX and XLS where supported by the chosen libraries.
- PDF for maintenance logs, manuals, and reports.

Do not treat all file formats as equivalent.

For CSV and Excel:

- Detect column names and likely data types.
- Let the user map columns when names differ.
- Recognize possible timestamp, machine ID, temperature, vibration, energy/current, and operating-status fields.
- Validate units, numeric values, timestamps, duplicate rows, missing data, and inconsistent records.
- Show a preview and validation report before processing.
- Explain missing required fields and allow correction where practical.
- Never silently fabricate missing readings.

For PDFs:

- Extract relevant text and tables where feasible.
- Use extracted maintenance history or operational notes as contextual evidence.
- Do not automatically treat arbitrary PDF text as sensor time-series data.
- Report extraction limitations clearly.

For combined uploads:

- Associate records only when a reliable machine ID, timestamp, or user-confirmed mapping exists.
- Ask for clarification when relationships are ambiguous.
- Never merge records merely because their filenames look similar.

Uploading a new dataset must trigger real backend processing. The resulting dashboard, alerts, graphs, statistics, machine rankings, and reports must reflect that dataset.

Persist uploaded-data metadata and processed results. Provide understandable errors, size limits, and safe file handling.

## 6. Machine learning

Implement Isolation Forest as the initial anomaly detector.

Requirements:

- Work with available, validated numerical sensor features.
- Handle missing values through a documented preprocessing strategy.
- Scale or transform features when justified.
- Support machine-aware analysis when sufficient data exists.
- Provide configurable contamination or sensitivity settings.
- Record the model configuration and processing metadata.
- Explain which sensor readings contributed to an alert, using appropriate feature-level comparisons or supporting evidence.
- Avoid claiming that Isolation Forest inherently produces calibrated failure probabilities.
- Distinguish model scores, anomaly labels, severity rules, and business-impact rankings.

When the dataset is too small or unsuitable, explain why and offer a transparent fallback, such as rule-based threshold checks. Label that fallback clearly.

Every alert should contain:

- Machine identifier.
- Event timestamp or time range when available.
- Anomaly score or detector output.
- Severity determined by explicit rules.
- Supporting sensor evidence.
- Data-quality warnings.
- Suggested inspection steps.
- A clear statement that the alert is not a confirmed failure.

## 7. Business-impact engine

Implement the business-impact calculations in ordinary Python functions, independently of the LLM.

Consider:

- Estimated downtime duration.
- Production loss per hour.
- Estimated maintenance cost.
- Estimated operational loss.
- Production priority.
- Machine criticality.
- A configurable cost estimate and priority score.

Document formulas and assumptions. Example:

Estimated downtime loss = estimated downtime hours × configured loss per hour.

Total estimated impact may include downtime loss and maintenance cost, but only where the inputs are available and the formula avoids double-counting.

Allow missing cost assumptions to remain unknown. Ask the user to configure them or label any defaults as illustrative assumptions.

Do not present estimated savings, avoided failures, ROI, or financial losses as measured facts.

## 8. Multilingual AI agent

Build a provider-independent AI service interface. Do not hardwire the application to one provider.

Provide:

- A configurable provider setting.
- Provider-specific adapters that can be implemented independently.
- A common interface for messages, structured tool calls, responses, and errors.
- Configuration through environment variables.
- A clear error if the provider is not configured.
- A graceful non-LLM fallback for core dashboard and ML functions.
- Mocked-provider tests that do not require paid API access.

The final provider can be chosen later. Do not block the rest of the project while waiting for that choice.

The agent must support English and Urdu. Use the selected language for explanations and reports, preserve sensor names and numerical values, and support right-to-left presentation where appropriate.

Expose controlled backend tools such as:

- get_alert_details
- get_machine_history
- get_sensor_summary
- calculate_business_impact
- get_dataset_quality_report
- search_maintenance_records
- generate_maintenance_report

The agent must call real backend functions and use their returned evidence. It must not invent sensor readings, maintenance events, costs, machine histories, or calculations.

If evidence is missing, state that clearly. If the provider fails, keep the rest of the application usable.

## 9. Dashboard and UX

Build a professional industrial analytics dashboard suitable for a hackathon judging demonstration.

Include:

- Overview cards for machine count, active alerts, anomalies detected, and estimated impact where calculable.
- Machine status and priority table.
- Time-series sensor charts.
- Anomaly markers on relevant charts.
- Severity and machine filters.
- Dataset selector or clearly indicated active dataset.
- Alert details and evidence.
- Business-impact breakdown.
- AI investigation panel.
- Maintenance-report generation.
- Dataset quality feedback.
- Loading, empty, error, and success states.
- Responsive desktop and mobile layouts.
- English/Urdu switching.

Use consistent visual hierarchy, clear labels, legible charts, and accessible controls. Do not display fake live data or static numbers disguised as real results.

## 10. Judge-ready demo mode

Create a repeatable demo workflow using clearly labeled simulated data.

Include a prepared dataset with:

- Multiple machines.
- Timestamps and realistic operating patterns.
- Normal periods and deliberately introduced unusual patterns.
- Multiple sensor features when appropriate.
- Machine criticality.
- Maintenance records.
- Production context.
- Documented illustrative downtime-cost assumptions.

Create a backend-powered “Load Demo Data” action that loads or resets the prepared dataset safely and predictably.

The demo must demonstrate the complete flow:

1. Load demo data.
2. Inspect data quality.
3. Run anomaly detection.
4. Review the generated alerts.
5. Open an alert and inspect its sensor evidence.
6. View its business-impact estimate.
7. Ask the AI agent to investigate it.
8. Generate and download a maintenance report.
9. Switch between English and Urdu.
10. Upload a different dataset and verify that the results update.

Clearly mark simulated data in the UI, reports, and demo documentation.

## 11. Security and reliability

- Validate file extensions, content, size, and parsing errors.
- Never execute uploaded content.
- Keep credentials and API keys out of source code.
- Configure CORS narrowly for the deployed frontend.
- Do not expose internal stack traces or secrets to users.
- Add API timeouts and useful error handling.
- Avoid storing unnecessary sensitive data.
- Plan for authorization before enabling multi-user deployment.
- Use persistent storage appropriate to the selected host.
- Add health checks and structured logging.
- Ensure the AI agent cannot perform arbitrary code execution or unrestricted database operations.

## 12. Required development workflow

Work in small, verifiable milestones.

### Phase 0 — Inspect and plan

Inspect the existing repository before modifying anything. If it is empty, confirm that and propose the initial structure.

Provide:

- Requirements and acceptance criteria.
- Assumptions and unresolved questions.
- Architecture and data flow.
- Database schema.
- API contract.
- Proposed directory structure.
- Dependency plan.
- Deployment strategy.
- Main technical risks.

Do not ask me to decide the AI provider now. Make the provider configurable. Do not block development over authentication; use the single-workspace approach.

### Phase 1 — Foundation

Set up the project, dependencies, environment configuration, backend health endpoint, frontend shell, database, and basic tests.

### Phase 2 — Complete data-to-alert workflow

Implement CSV/Excel upload, preview, validation, processing, persistence, Isolation Forest, alert creation, and dynamic results. Build this end-to-end before adding complex AI features.

### Phase 3 — Business impact

Implement explicit Python calculations, configurable assumptions, and explainable prioritization.

### Phase 4 — Demo dataset

Create deterministic demo data and a one-click load/reset workflow.

### Phase 5 — Dashboard

Connect all charts, cards, tables, filters, and detail views to backend endpoints.

### Phase 6 — Multilingual agent

Implement the provider abstraction, controlled tools, English/Urdu behavior, graceful failure handling, and tests using a mocked provider.

### Phase 7 — PDF and maintenance reports

Implement PDF text/table extraction, maintenance-context retrieval, and downloadable evidence-based reports.

### Phase 8 — Quality and deployment

Run tests, linting, type checks, build checks, and deployment verification. Address persistence, environment variables, CORS, file limits, and production errors.

### Phase 9 — Hackathon preparation

Prepare the demo walkthrough, README, architecture diagram, dataset documentation, limitations, deployment instructions, short pitch, and judge Q&A.

## 13. How you must work with me

- Never dump a huge unfinished codebase without explaining how to run it.
- Tell me exactly which files you create or modify.
- Provide complete code for each file when I need to create it manually.
- If you can access and edit the repository, implement changes directly and summarize them.
- Run the relevant tests and show actual results. Never claim tests passed if you did not run them.
- After each milestone, provide commands to start the app and a checklist for verifying it.
- Fix errors before proceeding to dependent features.
- Do not leave fake API responses, TODO-only implementations, placeholder buttons, or static charts in features claimed as complete.
- If something cannot be completed, state the limitation and offer the most practical fallback.
- Prefer a small, working end-to-end system over a large collection of incomplete features.
- Keep a running list of completed work, remaining work, assumptions, and known issues.

## 14. Definition of done

The MVP is ready for judging only when:

- The frontend and backend can be started and deployed independently.
- A judge can load demo data without manually preparing files.
- Uploading a supported sensor dataset produces validated, backend-generated results.
- Anomaly detection produces traceable alerts.
- Business impact is calculated from explicit inputs and formulas.
- Charts and machine rankings update when datasets change.
- The AI agent uses real backend tools when a provider is configured.
- The app remains usable when no AI provider is configured.
- English and Urdu are both supported.
- Maintenance reports contain actual evidence and clearly labeled assumptions.
- Automated tests and build checks have been run and their results reported.
- Deployment, setup, limitations, and the judging demo are documented.

## Your first response

Do not start by generating every file at once.

First inspect my current project or ask me to provide the repository structure if you cannot access it. Then produce the Phase 0 deliverables: requirements, assumptions, architecture, database schema, API contract, folder structure, milestone plan, deployment approach, risks, and acceptance criteria.

After that, begin Phase 1 and continue milestone by milestone until the application is working.

Your objective is a credible, reliable, polished hackathon MVP—not exaggerated claims or a visually impressive but nonfunctional prototype.
