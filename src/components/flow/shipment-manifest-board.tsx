import { SectionCard } from "@/components/shared/section-card";
import { StatusBadge } from "@/components/shared/status-badge";
import type { ShipmentManifest } from "@/domain/production/types";
import { formatCompactNumber, formatDateTimeShort } from "@/lib/formatters";
import { getShipmentStatusMeta } from "@/lib/workflow-meta";

type ShipmentManifestBoardProps = {
  manifests: ShipmentManifest[];
};

export function ShipmentManifestBoard({ manifests }: ShipmentManifestBoardProps) {
  return (
    <SectionCard
      title="Faturamento, minuta e embarque"
      description="Fila final de saida para faturar, gerar minuta, acoplar caminhão e despachar o pedido."
    >
      <div className="grid gap-4 xl:grid-cols-2">
        {manifests.map((manifest) => {
          const statusMeta = getShipmentStatusMeta(manifest.status);

          return (
            <article
              key={manifest.id}
              className="rounded-[26px] border border-white/8 bg-white/4 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-[color:var(--muted)]">
                    {manifest.orderNumber}
                  </p>
                  <h4 className="mt-2 text-lg font-medium">{manifest.customerName}</h4>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    {manifest.carrierName} • {manifest.driverName}
                  </p>
                </div>
                <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Metric label="Nota fiscal" value={manifest.invoiceNumber ?? "Pendente"} />
                <Metric label="Minuta" value={manifest.manifestNumber ?? "Pendente"} />
                <Metric label="Caminhao" value={manifest.truckPlate ?? "Nao vinculado"} />
                <Metric label="Doca" value={manifest.dock} />
                <Metric label="Volumes" value={`${formatCompactNumber(manifest.packages)} pacotes`} />
                <Metric label="Peso" value={`${formatCompactNumber(manifest.weightKg)} kg`} />
              </div>

              <p className="mt-4 text-xs text-[color:var(--muted)]">
                Saida prevista em {formatDateTimeShort(manifest.expectedDepartureAt)} • atualizado em {formatDateTimeShort(manifest.updatedAt)}
              </p>
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}

type MetricProps = {
  label: string;
  value: string;
};

function Metric({ label, value }: MetricProps) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[color:var(--panel-strong)] p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-[color:var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

