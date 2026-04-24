import { asDateTime } from "@/lib/client/api";
import type { AuditLogRecord } from "@/lib/client/types";
import type { AuditAction, UserRole } from "@/models/enums";

type AuditTrailProps = {
  logs: AuditLogRecord[];
};

type Actor = { name: string; role: UserRole } | null | undefined;

function getAuditMessage(action: AuditAction, actor: Actor): string {
  const actorName = actor?.name;
  const actorRole = actor?.role;

  switch (action) {
    case "CREATE":
      return `Event draft created${actorName ? ` by ${actorName}` : ""}`;
    case "SUBMIT":
      return `Event submitted for approval${actorName ? ` by ${actorName}` : ""}`;
    case "APPROVE":
      return `Approved${actorName ? ` by ${actorName}` : ""}${actorRole ? ` (${actorRole})` : ""}`;
    case "REQUEST_REVISION":
      return `Revision requested${actorName ? ` by ${actorName}` : ""}${actorRole ? ` (${actorRole})` : ""}`;
    case "UPDATE":
      return `Event details updated${actorName ? ` by ${actorName}` : ""}`;
    default:
      return action;
  }
}

export function AuditTrail({ logs }: AuditTrailProps) {
  return (
    <div className="linear-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Audit Trail</p>
        <span className="text-xs text-[var(--text-muted)]">{logs.length} records</span>
      </div>
      {logs.length === 0 ? (
        <p className="text-sm text-[var(--text-tertiary)]">No audit records yet.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => {
            const actor = log.actorId && typeof log.actorId === "object" && "name" in log.actorId 
              ? log.actorId 
              : null;
            const message = getAuditMessage(log.action, actor);
            return (
              <li key={log._id} className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                  <span className="linear-pill">{log.action}</span>
                  <span>{asDateTime(log.timestamp)}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{message}</p>
                {log.notes && <p className="mt-2 text-xs text-[var(--text-tertiary)]">Note: {log.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}