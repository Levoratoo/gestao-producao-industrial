import { Suspense } from "react";
import { FlowProcessView } from "@/components/flow/flow-process-view";

export default function FlowPage() {
  return (
    <Suspense fallback={null}>
      <FlowProcessView />
    </Suspense>
  );
}
