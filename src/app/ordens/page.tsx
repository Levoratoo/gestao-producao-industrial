import { Suspense } from "react";
import { OrdersView } from "@/components/orders/orders-view";

export default function OrdersPage() {
  return (
    <Suspense fallback={null}>
      <OrdersView />
    </Suspense>
  );
}
