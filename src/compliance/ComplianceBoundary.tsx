import type { ReactNode } from "react";
import { BlockedView } from "./BlockedView";
import { ComplianceGate } from "./ComplianceGate";
import { useComplianceStore } from "./store";

export function ComplianceBoundary({ children }: { children: ReactNode }) {
  const blocked = useComplianceStore((state) => state.blocked);
  const gateOpen = useComplianceStore((state) => state.gateOpen);
  if (blocked) return <BlockedView />;
  return (
    <>
      <div inert={gateOpen} style={{ display: "contents" }}>{children}</div>
      {gateOpen && <ComplianceGate />}
    </>
  );
}
