"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SensorReading } from "@/types";

interface TelemetryChartProps {
  readings: SensorReading[];
  activeChannel: "vibration" | "temperature" | "current";
}

export function TelemetryChart({ readings, activeChannel }: TelemetryChartProps) {
  const chartData = readings.map((r, idx) => ({
    time: r.timestamp.length >= 16 ? r.timestamp.slice(11, 16) : r.timestamp,
    temperature: r.temperature,
    vibration: r.vibration,
    current: r.current,
    is_anomalous: r.is_anomalous,
    idx,
  }));

  const anomalousIndices = chartData
    .map((d, i) => (d.is_anomalous ? i : -1))
    .filter((i) => i !== -1);
  const anomalyStart =
    anomalousIndices.length > 0 ? chartData[anomalousIndices[0]]?.time : undefined;
  const anomalyEnd =
    anomalousIndices.length > 0
      ? chartData[anomalousIndices[anomalousIndices.length - 1]]?.time
      : undefined;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis dataKey="time" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--panel)",
              borderColor: "var(--line)",
              borderRadius: "6px",
              fontSize: "12px",
            }}
          />
          <Legend wrapperStyle={{ fontSize: "12px" }} />
          {anomalyStart && anomalyEnd && (
            <ReferenceArea
              x1={anomalyStart}
              x2={anomalyEnd}
              stroke="var(--danger)"
              strokeOpacity={0.4}
              fill="var(--danger)"
              fillOpacity={0.12}
              label={{
                value: "Anomaly Window",
                fill: "var(--danger)",
                fontSize: 10,
                position: "insideTopLeft",
              }}
            />
          )}
          {activeChannel === "vibration" && (
            <Line
              type="monotone"
              dataKey="vibration"
              name="Vibration (mm/s)"
              stroke="#0b7285"
              strokeWidth={2}
              dot={false}
            />
          )}
          {activeChannel === "temperature" && (
            <Line
              type="monotone"
              dataKey="temperature"
              name="Temperature (°C)"
              stroke="#f0a03a"
              strokeWidth={2}
              dot={false}
            />
          )}
          {activeChannel === "current" && (
            <Line
              type="monotone"
              dataKey="current"
              name="Drive Current (A)"
              stroke="#1b7f4b"
              strokeWidth={2}
              dot={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
