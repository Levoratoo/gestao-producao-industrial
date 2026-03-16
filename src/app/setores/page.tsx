import { Suspense } from "react";
import { SectorsView } from "@/components/sectors/sectors-view";

export default function SectorsPage() {
  return (
    <Suspense fallback={null}>
      <SectorsView />
    </Suspense>
  );
}
