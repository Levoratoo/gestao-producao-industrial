"use client";

type ReportExportActionsProps = {
  onExportCsv: () => Promise<void> | void;
  onExportPdf: () => Promise<void> | void;
};

export function ReportExportActions({
  onExportCsv,
  onExportPdf,
}: ReportExportActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => void onExportCsv()}
        className="rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
      >
        Exportar CSV
      </button>
      <button
        type="button"
        onClick={() => void onExportPdf()}
        className="rounded-full border border-white/8 bg-white/4 px-4 py-2 text-sm text-[color:var(--muted)] transition-colors hover:border-[color:var(--accent)] hover:text-white"
      >
        Exportar PDF
      </button>
    </div>
  );
}
