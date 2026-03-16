import { Suspense } from "react";
import { AlertsView } from "@/components/alerts/alerts-view";

export default function AlertsPage() {
  return (
    <Suspense fallback={null}>
      <AlertsView />
    </Suspense>
  );
}
