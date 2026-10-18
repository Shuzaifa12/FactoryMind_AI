import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import autoTable from "jspdf-autotable";
import type { Alert, Dataset, Machine, MaintenanceReport } from "@/types";

export interface GeneratePdfOptions {
  report: MaintenanceReport;
  alerts: Alert[];
  machines: Machine[];
  dataset: Dataset;
}

export async function generatePdfReport({
  report,
  alerts,
  machines,
  dataset,
}: GeneratePdfOptions): Promise<jsPDF> {
  const isUrdu = report.language === "ur";

  // Support both standard ESM named and CJS default export shapes
  const PDFClass =
    typeof jsPDF === "function"
      ? jsPDF
      : ((jsPDF as unknown as { jsPDF?: typeof jsPDF; default?: typeof jsPDF }).jsPDF ??
        (jsPDF as unknown as { default?: typeof jsPDF }).default ??
        jsPDF);

  const doc = new PDFClass({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let cursorY = margin;

  // Filter alerts matching this report
  const targetAlerts =
    report.alert_ids && report.alert_ids.length > 0
      ? alerts.filter((a) => report.alert_ids.includes(a.id))
      : alerts.filter((a) => a.status === "open");

  const totalFinancialImpact = targetAlerts.reduce(
    (acc, a) => acc + (a.impact?.total_estimated_impact ?? 0),
    0
  );

  // If Urdu is selected, render via DOM HTML + html2canvas for perfect Arabic/Urdu shaping and RTL layout
  if (isUrdu) {
    const container = document.createElement("div");
    container.style.position = "fixed";
    container.style.left = "-9999px";
    container.style.top = "0";
    container.style.width = "794px"; // A4 width at 96 DPI
    container.style.backgroundColor = "#ffffff";
    container.style.color = "#0f172a";
    container.style.fontFamily = "'Noto Naskh Arabic', 'Amiri', Tahoma, sans-serif";
    container.style.direction = "rtl";
    container.style.textAlign = "right";
    container.style.padding = "32px";
    container.style.boxSizing = "border-box";

    container.innerHTML = `
      <div style="background: #1e293b; color: #ffffff; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
        <h1 style="margin: 0 0 8px 0; font-size: 20px; font-weight: bold;">فیکٹری مائنڈ AI — تکنیکی دیکھ بھال کی رپورٹ</h1>
        <p style="margin: 0; font-size: 12px; color: #cbd5e1;">رپورٹ آئی ڈی: #${report.id}  |  تاریخ تیاری: ${new Date(report.generated_at).toLocaleString()}</p>
        <p style="margin: 4px 0 0 0; font-size: 12px; color: #cbd5e1;">ڈیٹاسیٹ: ${dataset.name || report.dataset_name}  [${dataset.is_simulated ? "فرضی ڈیمو ڈیٹا" : "حقیقی سینسر ڈیٹا"}]</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 15px; font-weight: bold; border-bottom: 2px solid #334155; padding-bottom: 6px; margin-bottom: 12px;">1. ایگزیکٹو خلاصہ اور مالی اثرات</h2>
        <div style="display: flex; gap: 12px; margin-bottom: 16px;">
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px;">
            <div style="font-size: 11px; color: #64748b;">زیر نگرانی کل مشینیں</div>
            <div style="font-size: 18px; font-weight: bold; color: #0f172a; margin-top: 4px;">${machines.length}</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px;">
            <div style="font-size: 11px; color: #64748b;">جائزہ لیے گئے الرٹس</div>
            <div style="font-size: 18px; font-weight: bold; color: #dc2626; margin-top: 4px;">${targetAlerts.length}</div>
          </div>
          <div style="flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px;">
            <div style="font-size: 11px; color: #64748b;">کل متوقع مالی نقصان</div>
            <div style="font-size: 18px; font-weight: bold; color: #b45309; margin-top: 4px;">$${totalFinancialImpact.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 15px; font-weight: bold; border-bottom: 2px solid #334155; padding-bottom: 6px; margin-bottom: 12px;">2. ترجیحی اثاثہ جات کی بے ضابطگیاں اور سینسر شواہد</h2>
        ${targetAlerts.length === 0 ? '<p style="color: #64748b; font-size: 13px;">موجودہ ڈیٹاسیٹ کے لیے کوئی فعال الرٹ نہیں ملا۔</p>' : targetAlerts.map((a, idx) => `
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 16px; overflow: hidden; page-break-inside: avoid;">
            <div style="background: #f1f5f9; padding: 10px 14px; display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
              <span>آئٹم #${idx + 1} — الرٹ #${a.id}: ${a.machine_name} (${a.machine_id})</span>
              <span style="color: ${a.severity === 'critical' ? '#b91c1c' : '#d97706'};">${a.severity.toUpperCase()}</span>
            </div>
            <div style="padding: 14px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #475569;">انوملی اسکور: ${a.anomaly_score}  |  وقت: ${a.start_ts} سے ${a.end_ts}</p>
              ${a.severity_reason ? a.severity_reason.map(r => `<p style="margin: 3px 0; font-size: 12px; color: #64748b; font-style: italic;">• ${r}</p>`).join('') : ''}
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
                <thead>
                  <tr style="background: #334155; color: #ffffff;">
                    <th style="padding: 8px; text-align: right; border: 1px solid #475569;">سینسر چینل</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #475569;">مشاہدہ شدہ چوٹی</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #475569;">بیس لائن میڈین</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #475569;">انحراف (x MAD)</th>
                    <th style="padding: 8px; text-align: right; border: 1px solid #475569;">یونٹ</th>
                  </tr>
                </thead>
                <tbody>
                  ${a.evidence.map(e => `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${e.feature}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${e.observed_value}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${e.baseline_median}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${e.deviation_mad}x</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${e.unit}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>

              ${a.impact ? `
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px;">
                  <thead>
                    <tr style="background: #475569; color: #ffffff;">
                      <th style="padding: 8px; text-align: right; border: 1px solid #64748b;">متوقع ڈاؤن ٹائم</th>
                      <th style="padding: 8px; text-align: right; border: 1px solid #64748b;">فی گھنٹہ نقصان</th>
                      <th style="padding: 8px; text-align: right; border: 1px solid #64748b;">ڈاؤن ٹائم نقصان</th>
                      <th style="padding: 8px; text-align: right; border: 1px solid #64748b;">مرمت کی لاگت</th>
                      <th style="padding: 8px; text-align: right; border: 1px solid #64748b;">کل مالی اثر</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">${a.impact.assumed_downtime_hours ?? 0} گھنٹے</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">$${Number(a.impact.inputs_used?.loss_per_hour ?? 0).toLocaleString()}/گھنٹہ</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">$${Number(a.impact.downtime_loss ?? 0).toLocaleString()}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0;">$${Number(a.impact.maintenance_cost ?? 0).toLocaleString()}</td>
                      <td style="padding: 8px; border: 1px solid #e2e8f0; font-weight: bold;">$${Number(a.impact.total_estimated_impact ?? 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              ` : ''}

              ${a.inspection_steps ? `
                <div style="margin-top: 12px;">
                  <div style="font-weight: bold; font-size: 12px; margin-bottom: 6px;">تجویز کردہ معائنہ کے مراحل:</div>
                  ${a.inspection_steps.map(s => `<div style="font-size: 12px; color: #475569; margin-bottom: 3px;">[  ] ${s}</div>`).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      <div style="page-break-inside: avoid;">
        <h2 style="font-size: 15px; font-weight: bold; border-bottom: 2px solid #334155; padding-bottom: 6px; margin-bottom: 12px;">3. مفروضات کی شفافیت اور آپریشنل دستبرداری</h2>
        <p style="font-size: 12px; color: #64748b; line-height: 1.8; margin: 0;">
          تمام مالیاتی ڈاؤن ٹائم کا حساب کتاب پیداوار کے نقصان کی شرح اور اجزاء کی مرمت کے تخمینے پر مبنی ہے۔ انوملی ڈیٹیکشن تاریخی میڈین سے شماریاتی انحراف کو ظاہر کرتی ہے؛ الرٹ کا مطلب غیر معمولی پیٹرن ہے، تصدیق شدہ نقصان نہیں۔ تمام سفارشات کے لیے فیلڈ انجینئر کی تصدیق لازمی ہے۔
        </p>
      </div>
    `;

    document.body.appendChild(container);
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL("image/png");
    const urduDoc = new PDFClass({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const imgWidth = pageWidth - margin * 2;
    const pageImgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = pageImgHeight;
    let position = margin;

    urduDoc.addImage(imgData, "PNG", margin, position, imgWidth, pageImgHeight);
    heightLeft -= pageHeight - margin * 2;

    while (heightLeft >= 0) {
      position = heightLeft - pageImgHeight + margin;
      urduDoc.addPage();
      urduDoc.addImage(imgData, "PNG", margin, position, imgWidth, pageImgHeight);
      heightLeft -= pageHeight - margin * 2;
    }

    return urduDoc;
  }

  // Helper: check page overflow and add new page if needed
  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - 18) {
      doc.addPage();
      cursorY = margin + 5;
    }
  };

  // 1. Header Banner
  doc.setFillColor(30, 41, 59);
  doc.rect(margin, cursorY, pageWidth - margin * 2, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("FACTORYMIND AI — MAINTENANCE REPORT", margin + 5, cursorY + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225);
  doc.text(
    `Report ID: #${report.id}  |  Generated: ${new Date(report.generated_at).toLocaleString()}`,
    margin + 5,
    cursorY + 14
  );
  doc.text(
    `Dataset: ${dataset.name || report.dataset_name}  [${
      dataset.is_simulated || report.is_simulated ? "SIMULATED DEMO DATA" : "LIVE SENSOR INGESTION"
    }]`,
    margin + 5,
    cursorY + 19
  );

  cursorY += 26;

  // 2. Executive Summary Cards
  checkPageBreak(25);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("1. Executive Summary & Plant Financial Exposure", margin, cursorY);
  cursorY += 4;

  const cardWidth = (pageWidth - margin * 2 - 8) / 3;
  const cardHeight = 16;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, cursorY, cardWidth, cardHeight, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Monitored Assets", margin + 4, cursorY + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(String(machines.length), margin + 4, cursorY + 12);

  const card2X = margin + cardWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.rect(card2X, cursorY, cardWidth, cardHeight, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Active Alerts Reviewed", card2X + 4, cursorY + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(220, 38, 38);
  doc.text(String(targetAlerts.length), card2X + 4, cursorY + 12);

  const card3X = card2X + cardWidth + 4;
  doc.setFillColor(248, 250, 252);
  doc.rect(card3X, cursorY, cardWidth, cardHeight, "FD");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Total Estimated Exposure", card3X + 4, cursorY + 5);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(180, 83, 9);
  doc.text(`$${totalFinancialImpact.toLocaleString()}`, card3X + 4, cursorY + 12);

  cursorY += cardHeight + 8;

  // 3. Priority Asset Anomalies & Evidence Section
  checkPageBreak(15);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("2. Priority Asset Anomalies & Sensor Telemetry Evidence", margin, cursorY);
  cursorY += 5;

  if (targetAlerts.length === 0) {
    checkPageBreak(10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("No active open alerts detected for the current dataset.", margin, cursorY);
    cursorY += 8;
  } else {
    targetAlerts.forEach((alert, idx) => {
      checkPageBreak(35);

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.rect(margin, cursorY, pageWidth - margin * 2, 7, "FD");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      const titleStr = `Item #${idx + 1} — Alert #${alert.id}: ${alert.machine_name} (${alert.machine_id})`;
      doc.text(titleStr, margin + 3, cursorY + 5);

      const sevStr = alert.severity ? alert.severity.toUpperCase() : "MEDIUM";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      if (sevStr === "CRITICAL") doc.setTextColor(185, 28, 28);
      else if (sevStr === "HIGH") doc.setTextColor(217, 119, 6);
      else doc.setTextColor(3, 105, 161);
      doc.text(sevStr, pageWidth - margin - 22, cursorY + 5);

      cursorY += 9;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      const scoreStr =
        alert.anomaly_score !== undefined && alert.anomaly_score !== null
          ? String(alert.anomaly_score)
          : "N/A";
      doc.text(
        `Anomaly Score: ${scoreStr}  |  Time: ${alert.start_ts} to ${alert.end_ts}`,
        margin,
        cursorY
      );
      cursorY += 5;

      if (alert.severity_reason && alert.severity_reason.length > 0) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        alert.severity_reason.forEach((reason) => {
          const splitReason = doc.splitTextToSize(`• ${reason}`, pageWidth - margin * 2 - 4);
          checkPageBreak(splitReason.length * 3.5);
          doc.text(splitReason, margin + 2, cursorY);
          cursorY += splitReason.length * 3.5 + 1;
        });
      }

      if (alert.evidence && alert.evidence.length > 0) {
        cursorY += 2;
        autoTable(doc, {
          startY: cursorY,
          margin: { left: margin, right: margin },
          head: [["Sensor Channel", "Observed Peak", "Baseline Median", "Deviation (x MAD)", "Unit"]],
          body: alert.evidence.map((e) => [
            String(e.feature),
            String(e.observed_value),
            String(e.baseline_median),
            `${e.deviation_mad}x`,
            String(e.unit),
          ]),
          theme: "grid",
          styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [30, 41, 59], overflow: "linebreak" },
          headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: "bold" },
        });

        // @ts-expect-error jsPDF autotable mutates lastAutoTable
        cursorY = doc.lastAutoTable.finalY + 4;
      }

      if (alert.impact) {
        const imp = alert.impact;
        const lossRate = imp.inputs_used?.loss_per_hour ?? 0;
        const dtLoss = imp.downtime_loss ?? 0;
        const maintCost = imp.maintenance_cost ?? 0;
        const total = imp.total_estimated_impact ?? 0;
        const priority = imp.priority_score ?? 0;

        autoTable(doc, {
          startY: cursorY,
          margin: { left: margin, right: margin },
          head: [["Assumed Downtime", "Hourly Loss Rate", "Downtime Loss", "Maint. Cost", "Total Financial Impact", "Priority Score"]],
          body: [[
            `${imp.assumed_downtime_hours ?? 0} hrs`,
            `$${Number(lossRate).toLocaleString()}/hr`,
            `$${Number(dtLoss).toLocaleString()}`,
            `$${Number(maintCost).toLocaleString()}`,
            `$${Number(total).toLocaleString()}`,
            `${priority} / 100`,
          ]],
          theme: "grid",
          styles: { fontSize: 7.5, cellPadding: 1.5, textColor: [30, 41, 59], overflow: "linebreak" },
          headStyles: { fillColor: [71, 85, 105], textColor: [255, 255, 255], fontStyle: "bold" },
        });

        // @ts-expect-error jsPDF autotable mutates lastAutoTable
        cursorY = doc.lastAutoTable.finalY + 4;
      }

      if (alert.inspection_steps && alert.inspection_steps.length > 0) {
        checkPageBreak(8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(30, 41, 59);
        doc.text("Actionable Inspection Checklist:", margin, cursorY);
        cursorY += 4;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        alert.inspection_steps.forEach((step) => {
          const splitStep = doc.splitTextToSize(`[  ]  ${step}`, pageWidth - margin * 2 - 4);
          checkPageBreak(splitStep.length * 3.5);
          doc.text(splitStep, margin + 2, cursorY);
          cursorY += splitStep.length * 3.5 + 1;
        });
      }

      cursorY += 5;
    });
  }

  // 4. Transparency, Quality Caveats & Disclaimer
  checkPageBreak(30);
  doc.setTextColor(15, 23, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("3. Assumption Transparency & Operational Disclaimer", margin, cursorY);
  cursorY += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const disclaimerText =
    "All financial downtime calculations are based on user-configured production loss rates and component repair estimates. " +
    "Anomaly detection flags statistical deviations from historical medians; an alert constitutes an unusual pattern, not verified physical damage. " +
    "All recommendations require on-site validation by a qualified plant technician before interrupting production machinery.";

  const splitDisclaimer = doc.splitTextToSize(disclaimerText, pageWidth - margin * 2);
  checkPageBreak(splitDisclaimer.length * 3 + 4);
  doc.text(splitDisclaimer, margin, cursorY);
  cursorY += splitDisclaimer.length * 3 + 6;

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `FactoryMind AI Plant Diagnostics  |  Confidential  |  Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  return doc;
}
