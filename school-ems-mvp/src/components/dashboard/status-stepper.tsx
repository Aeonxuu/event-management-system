import type { EventStatus } from "@/lib/client/types";

type StatusStepperProps = {
  status: EventStatus;
};

const steps: { label: string; status: EventStatus }[] = [
  { label: "Draft", status: "DRAFT" },
  { label: "Adviser", status: "PENDING_ADVISER" },
  { label: "Dean", status: "PENDING_DEAN" },
  { label: "Facilities", status: "PENDING_FACILITIES" },
  { label: "OSA", status: "PENDING_OSA" },
  { label: "Approved", status: "APPROVED" },
];

function statusRank(status: EventStatus): number {
  if (status === "REVISION_REQUIRED") return 0;
  return steps.findIndex((step) => step.status === status);
}

export function StatusStepper({ status }: StatusStepperProps) {
  const current = statusRank(status);

  return (
    <div className="linear-panel border-[rgba(113,112,255,0.26)] bg-[linear-gradient(180deg,rgba(113,112,255,0.14),rgba(113,112,255,0.03))] p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-[510] uppercase tracking-[0.1em] text-[var(--text-muted)]">Proposal Progress</p>
        <span className="linear-pill">{status.replaceAll("_", " ")}</span>
      </div>
      <ol className="grid grid-cols-2 gap-2.5 md:grid-cols-6">
        {steps.map((step, index) => {
          const done = index <= current;
          return (
            <li
              key={step.status}
              className={`rounded-md border px-2 py-2.5 text-center text-[11px] font-[510] tracking-[0.01em] transition ${
                done
                  ? "border-[rgba(113,112,255,0.62)] bg-[rgba(113,112,255,0.22)] text-[var(--text-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] text-[var(--text-muted)]"
              }`}
            >
              {step.label}
            </li>
          );
        })}
      </ol>
      {status === "REVISION_REQUIRED" && (
        <p className="mt-3 text-xs text-[var(--text-tertiary)]">
          Revision required. Update the draft and resubmit to restart the approval sequence.
        </p>
      )}
    </div>
  );
}
