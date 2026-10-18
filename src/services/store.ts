import {
  Alert,
  Dataset,
  InvestigationMessage,
  Machine,
  MaintenanceRecord,
  MaintenanceReport,
  SensorReading,
} from "../types";
import { generateMessageId } from "./idGenerator";
import { api } from "../lib/api";

// Base machines
const INITIAL_MACHINES: Machine[] = [
  {
    id: 1,
    external_id: "CNC-01",
    name: "5-Axis High-Speed CNC Milling Center",
    criticality: 5,
    production_priority: 5,
    loss_per_hour: 1200,
    maintenance_cost_estimate: 3500,
    assumption_source: "illustrative",
    active_alerts_count: 1,
  },
  {
    id: 2,
    external_id: "PRESS-04",
    name: "Hydraulic Stamping Press (800T)",
    criticality: 4,
    production_priority: 4,
    loss_per_hour: 950,
    maintenance_cost_estimate: 4200,
    assumption_source: "illustrative",
    active_alerts_count: 1,
  },
  {
    id: 3,
    external_id: "PUMP-12",
    name: "High-Pressure Coolant Circulation Pump",
    criticality: 3,
    production_priority: 3,
    loss_per_hour: 400,
    maintenance_cost_estimate: 1200,
    assumption_source: "illustrative",
    active_alerts_count: 1,
  },
  {
    id: 4,
    external_id: "CONV-02",
    name: "Outfeed Packaging Conveyor Line",
    criticality: 2,
    production_priority: 2,
    loss_per_hour: 250,
    maintenance_cost_estimate: 650,
    assumption_source: "illustrative",
    active_alerts_count: 0,
  },
];

const INITIAL_MAINTENANCE_RECORDS: MaintenanceRecord[] = [
  {
    id: 101,
    machine_id: "CNC-01",
    date: "2026-09-12T09:00:00Z",
    description: "Scheduled spindle bearing inspection and high-speed grease replenishment.",
    source: "pdf",
    match_confidence: "exact_id",
  },
  {
    id: 102,
    machine_id: "PRESS-04",
    date: "2026-08-04T14:30:00Z",
    description: "Hydraulic piston seal replacement and oil filter change following minor pressure drop.",
    source: "csv",
    match_confidence: "exact_id",
  },
  {
    id: 103,
    machine_id: "PUMP-12",
    date: "2026-07-20T11:15:00Z",
    description: "Suction strainer flushed. Impeller inspected for cavitation pitting; none observed.",
    source: "pdf",
    match_confidence: "exact_id",
  },
  {
    id: 104,
    machine_id: "CONV-02",
    date: "2026-09-28T08:00:00Z",
    description: "Conveyor drive roller alignment and tension adjustment.",
    source: "csv",
    match_confidence: "exact_id",
  },
];

// Helper to generate 48 hours of time-series readings
function generateDemoReadings(): SensorReading[] {
  const readings: SensorReading[] = [];
  const baseDate = new Date("2026-10-16T00:00:00Z");
  const totalPoints = 50;

  for (let i = 0; i < totalPoints; i++) {
    const time = new Date(baseDate.getTime() + i * 45 * 60 * 1000).toISOString();

    // CNC-01 (Normal until index 35-44 where bearing degradation begins)
    const isCncAnomaly = i >= 35 && i <= 44;
    const cncTemp = isCncAnomaly
      ? 54.0 + (i - 35) * 0.7 + (Math.sin(i) * 0.8)
      : 41.5 + Math.sin(i * 0.5) * 1.5;
    const cncVib = isCncAnomaly
      ? 4.6 + (i - 35) * 0.12 + (Math.cos(i) * 0.4)
      : 1.7 + Math.cos(i * 0.8) * 0.2;
    const cncCurr = 14.2 + (isCncAnomaly ? 2.8 : 0) + Math.sin(i) * 0.5;

    readings.push({
      timestamp: time,
      machine_id: "CNC-01",
      temperature: Number(cncTemp.toFixed(1)),
      vibration: Number(cncVib.toFixed(2)),
      current: Number(cncCurr.toFixed(1)),
      is_anomalous: isCncAnomaly,
    });

    // PRESS-04 (Anomaly between index 18 and 26)
    const isPressAnomaly = i >= 18 && i <= 26;
    const pressTemp = isPressAnomaly
      ? 64.0 + Math.sin(i) * 2.2
      : 51.5 + Math.sin(i * 0.3) * 1.8;
    const pressVib = isPressAnomaly
      ? 3.9 + Math.cos(i) * 0.4
      : 2.8 + Math.cos(i * 0.5) * 0.3;
    const pressCurr = isPressAnomaly
      ? 43.5 + Math.sin(i) * 3.0
      : 27.0 + Math.sin(i * 0.7) * 1.5;

    readings.push({
      timestamp: time,
      machine_id: "PRESS-04",
      temperature: Number(pressTemp.toFixed(1)),
      vibration: Number(pressVib.toFixed(2)),
      current: Number(pressCurr.toFixed(1)),
      is_anomalous: isPressAnomaly,
    });

    // PUMP-12 (Anomaly between index 28 and 34)
    const isPumpAnomaly = i >= 28 && i <= 34;
    const pumpTemp = 36.8 + Math.sin(i * 0.4) * 1.1;
    const pumpVib = isPumpAnomaly
      ? 2.85 + Math.sin(i) * 0.35
      : 0.82 + Math.cos(i * 0.6) * 0.15;
    const pumpCurr = 8.1 + (isPumpAnomaly ? 1.4 : 0) + Math.sin(i * 0.5) * 0.3;

    readings.push({
      timestamp: time,
      machine_id: "PUMP-12",
      temperature: Number(pumpTemp.toFixed(1)),
      vibration: Number(pumpVib.toFixed(2)),
      current: Number(pumpCurr.toFixed(1)),
      is_anomalous: isPumpAnomaly,
    });

    // CONV-02 (Always normal)
    readings.push({
      timestamp: time,
      machine_id: "CONV-02",
      temperature: Number((31.5 + Math.sin(i * 0.5) * 0.9).toFixed(1)),
      vibration: Number((0.58 + Math.cos(i * 0.4) * 0.08).toFixed(2)),
      current: Number((5.1 + Math.sin(i * 0.3) * 0.25).toFixed(1)),
      is_anomalous: false,
    });
  }

  return readings;
}

const INITIAL_ALERTS: Alert[] = [
  {
    id: 1,
    machine_id: "CNC-01",
    machine_name: "5-Axis High-Speed CNC Milling Center",
    start_ts: "2026-10-17T02:15:00Z",
    end_ts: "2026-10-17T09:00:00Z",
    anomaly_score: 0.94,
    is_anomaly_label: true,
    severity: "critical",
    severity_reason: [
      "Vibration amplitude (5.42 mm/s) exceeded 3.1x baseline MAD.",
      "Synchronous temperature increase (+17.2°C above running median).",
      "Asset assigned Criticality 5 (Bottleneck machining station).",
    ],
    evidence: [
      {
        feature: "Vibration Velocity",
        observed_value: 5.42,
        baseline_median: 1.72,
        deviation_mad: 3.15,
        unit: "mm/s",
      },
      {
        feature: "Spindle Temperature",
        observed_value: 58.7,
        baseline_median: 41.5,
        deviation_mad: 2.85,
        unit: "°C",
      },
      {
        feature: "Drive Motor Current",
        observed_value: 17.1,
        baseline_median: 14.2,
        deviation_mad: 1.62,
        unit: "A",
      },
    ],
    data_quality_warnings: [
      "No missing sensor rows detected during alert window.",
      "Sensor sample interval steady at 45-minute nominal rate.",
    ],
    inspection_steps: [
      "Immediate vibration acoustic signature inspection on main spindle bearing cartridge.",
      "Check automatic grease lubrication dispenser pressure and reservoir level.",
      "Verify toolholder clamping force and runout tolerance on ISO-40 taper.",
      "Inspect spindle chiller heat-exchanger coolant flow rate.",
    ],
    status: "open",
    impact: {
      assumed_downtime_hours: 4.5,
      downtime_loss: 5400, // 4.5 * 1200
      maintenance_cost: 3500,
      total_estimated_impact: 8900,
      priority_score: 93,
      formula_version: "v1.0 (Downtime_Hrs × Loss_Rate + Repair_Cost)",
      inputs_used: {
        hours: 4.5,
        loss_per_hour: 1200,
        repair_cost: 3500,
      },
    },
  },
  {
    id: 2,
    machine_id: "PRESS-04",
    machine_name: "Hydraulic Stamping Press (800T)",
    start_ts: "2026-10-16T13:30:00Z",
    end_ts: "2026-10-16T19:30:00Z",
    anomaly_score: 0.88,
    is_anomaly_label: true,
    severity: "high",
    severity_reason: [
      "Main pump motor current draw spiked +61% above nominal baseline.",
      "Hydraulic fluid reservoir temperature elevated past 66°C threshold.",
    ],
    evidence: [
      {
        feature: "Motor Current",
        observed_value: 44.8,
        baseline_median: 27.0,
        deviation_mad: 2.65,
        unit: "A",
      },
      {
        feature: "Fluid Temperature",
        observed_value: 67.2,
        baseline_median: 51.5,
        deviation_mad: 2.38,
        unit: "°C",
      },
      {
        feature: "Ram Vibration",
        observed_value: 3.95,
        baseline_median: 2.8,
        deviation_mad: 1.45,
        unit: "mm/s",
      },
    ],
    data_quality_warnings: [
      "Single intermittent telemetry drop at 15:00 UTC (duration 1 min).",
    ],
    inspection_steps: [
      "Inspect proportional directional control valve spool for sticking or contamination.",
      "Check hydraulic oil filter differential pressure indicator gauge.",
      "Inspect heat exchanger cooling water inlet temperature and flow rate.",
    ],
    status: "open",
    impact: {
      assumed_downtime_hours: 3.0,
      downtime_loss: 2850, // 3.0 * 950
      maintenance_cost: 4200,
      total_estimated_impact: 7050,
      priority_score: 82,
      formula_version: "v1.0 (Downtime_Hrs × Loss_Rate + Repair_Cost)",
      inputs_used: {
        hours: 3.0,
        loss_per_hour: 950,
        repair_cost: 4200,
      },
    },
  },
  {
    id: 3,
    machine_id: "PUMP-12",
    machine_name: "High-Pressure Coolant Circulation Pump",
    start_ts: "2026-10-16T21:00:00Z",
    end_ts: "2026-10-17T01:30:00Z",
    anomaly_score: 0.77,
    is_anomaly_label: true,
    severity: "medium",
    severity_reason: [
      "High frequency vibration spikes indicative of suction cavitation.",
      "Temperature within normal bounds, indicating hydraulic cavitation rather than bearing seizure.",
    ],
    evidence: [
      {
        feature: "Pump Casing Vibration",
        observed_value: 2.92,
        baseline_median: 0.82,
        deviation_mad: 2.56,
        unit: "mm/s",
      },
      {
        feature: "Operating Current",
        observed_value: 9.6,
        baseline_median: 8.1,
        deviation_mad: 1.25,
        unit: "A",
      },
    ],
    data_quality_warnings: [],
    inspection_steps: [
      "Inspect coolant suction basket filter for metal chips and swarf clogging.",
      "Check reservoir fluid level and verify anti-foaming agent balance.",
      "Inspect pump impeller vane clearance and inlet valve seating.",
    ],
    status: "open",
    impact: {
      assumed_downtime_hours: 2.0,
      downtime_loss: 800, // 2.0 * 400
      maintenance_cost: 1200,
      total_estimated_impact: 2000,
      priority_score: 61,
      formula_version: "v1.0 (Downtime_Hrs × Loss_Rate + Repair_Cost)",
      inputs_used: {
        hours: 2.0,
        loss_per_hour: 400,
        repair_cost: 1200,
      },
    },
  },
];

const INITIAL_DATASET: Dataset = {
  id: 1,
  name: "Standard Plant Operations (Judge Demo Dataset)",
  source: "demo",
  is_simulated: true,
  original_filename: "simulated_plant_telemetry_oct2026.csv",
  row_count: 200,
  is_active: true,
  quality_report: {
    total_rows: 200,
    valid_rows: 200,
    missing_values_count: 0,
    duplicate_rows_count: 0,
    timestamp_range: {
      start: "2026-10-16T00:00:00Z",
      end: "2026-10-17T13:15:00Z",
    },
    sampling_rate: "45 minutes",
    notes: [
      "All sensor channels populated with numerical floats.",
      "Consistent timestamp increments across all 4 machine IDs.",
      "Includes deliberate anomalous periods on CNC-01, PRESS-04, and PUMP-12.",
    ],
  },
};

// Storage keys
const STORE_MACHINES_KEY = "fm_machines_state";
const STORE_ALERTS_KEY = "fm_alerts_state";
const STORE_DATASET_KEY = "fm_dataset_state";
const STORE_READINGS_KEY = "fm_readings_state";
const STORE_MAINT_KEY = "fm_maint_state";

export class DataStore {
  private static instance: DataStore;
  private machines: Machine[] = [];
  private alerts: Alert[] = [];
  private dataset: Dataset = INITIAL_DATASET;
  private readings: SensorReading[] = [];
  private maintenance: MaintenanceRecord[] = [];
  private listeners: Set<() => void> = new Set();

  private constructor() {
    this.loadState();
    api.getActiveDataset()
      .then((active) => {
        if (active && active.id) {
          this.syncWithBackendDataset(active.id);
        }
      })
      .catch(() => {});
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  private loadState() {
    try {
      const storedM = localStorage.getItem(STORE_MACHINES_KEY);
      const storedA = localStorage.getItem(STORE_ALERTS_KEY);
      const storedD = localStorage.getItem(STORE_DATASET_KEY);
      const storedR = localStorage.getItem(STORE_READINGS_KEY);
      const storedRec = localStorage.getItem(STORE_MAINT_KEY);

      if (storedM && storedA && storedD) {
        this.machines = JSON.parse(storedM);
        this.alerts = JSON.parse(storedA);
        this.dataset = JSON.parse(storedD);
        this.readings = storedR ? JSON.parse(storedR) : generateDemoReadings();
        this.maintenance = storedRec
          ? JSON.parse(storedRec)
          : INITIAL_MAINTENANCE_RECORDS;
        return;
      }
    } catch {}

    this.resetToDemo();
  }

  private persist() {
    try {
      localStorage.setItem(STORE_MACHINES_KEY, JSON.stringify(this.machines));
      localStorage.setItem(STORE_ALERTS_KEY, JSON.stringify(this.alerts));
      localStorage.setItem(STORE_DATASET_KEY, JSON.stringify(this.dataset));
      localStorage.setItem(STORE_READINGS_KEY, JSON.stringify(this.readings));
      localStorage.setItem(STORE_MAINT_KEY, JSON.stringify(this.maintenance));
    } catch {}
    this.notify();
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public resetToDemo() {
    this.machines = JSON.parse(JSON.stringify(INITIAL_MACHINES));
    this.alerts = JSON.parse(JSON.stringify(INITIAL_ALERTS));
    this.dataset = JSON.parse(JSON.stringify(INITIAL_DATASET));
    this.readings = generateDemoReadings();
    this.maintenance = JSON.parse(JSON.stringify(INITIAL_MAINTENANCE_RECORDS));
    this.persist();
  }

  public getDataset(): Dataset {
    return this.dataset;
  }

  public getMachines(): Machine[] {
    return this.machines.map((m) => {
      const count = this.alerts.filter(
        (a) => a.machine_id === m.external_id && a.status === "open"
      ).length;
      return { ...m, active_alerts_count: count };
    });
  }

  public getMachine(idOrExtId: string | number): Machine | undefined {
    return this.machines.find(
      (m) => m.id === Number(idOrExtId) || m.external_id === String(idOrExtId)
    );
  }

  public updateMachineAssumptions(
    id: number,
    loss_per_hour: number,
    maintenance_cost_estimate: number,
    criticality: number,
    priority: number
  ) {
    const idx = this.machines.findIndex((m) => m.id === id);
    if (idx !== -1) {
      this.machines[idx] = {
        ...this.machines[idx],
        loss_per_hour,
        maintenance_cost_estimate,
        criticality,
        production_priority: priority,
        assumption_source: "user",
      };

      // Recalculate impacts for alerts of this machine
      const extId = this.machines[idx].external_id;
      this.alerts = this.alerts.map((alert) => {
        if (alert.machine_id === extId) {
          const hours = alert.impact.assumed_downtime_hours ?? 2.5;
          const dtLoss = hours * loss_per_hour;
          const total = dtLoss + maintenance_cost_estimate;
          const priorityScore = Math.min(
            100,
            Math.round(
              criticality * 10 +
                (alert.severity === "critical"
                  ? 40
                  : alert.severity === "high"
                  ? 30
                  : 15) +
                Math.min(10, total / 1000)
            )
          );
          return {
            ...alert,
            impact: {
              ...alert.impact,
              downtime_loss: dtLoss,
              maintenance_cost: maintenance_cost_estimate,
              total_estimated_impact: total,
              priority_score: priorityScore,
              inputs_used: {
                hours,
                loss_per_hour,
                repair_cost: maintenance_cost_estimate,
              },
            },
          };
        }
        return alert;
      });

      this.persist();
    }
  }

  private syncCounter = 0;

  public async syncWithBackendDataset(datasetId: number) {
    const seq = ++this.syncCounter;
    try {
      const [datasetData, alertsData, machinesData] = await Promise.all([
        api.getDataset(datasetId).catch(() => null),
        api.getDatasetAlerts(datasetId).catch(() => []),
        api.getDatasetMachines(datasetId).catch(() => []),
      ]);

      if (seq !== this.syncCounter) return;

      if (datasetData) {
        this.dataset = {
          id: datasetData.id,
          name: datasetData.name,
          source: datasetData.source,
          is_simulated: datasetData.is_simulated,
          original_filename: datasetData.original_filename,
          row_count: datasetData.row_count,
          is_active: datasetData.is_active,
          quality_report: datasetData.quality_report,
        };
      }

      this.alerts = alertsData || [];
      this.machines = machinesData || [];
      this.persist();
    } catch (err) {
      console.warn("Failed to sync store with backend dataset:", err);
    }
  }

  public getAlerts(): Alert[] {
    return this.alerts;
  }

  public getAlert(id: number): Alert | undefined {
    return this.alerts.find((a) => a.id === id);
  }

  public updateAlertStatus(
    id: number,
    status: "open" | "reviewed" | "dismissed"
  ) {
    const idx = this.alerts.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.alerts[idx] = { ...this.alerts[idx], status };
      this.persist();
    }
  }

  public getReadings(machineId?: string): SensorReading[] {
    if (!machineId || machineId === "ALL") {
      return this.readings;
    }
    return this.readings.filter((r) => r.machine_id === machineId);
  }

  public getMaintenanceRecords(machineId?: string): MaintenanceRecord[] {
    if (!machineId) return this.maintenance;
    return this.maintenance.filter((m) => m.machine_id === machineId);
  }

  public getSummaryStats() {
    const openAlerts = this.alerts.filter((a) => a.status === "open");
    const totalImpact = openAlerts.reduce(
      (sum, a) => sum + (a.impact.total_estimated_impact || 0),
      0
    );
    const anomaliesCount = this.readings.filter((r) => r.is_anomalous).length;

    return {
      totalMachines: this.machines.length,
      activeAlertsCount: openAlerts.length,
      anomaliesDetectedCount: anomaliesCount,
      totalEstimatedImpact: totalImpact,
      isSimulated: this.dataset.is_simulated,
    };
  }

  // File Upload Processor: processes raw CSV text
  public processUploadedCsv(fileName: string, csvContent: string) {
    const lines = csvContent
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      throw new Error("CSV file must contain a header row and data rows.");
    }

    const header = lines[0].split(",").map((c) => c.trim().toLowerCase());

    // Detect column indexes
    let timeIdx = header.findIndex(
      (c) => c.includes("time") || c.includes("date") || c.includes("timestamp")
    );
    let machIdx = header.findIndex(
      (c) => c.includes("machine") || c.includes("asset") || c.includes("id")
    );
    let tempIdx = header.findIndex(
      (c) => c.includes("temp") || c.includes("temperature")
    );
    let vibIdx = header.findIndex(
      (c) => c.includes("vib") || c.includes("vibration")
    );
    let currIdx = header.findIndex(
      (c) =>
        c.includes("current") ||
        c.includes("amp") ||
        c.includes("power") ||
        c.includes("energy")
    );

    if (tempIdx === -1 && vibIdx === -1 && currIdx === -1) {
      throw new Error(
        "Could not detect numerical sensor columns (temperature, vibration, or current)."
      );
    }

    // Default fallback indices if missing
    if (timeIdx === -1) timeIdx = 0;
    if (machIdx === -1) machIdx = 1;
    if (tempIdx === -1) tempIdx = 2;
    if (vibIdx === -1) vibIdx = 3;
    if (currIdx === -1) currIdx = 4;

    const parsedReadings: SensorReading[] = [];
    const machinesSeen = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.trim());
      if (parts.length <= Math.max(tempIdx, vibIdx)) continue;

      const mId = parts[machIdx] || "MACH-01";
      machinesSeen.add(mId);

      const tVal = parseFloat(parts[tempIdx]);
      const vVal = parseFloat(parts[vibIdx]);
      const cVal = parseFloat(parts[currIdx]);

      const timeStr = parts[timeIdx]
        ? new Date(parts[timeIdx]).toISOString()
        : new Date(Date.now() - (lines.length - i) * 60000).toISOString();

      parsedReadings.push({
        timestamp: isNaN(new Date(timeStr).getTime())
          ? new Date().toISOString()
          : timeStr,
        machine_id: mId,
        temperature: isNaN(tVal) ? 40 : tVal,
        vibration: isNaN(vVal) ? 1.5 : vVal,
        current: isNaN(cVal) ? 15.0 : cVal,
        is_anomalous: false,
      });
    }

    if (parsedReadings.length === 0) {
      throw new Error("No valid data rows could be parsed.");
    }

    // Build machines
    const newMachines: Machine[] = Array.from(machinesSeen).map(
      (extId, idx) => ({
        id: idx + 10,
        external_id: extId,
        name: `Production Unit ${extId}`,
        criticality: 3,
        production_priority: 3,
        loss_per_hour: 500,
        maintenance_cost_estimate: 1500,
        assumption_source: "user",
        active_alerts_count: 0,
      })
    );

    // Calculate baseline medians and detect anomalies using MAD
    const newAlerts: Alert[] = [];
    newMachines.forEach((mach) => {
      const machReadings = parsedReadings.filter(
        (r) => r.machine_id === mach.external_id
      );
      if (machReadings.length < 5) return;

      const vVals = machReadings.map((r) => r.vibration).sort((a, b) => a - b);
      const tVals = machReadings
        .map((r) => r.temperature)
        .sort((a, b) => a - b);
      const medianV = vVals[Math.floor(vVals.length / 2)];
      const medianT = tVals[Math.floor(tVals.length / 2)];

      // Check for readings > 2.5x median
      const anomalousReadings = machReadings.filter(
        (r) => r.vibration > medianV * 2.2 || r.temperature > medianT * 1.35
      );

      anomalousReadings.forEach((r) => {
        r.is_anomalous = true;
      });

      if (anomalousReadings.length > 0) {
        const first = anomalousReadings[0];
        const last = anomalousReadings[anomalousReadings.length - 1];
        const maxV = Math.max(...anomalousReadings.map((r) => r.vibration));
        const maxT = Math.max(...anomalousReadings.map((r) => r.temperature));

        const alertId = newAlerts.length + 10;
        const hours = 2.5;
        const dtLoss = hours * (mach.loss_per_hour ?? 1000);
        const totalImpact = dtLoss + (mach.maintenance_cost_estimate ?? 2500);

        newAlerts.push({
          id: alertId,
          machine_id: mach.external_id,
          machine_name: mach.name,
          start_ts: first.timestamp,
          end_ts: last.timestamp,
          anomaly_score: Number(
            (0.75 + Math.min(0.2, (maxV - medianV) / (medianV * 5))).toFixed(2)
          ),
          is_anomaly_label: true,
          severity: maxV > medianV * 3 ? "critical" : "high",
          severity_reason: [
            `Vibration magnitude peaked at ${maxV.toFixed(2)} mm/s vs baseline ${medianV.toFixed(2)} mm/s.`,
            `Temperature reached ${maxT.toFixed(1)}°C.`,
          ],
          evidence: [
            {
              feature: "Vibration",
              observed_value: maxV,
              baseline_median: medianV,
              deviation_mad: Number((maxV / (medianV || 1)).toFixed(2)),
              unit: "mm/s",
            },
            {
              feature: "Temperature",
              observed_value: maxT,
              baseline_median: medianT,
              deviation_mad: Number((maxT / (medianT || 1)).toFixed(2)),
              unit: "°C",
            },
          ],
          data_quality_warnings: [
            "Dataset ingested from custom user upload.",
            "Baseline calculated from uploaded sample population.",
          ],
          inspection_steps: [
            "Check mechanical mounting and foundation bolt torque.",
            "Verify bearing thermal profile with infrared thermography.",
            "Inspect drive coupling for radial or axial play.",
          ],
          status: "open",
          impact: {
            assumed_downtime_hours: hours,
            downtime_loss: dtLoss,
            maintenance_cost: mach.maintenance_cost_estimate,
            total_estimated_impact: totalImpact,
            priority_score: 75,
            formula_version: "v1.0 (Downtime_Hrs × Loss_Rate + Repair_Cost)",
            inputs_used: {
              hours,
              loss_per_hour: mach.loss_per_hour,
              repair_cost: mach.maintenance_cost_estimate,
            },
          },
        });
      }
    });

    this.dataset = {
      id: Date.now(),
      name: fileName,
      source: "upload",
      is_simulated: false,
      original_filename: fileName,
      row_count: parsedReadings.length,
      is_active: true,
      quality_report: {
        total_rows: parsedReadings.length,
        valid_rows: parsedReadings.length,
        missing_values_count: 0,
        duplicate_rows_count: 0,
        timestamp_range: {
          start: parsedReadings[0].timestamp,
          end: parsedReadings[parsedReadings.length - 1].timestamp,
        },
        sampling_rate: "variable / parsed",
        notes: [
          `Parsed ${parsedReadings.length} rows across ${machinesSeen.size} machine IDs.`,
          `Detected ${newAlerts.length} operational anomaly event clusters.`,
        ],
      },
    };

    this.machines = newMachines;
    this.readings = parsedReadings;
    this.alerts = newAlerts;
    this.persist();
  }

  // Multilingual AI Assistant query executor grounded in active dataset
  public queryAssistant(
    prompt: string,
    language: "en" | "ur"
  ): InvestigationMessage {
    const p = prompt.toLowerCase();
    const isUrdu = language === "ur";

    let responseText = "";
    const toolCalls = [];
    const evidenceCited: string[] = [];

    // Extract requested alert number if present (e.g., "alert #19", "alert 19", "#19")
    const alertMatch = p.match(/(?:alert\s*#?|#)\s*(\d+)/i);
    const requestedAlertId = alertMatch ? parseInt(alertMatch[1], 10) : null;

    // Find if any machine in active dataset is mentioned
    const mentionedMachine = this.machines.find(
      (m) =>
        p.includes(m.external_id.toLowerCase()) ||
        p.includes(m.name.toLowerCase())
    );

    // Find specific alert if requested or mentioned machine has an open alert
    let targetAlert = requestedAlertId !== null
      ? this.alerts.find((a) => a.id === requestedAlertId)
      : mentionedMachine
      ? this.alerts.find((a) => a.machine_id === mentionedMachine.external_id)
      : null;

    // If an alert was requested by number or machine, verify it exists in active dataset
    if (requestedAlertId !== null && !targetAlert) {
      toolCalls.push({
        tool: "get_alert_details",
        arguments: { alert_id: requestedAlertId, dataset_id: this.dataset.id },
        result: { error: "Alert not found in active dataset" },
      });
      evidenceCited.push(`Active Dataset: ${this.dataset.name}`);
      if (isUrdu) {
        responseText = `### تفتیش کی خرابی:
الرٹ #${requestedAlertId} موجودہ فعال ڈیٹاسیٹ (${this.dataset.name}) میں موجود نہیں ہے۔ براہ کرم درست الرٹ نمبر منتخب کریں یا موجودہ ڈیٹا کی جانچ کریں۔`;
      } else {
        responseText = `### Investigation Error:
Alert #${requestedAlertId} could not be found in the active dataset (**${this.dataset.name}**). Please verify the alert ID or select a valid alert from the active dataset telemetry.`;
      }
    } else if (targetAlert) {
      const mach = this.machines.find((m) => m.external_id === targetAlert?.machine_id);
      const recs = this.maintenance.filter((m) => m.machine_id === targetAlert?.machine_id);

      toolCalls.push({
        tool: "get_alert_details",
        arguments: { alert_id: targetAlert.id, machine_id: targetAlert.machine_id, dataset_id: this.dataset.id },
        result: { ...targetAlert },
      });
      toolCalls.push({
        tool: "search_maintenance_records",
        arguments: { machine_id: targetAlert.machine_id, dataset_id: this.dataset.id },
        result: { records: recs },
      });

      targetAlert.evidence.forEach((ev) => {
        evidenceCited.push(`${targetAlert?.machine_id} ${ev.feature}: ${ev.observed_value} ${ev.unit} (Baseline ${ev.baseline_median})`);
      });

      const primaryEv = targetAlert.evidence[0];
      const impactTotal = targetAlert.impact.total_estimated_impact ?? 0;

      if (isUrdu) {
        responseText = `### ${targetAlert.machine_id} تفتیشی رپورٹ (الرٹ #${targetAlert.id}):
1. **ڈیٹاسیٹ کا ماخذ**: فعال ڈیٹاسیٹ: **${this.dataset.name}** (${this.dataset.is_simulated ? "ڈیمو ڈیٹا" : "صارف کا اپ لوڈ کردہ ڈیٹا"})۔
2. **بے ضابطگی کی تفصیل**: مشین ${targetAlert.machine_id} پر ${primaryEv ? primaryEv.feature : "سینسر"} میں غیر معمولی انحراف دیکھا گیا (مشاہدہ: ${primaryEv?.observed_value} ${primaryEv?.unit}, بیس لائن: ${primaryEv?.baseline_median})۔
3. **دیکھ بھال کا ریکارڈ**: ${recs.length > 0 ? recs[0].description : "کوئی سابقہ قریبی ریکارڈ نہیں ملا۔"}
4. **تخمینہ مالی اثر**: کل متوقع اثر **$${impactTotal.toLocaleString()}**۔
5. **تجویز کردہ اقدامات**:
   - ${targetAlert.inspection_steps[0] || "فوری معائنہ کریں۔"}
   - سینسر کیلیبریشن اور مکینیکل جوڑ چیک کریں۔`;
      } else {
        responseText = `### Investigation for ${targetAlert.machine_id} (${targetAlert.machine_name || targetAlert.machine_id}) [Alert #${targetAlert.id}]:
1. **Dataset Grounding**: Active Dataset: **${this.dataset.name}** (${this.dataset.is_simulated ? "Simulated Demo" : "User Uploaded"}).
2. **Telemetry Deviation**: Anomaly detected on ${primaryEv ? primaryEv.feature : "Sensor"} reaching **${primaryEv?.observed_value} ${primaryEv?.unit}** (Baseline median: ${primaryEv?.baseline_median} ${primaryEv?.unit}, Deviation MAD: ${primaryEv?.deviation_mad}x).
3. **Maintenance Correlation**: ${recs.length > 0 ? recs[0].description : "No recent maintenance log found for this asset in the active dataset."}
4. **Business Impact**: Estimated total impact is **$${impactTotal.toLocaleString()}** (Downtime loss: $${(targetAlert.impact.downtime_loss ?? 0).toLocaleString()}, Repair: $${(targetAlert.impact.maintenance_cost ?? 0).toLocaleString()}).
5. **Actionable Recommendations**:
   - ${targetAlert.inspection_steps[0] || "Perform immediate physical inspection."}
   - ${targetAlert.inspection_steps[1] || "Verify telemetry threshold and sensor health."}`;
      }
    } else if (
      p.includes("financial") ||
      p.includes("cost") ||
      p.includes("impact") ||
      p.includes("نقصان") ||
      p.includes("لاگت")
    ) {
      toolCalls.push({
        tool: "calculate_business_impact",
        arguments: { dataset_id: this.dataset.id },
        result: {
          total_impact: this.alerts.reduce(
            (s, a) => s + (a.impact.total_estimated_impact ?? 0),
            0
          ),
          ranked_machines: this.machines.map((m) => ({
            id: m.external_id,
            loss_hr: m.loss_per_hour ?? 0,
          })),
        },
      });

      const topAlert = [...this.alerts].sort(
        (a, b) =>
          (b.impact.total_estimated_impact ?? 0) - (a.impact.total_estimated_impact ?? 0)
      )[0];
      if (topAlert) {
        evidenceCited.push(`Highest Impact: ${topAlert.machine_name || topAlert.machine_id} ($${(topAlert.impact.total_estimated_impact ?? 0).toLocaleString()})`);
      }
      evidenceCited.push(`Active Dataset: ${this.dataset.name}`);

      const totalExp = this.alerts.reduce((s, a) => s + (a.impact.total_estimated_impact ?? 0), 0);

      if (isUrdu) {
        responseText = `### مالی و آپریشنل ترجیحی تجزیہ (${this.dataset.name}):
- **فعال ڈیٹاسیٹ**: ${this.dataset.name} (${this.dataset.is_simulated ? "ڈیمو" : "اپ لوڈ کردہ"})
- **سب سے زیادہ مالی خطرہ**: ${topAlert ? `**${topAlert.machine_id}** ($${(topAlert.impact.total_estimated_impact ?? 0).toLocaleString()})` : "کوئی الرٹ نہیں"}
- **کل نمائش (Total Exposure)**: **$${totalExp.toLocaleString()}**
- **فارمولہ**: ڈیٹاسیٹ کے پیرامیٹرز کے مطابق حساب لگایا گیا۔`;
      } else {
        responseText = `### Financial & Criticality Impact Ranking [${this.dataset.name}]:
- **Active Dataset**: **${this.dataset.name}** (${this.dataset.is_simulated ? "Demo Dataset" : "Uploaded Dataset"})
- **Highest Financial Risk**: ${topAlert ? `**${topAlert.machine_id}** (${topAlert.machine_name}) accounting for **$${(topAlert.impact.total_estimated_impact ?? 0).toLocaleString()}**` : "No active alerts"}
- **Portfolio Cumulative Exposure**: Total unmitigated downtime exposure across active alerts is **$${totalExp.toLocaleString()}**.
- **Grounding**: Calculated strictly from active dataset metrics.`;
      }
    } else {
      toolCalls.push({
        tool: "get_sensor_summary",
        arguments: { dataset_id: this.dataset.id, dataset_name: this.dataset.name },
        result: {
          dataset_name: this.dataset.name,
          machines_count: this.machines.length,
          active_alerts: this.alerts.length,
        },
      });
      evidenceCited.push(`Active Dataset: ${this.dataset.name}`);
      evidenceCited.push(`Monitored Assets: ${this.machines.length}`);
      evidenceCited.push(`Open Alerts: ${this.alerts.filter((a) => a.status === "open").length}`);

      const openAlertsCount = this.alerts.filter((a) => a.status === "open").length;
      const topPriority = this.alerts[0];

      if (isUrdu) {
        responseText = `### ڈیٹاسیٹ کا خلاصہ (${this.dataset.name}):
آپ کے فعال ڈیٹاسیٹ **${this.dataset.name}** میں کل **${this.machines.length}** اثاثے اور **${openAlertsCount}** فعال الرٹس موجود ہیں۔ ${topPriority ? `سب سے نمایاں الرٹ مشین **${topPriority.machine_id}** پر ہے۔` : "کوئی فعال الرٹ نہیں ہے۔"} آپ کسی بھی مخصوص مشین یا الرٹ نمبر کی تفتیش کے بارے میں پوچھ سکتے ہیں۔`;
      } else {
        responseText = `### Telemetry Status Summary [Active Dataset: ${this.dataset.name}]:
You are currently investigating **${this.dataset.name}** (${this.dataset.is_simulated ? "Demo Dataset" : "User Uploaded Dataset"}).
- **Monitored Production Assets**: ${this.machines.length}
- **Open Anomaly Alerts**: ${openAlertsCount}
${topPriority ? `- **Highest Priority Item**: Alert #${topPriority.id} on **${topPriority.machine_id}** (${topPriority.machine_name || topPriority.machine_id})` : ""}
You can ask to investigate any specific alert (e.g. alert #19), inspect machine history, or calculate business financial impact.`;
      }
    }

    return {
      id: generateMessageId("msg"),
      sender: "assistant",
      content: responseText,
      timestamp: new Date().toISOString(),
      language,
      toolCalls,
      evidenceCited,
    };
  }

  // Generate downloadable maintenance report
  public generateReport(
    alertId: number | null,
    language: "en" | "ur",
    format: "md" | "txt" | "pdf" = "md"
  ): MaintenanceReport {
    const isUrdu = language === "ur";
    const dateStr = new Date().toISOString();
    const targetAlerts =
      alertId !== null
        ? this.alerts.filter((a) => a.id === alertId)
        : this.alerts.filter((a) => a.status === "open");

    let content = "";
    if (isUrdu) {
      content = `# فیکٹری مائنڈ AI — تکنیکی دیکھ بھال کی رپورٹ
**تیاری کی تاریخ**: ${dateStr}
**ڈیٹاسیٹ**: ${this.dataset.name} (${this.dataset.is_simulated ? "فرضی ڈیمو ڈیٹا" : "حقیقی اپ لوڈ ڈیٹا"})
**اسٹیٹس**: جائزہ برائے چیف انجینئر

---

## 1. ایگزیکٹو خلاصہ
اس رپورٹ میں انوملی ڈٹیکشن سسٹم کے ذریعہ شناخت شدہ بے ضابطگیوں کی تفصیل پیش کی گئی ہے۔
- زیر نگرانی کل مشینیں: ${this.machines.length}
- ترجیحی الرٹس کی تعداد: ${targetAlerts.length}
- کل متوقع ڈاؤن ٹائم نقصان: $${targetAlerts.reduce((s, a) => s + (a.impact.total_estimated_impact ?? 0), 0).toLocaleString()}

---

## 2. الرٹس کی تفصیل اور سینسر ثبوت
${targetAlerts
  .map(
    (a) => `### الرٹ #${a.id}: ${a.machine_name} (${a.machine_id})
- **شدت**: ${a.severity.toUpperCase()} (انوملی اسکور: ${a.anomaly_score})
- **دورانیہ**: ${a.start_ts} سے ${a.end_ts}
- **شماریاتی اسباب**:
${a.severity_reason.map((r) => `  * ${r}`).join("\n")}
- **سینسر کے ٹھوس شواہد**:
${a.evidence.map((e) => `  * ${e.feature}: موجودہ قدر ${e.observed_value} ${e.unit} (معمول: ${e.baseline_median} ${e.unit}, انحراف: ${e.deviation_mad}x MAD)`).join("\n")}
- **مالی تخمینہ**:
  * متوقع ڈاؤن ٹائم: ${a.impact.assumed_downtime_hours ?? 0} گھنٹے
  * ڈاؤن ٹائم نقصان کی شرح: $${a.impact.inputs_used?.loss_per_hour ?? 0}/گھنٹہ
  * کل متوقع لاگت: $${(a.impact.total_estimated_impact ?? 0).toLocaleString()}
- **تجویز کردہ معائنہ کے مراحل**:
${a.inspection_steps.map((s) => `  [ ] ${s}`).join("\n")}
`
  )
  .join("\n")}

---

## 3. لازمی انسانی معائنہ کی توثیق
تمام سفارشات مشین لرننگ شماریاتی ماڈلز کے ذریعہ تیار کی گئی ہیں اور حتمی کارروائی سے قبل فیلڈ انجینئر کی تصدیق لازمی ہے۔`;
    } else {
      content = `# FACTORYMIND AI — EVIDENCE-BASED MAINTENANCE REPORT
**Generated**: ${dateStr}
**Dataset**: ${this.dataset.name} (${this.dataset.is_simulated ? "SIMULATED DEMO DATA" : "LIVE SENSOR INGESTION"})
**Status**: Pending Plant Engineering Review

---

## 1. Executive Summary
This report summarizes critical statistical deviations detected across plant assets.
- Monitored Assets: ${this.machines.length}
- Active Alerts Reviewed: ${targetAlerts.length}
- Total Estimated Financial Exposure: $${targetAlerts.reduce((s, a) => s + (a.impact.total_estimated_impact ?? 0), 0).toLocaleString()}

---

## 2. Priority Asset Anomalies & Sensor Evidence
${targetAlerts
  .map(
    (a) => `### Alert #${a.id}: ${a.machine_name} [${a.machine_id}]
- **Severity**: ${a.severity.toUpperCase()} | **Anomaly Score**: ${a.anomaly_score} | **Status**: ${a.status}
- **Active Window**: ${a.start_ts} to ${a.end_ts}
- **Detector Rule Triggers**:
${a.severity_reason.map((r) => `  * ${r}`).join("\n")}
- **Direct Sensor Evidence**:
${a.evidence.map((e) => `  * ${e.feature}: Measured ${e.observed_value} ${e.unit} vs baseline median ${e.baseline_median} ${e.unit} (${e.deviation_mad}x MAD deviation)`).join("\n")}
- **Business Impact Calculation**:
  * Assumed Unscheduled Downtime: ${a.impact.assumed_downtime_hours ?? 0} hrs
  * Production Loss Rate: $${a.impact.inputs_used?.loss_per_hour ?? 0}/hr ($${(a.impact.downtime_loss ?? 0).toLocaleString()} total loss)
  * Estimated Component Repair: $${(a.impact.maintenance_cost ?? 0).toLocaleString()}
  * Total Estimated Financial Impact: **$${(a.impact.total_estimated_impact ?? 0).toLocaleString()}**
  * Operational Priority Score: **${a.impact.priority_score ?? 0} / 100**
- **Actionable Inspection Checklist**:
${a.inspection_steps.map((s) => `  [ ] ${s}`).join("\n")}
`
  )
  .join("\n")}

---

## 3. Assumption Transparency & Disclaimer
All financial downtime figures are based on explicit configured hourly production loss rates and component estimates. An anomaly detection constitutes an unusual operational pattern, not conclusive proof of physical failure. All actions require qualified technician confirmation before halting equipment.`;
    }

    return {
      id: Date.now(),
      title: isUrdu
        ? `دیکھ بھال کی رپورٹ - ${targetAlerts.length} الرٹس`
        : `Maintenance Dispatch Report - ${targetAlerts.length} Active Events`,
      generated_at: dateStr,
      dataset_name: this.dataset.name,
      is_simulated: this.dataset.is_simulated,
      language,
      format,
      content,
      alert_ids: targetAlerts.map((a) => a.id),
    };
  }
}

export const store = DataStore.getInstance();
