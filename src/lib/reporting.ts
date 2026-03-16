import type { ProductionAlert, ProductionOrder, ProductionSnapshot } from "@/domain/production/types";
import {
  formatCompactNumber,
  formatDateShort,
  formatDateTimeShort,
  formatPercentage,
} from "@/lib/formatters";
import { getOrderCompletionPercent, getOrderDueMeta } from "@/lib/order-helpers";
import {
  getAlertSeverityMeta,
  getAlertTypeLabel,
  getOrderStatusMeta,
  getSectorLabel,
  getSectorStatusMeta,
} from "@/lib/status-meta";

type JsPdfWithAutoTable = {
  lastAutoTable?: {
    finalY: number;
  };
};

type ReportSection = {
  title: string;
  columns: string[];
  rows: string[][];
};

export async function exportDashboardCsv(snapshot: ProductionSnapshot) {
  const report = buildDashboardReport(snapshot);
  downloadCsv(report.fileName, report.sections);
}

export async function exportDashboardPdf(snapshot: ProductionSnapshot) {
  const report = buildDashboardReport(snapshot);
  await downloadPdf(report.title, report.fileName, report.sections);
}

export async function exportOrdersCsv(
  orders: ProductionOrder[],
  currentTime: string,
) {
  const report = buildOrdersReport(orders, currentTime);
  downloadCsv(report.fileName, report.sections);
}

export async function exportOrdersPdf(
  orders: ProductionOrder[],
  currentTime: string,
) {
  const report = buildOrdersReport(orders, currentTime);
  await downloadPdf(report.title, report.fileName, report.sections);
}

export async function exportAlertsCsv(
  activeAlerts: ProductionAlert[],
  historyAlerts: ProductionAlert[],
) {
  const report = buildAlertsReport(activeAlerts, historyAlerts);
  downloadCsv(report.fileName, report.sections);
}

export async function exportAlertsPdf(
  activeAlerts: ProductionAlert[],
  historyAlerts: ProductionAlert[],
) {
  const report = buildAlertsReport(activeAlerts, historyAlerts);
  await downloadPdf(report.title, report.fileName, report.sections);
}

function buildDashboardReport(snapshot: ProductionSnapshot) {
  const activeOrders = snapshot.orders.filter((order) => order.status !== "concluida");

  return {
    title: "Relatorio Dashboard Industrial",
    fileName: `dashboard-rosa-maria-${snapshot.currentTime.slice(0, 10)}`,
    sections: [
      {
        title: "Resumo executivo",
        columns: ["Indicador", "Valor"],
        rows: [
          ["Atualizado em", formatDateTimeShort(snapshot.currentTime)],
          ["Cenario", snapshot.scenarioKey],
          ["Producao do dia", formatCompactNumber(snapshot.dailyProduced)],
          ["Meta do dia", formatCompactNumber(snapshot.dailyTarget)],
          ["Projecao", formatPercentage(snapshot.projectedCompletion / 100)],
          ["Defeitos", formatPercentage(snapshot.defectRate / 100)],
          ["Paradas acumuladas", `${formatCompactNumber(snapshot.downtimeMinutes)} min`],
        ],
      },
      {
        title: "Setores",
        columns: ["Setor", "Status", "Eficiencia", "Produzido", "Meta", "Alertas"],
        rows: snapshot.sectors.map((sector) => [
          sector.name,
          getSectorStatusMeta(sector.status).label,
          formatPercentage(sector.efficiency / 100),
          formatCompactNumber(sector.actualDailyOutput),
          formatCompactNumber(sector.plannedDailyOutput),
          String(sector.alertCount),
        ]),
      },
      {
        title: "Ordens em andamento",
        columns: ["OP", "Produto", "Setor", "Status", "Conclusao"],
        rows: activeOrders.map((order) => [
          order.number,
          order.productName,
          getSectorLabel(order.currentSector),
          getOrderStatusMeta(order.status).label,
          formatPercentage(getOrderCompletionPercent(order) / 100),
        ]),
      },
      {
        title: "Alertas ativos",
        columns: ["Titulo", "Setor", "Criticidade", "Horario"],
        rows: snapshot.alerts.map((alert) => [
          alert.title,
          alert.sector === "fabrica" ? "Fabrica" : getSectorLabel(alert.sector),
          getAlertSeverityMeta(alert.severity).label,
          formatDateTimeShort(alert.timestamp),
        ]),
      },
    ],
  };
}

function buildOrdersReport(orders: ProductionOrder[], currentTime: string) {
  return {
    title: "Relatorio de Ordens de Producao",
    fileName: `ordens-rosa-maria-${currentTime.slice(0, 10)}`,
    sections: [
      {
        title: "Carteira filtrada",
        columns: [
          "OP",
          "Produto",
          "Setor",
          "Status",
          "Prazo",
          "Janela",
          "Planejado",
          "Produzido",
          "Conclusao",
        ],
        rows: orders.map((order) => [
          order.number,
          order.productName,
          getSectorLabel(order.currentSector),
          getOrderStatusMeta(order.status).label,
          formatDateShort(order.dueDate),
          getOrderDueMeta(order, currentTime).label,
          formatCompactNumber(order.plannedQuantity),
          formatCompactNumber(order.producedQuantity),
          formatPercentage(getOrderCompletionPercent(order) / 100),
        ]),
      },
    ],
  };
}

function buildAlertsReport(
  activeAlerts: ProductionAlert[],
  historyAlerts: ProductionAlert[],
) {
  return {
    title: "Relatorio de Alertas Operacionais",
    fileName: `alertas-rosa-maria-${new Date().toISOString().slice(0, 10)}`,
    sections: [
      {
        title: "Alertas ativos",
        columns: ["Titulo", "Tipo", "Setor", "Criticidade", "Origem", "Horario"],
        rows: activeAlerts.map((alert) => [
          alert.title,
          getAlertTypeLabel(alert.type),
          alert.sector === "fabrica" ? "Fabrica" : getSectorLabel(alert.sector),
          getAlertSeverityMeta(alert.severity).label,
          alert.source === "manual" ? "Manual" : "Simulacao",
          formatDateTimeShort(alert.timestamp),
        ]),
      },
      {
        title: "Historico",
        columns: ["Titulo", "Setor", "Criticidade", "Confirmado por", "Resolvido em"],
        rows: historyAlerts.map((alert) => [
          alert.title,
          alert.sector === "fabrica" ? "Fabrica" : getSectorLabel(alert.sector),
          getAlertSeverityMeta(alert.severity).label,
          alert.acknowledgedBy ?? "Resolucao automatica",
          formatDateTimeShort(alert.resolvedAt ?? alert.acknowledgedAt ?? alert.timestamp),
        ]),
      },
    ],
  };
}

function downloadCsv(fileName: string, sections: ReportSection[]) {
  const csvContent = sections
    .map((section) =>
      [
        section.title,
        section.columns.join(";"),
        ...section.rows.map((row) => row.map(escapeCsvCell).join(";")),
      ].join("\n"),
    )
    .join("\n\n");

  downloadBlob(
    `${fileName}.csv`,
    new Blob([`\uFEFF${csvContent}`], { type: "text/csv;charset=utf-8;" }),
  );
}

async function downloadPdf(
  title: string,
  fileName: string,
  sections: ReportSection[],
) {
  const [{ jsPDF }, autoTableModule] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const autoTable = autoTableModule.default;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(title, 40, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Rosa Maria Industrial", 40, 54);

  let currentY = 72;

  sections.forEach((section, index) => {
    if (index > 0) {
      currentY += 18;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(section.title, 40, currentY);
    currentY += 10;

    autoTable(doc, {
      startY: currentY,
      head: [section.columns],
      body: section.rows.length > 0 ? section.rows : [["Sem dados"]],
      margin: {
        left: 40,
        right: 40,
      },
      styles: {
        fontSize: 9,
        cellPadding: 5,
      },
      headStyles: {
        fillColor: [16, 39, 58],
      },
      alternateRowStyles: {
        fillColor: [244, 246, 248],
      },
    });

    currentY = ((doc as JsPdfWithAutoTable).lastAutoTable?.finalY ?? currentY) + 12;
  });

  doc.save(`${fileName}.pdf`);
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

function escapeCsvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
