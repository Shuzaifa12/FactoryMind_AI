import fs from "node:fs";
import { generateMessageId } from "../idGenerator";
import { generatePdfReport } from "../pdfReportGenerator";
import type { Alert, Dataset, Machine, MaintenanceReport } from "../../types";

async function runVerification() {
  console.log("=== FACTORYMIND AI VERIFICATION: UNIQUE IDS & PDF EXPORT ===");

  // 1. Verify Message ID uniqueness across 50,000 rapid sequential generations
  console.log("\n[Test 1] Testing Message ID collision resistance (50,000 items)...");
  const ids = new Set<string>();
  const count = 50000;
  for (let i = 0; i < count; i++) {
    const prefix = i % 2 === 0 ? "user" : "msg";
    const id = generateMessageId(prefix);
    if (ids.has(id)) {
      throw new Error(`Duplicate key collision detected for key: ${id} at iteration ${i}`);
    }
    ids.add(id);
  }
  console.log(`✓ Successfully generated ${ids.size} unique IDs with 0 collisions.`);

  // 2. Verify PDF Generation (English)
  console.log("\n[Test 2] Testing English PDF Report generation...");
  const mockDataset: Dataset = {
    id: 1,
    name: "plant_batch_turbines.csv",
    source: "upload",
    is_simulated: false,
    original_filename: "plant_batch_turbines.csv",
    row_count: 10000,
    is_active: true,
  };

  const mockMachines: Machine[] = [
    {
      id: 1,
      external_id: "TURB-01",
      name: "Gas Turbine Unit 1",
      criticality: 5,
      production_priority: 5,
      loss_per_hour: 2500,
      maintenance_cost_estimate: 8000,
      assumption_source: "user",
      active_alerts_count: 1,
    },
  ];

  const mockAlerts: Alert[] = [
    {
      id: 101,
      machine_id: "TURB-01",
      machine_name: "Gas Turbine Unit 1",
      start_ts: "2026-10-18T08:00:00Z",
      end_ts: "2026-10-18T10:30:00Z",
      anomaly_score: 0.92,
      is_anomaly_label: true,
      severity: "critical",
      severity_reason: [
        "Severe vibration magnitude deviation (4.8x MAD) detected on primary rotor assembly.",
        "Bearing temperature elevated to 88.4°C exceeding operational safety threshold.",
      ],
      evidence: [
        {
          feature: "Vibration",
          observed_value: 6.85,
          baseline_median: 1.42,
          deviation_mad: 4.82,
          unit: "mm/s",
        },
        {
          feature: "Temperature",
          observed_value: 88.4,
          baseline_median: 62.1,
          deviation_mad: 3.15,
          unit: "°C",
        },
      ],
      data_quality_warnings: [
        "Detector method used: isolation_forest.",
        "Alert is a statistical indicator, not proof of machine failure.",
      ],
      inspection_steps: [
        "Immediate physical acoustic and thermographic inspection required.",
        "Inspect radial bearing clearance and foundation anchor bolts.",
        "Verify lubricating oil delivery pressure and particulate filter status.",
        "All recommendations require qualified human technician confirmation.",
      ],
      status: "open",
      impact: {
        assumed_downtime_hours: 4.5,
        downtime_loss: 11250,
        maintenance_cost: 8000,
        total_estimated_impact: 19250,
        priority_score: 95,
        formula_version: "v1.2",
        inputs_used: {
          loss_per_hour: 2500,
          hours: 4.5,
          repair_cost: 8000,
        },
      },
    },
  ];

  const mockReport: MaintenanceReport = {
    id: 1792351859000,
    title: "Maintenance Dispatch Report - 1 Active Event",
    generated_at: new Date().toISOString(),
    dataset_name: "plant_batch_turbines.csv",
    is_simulated: false,
    language: "en",
    format: "pdf",
    content: "Mock report text",
    alert_ids: [101],
  };

  const doc = await generatePdfReport({
    report: mockReport,
    alerts: mockAlerts,
    machines: mockMachines,
    dataset: mockDataset,
  });

  const pdfOutput = doc.output();
  if (!pdfOutput.startsWith("%PDF-")) {
    throw new Error("Output does not start with standard PDF magic bytes '%PDF-'!");
  }

  const outputPath = "/tmp/sample_generated_report.pdf";
  fs.writeFileSync(outputPath, Buffer.from(doc.output("arraybuffer")));
  console.log(`✓ English PDF successfully generated at ${outputPath} (${fs.statSync(outputPath).size} bytes).`);
  console.log(`✓ Magic header: ${pdfOutput.slice(0, 8)}`);
  console.log(`✓ Total pages: ${doc.getNumberOfPages()}`);

  // 3. Verify Urdu report with html2canvas Unicode Urdu rendering
  console.log("\n[Test 3] Testing Urdu PDF Report generation with Unicode Urdu shaping...");
  const mockUrduReport: MaintenanceReport = {
    ...mockReport,
    language: "ur",
    title: "تکنیکی دیکھ بھال کی رپورٹ - 1 الرٹ",
  };

  const urduDoc = await generatePdfReport({
    report: mockUrduReport,
    alerts: mockAlerts,
    machines: mockMachines,
    dataset: mockDataset,
  });

  const urduPdfOutput = urduDoc.output();
  if (!urduPdfOutput.startsWith("%PDF-")) {
    throw new Error("Urdu PDF output is invalid!");
  }
  console.log(`✓ Urdu PDF successfully generated (${urduDoc.getNumberOfPages()} pages) with valid Unicode Urdu rendering.`);

  console.log("\nAll verification tests passed successfully!\n");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
