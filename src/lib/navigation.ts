import type { ProductionAlert, SectorKey } from "@/domain/production/types";

type OrdersRouteParams = {
  orderId?: string;
  orderNumber?: string;
  sector?: SectorKey;
};

type AlertsRouteParams = {
  alertId?: string;
  sector?: SectorKey;
  orderNumber?: string;
};

type SectorsRouteParams = {
  sector?: SectorKey;
  orderId?: string;
};

export function buildOrdersHref(params: OrdersRouteParams = {}) {
  return buildHref("/ordens", {
    orderId: params.orderId,
    orderNumber: params.orderNumber,
    sector: params.sector,
  });
}

export function buildAlertsHref(params: AlertsRouteParams = {}) {
  return buildHref("/alertas", {
    alertId: params.alertId,
    sector: params.sector,
    orderNumber: params.orderNumber,
  });
}

export function buildSectorsHref(params: SectorsRouteParams = {}) {
  return buildHref("/setores", {
    sector: params.sector,
    orderId: params.orderId,
  });
}

export function buildAlertTargetHref(alert: ProductionAlert) {
  if (alert.orderNumber) {
    return buildOrdersHref({
      orderNumber: alert.orderNumber,
      sector: alert.sector === "fabrica" ? undefined : alert.sector,
    });
  }

  return buildSectorsHref({
    sector: alert.sector === "fabrica" ? "costura" : alert.sector,
  });
}

function buildHref(
  pathname: string,
  params: Record<string, string | undefined>,
) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
