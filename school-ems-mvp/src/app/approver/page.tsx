"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/ui/app-shell";
import { EventForm } from "@/components/dashboard/event-form";
import { StatusStepper } from "@/components/dashboard/status-stepper";
import { AuditTrail } from "@/components/dashboard/audit-trail";
import { apiRequest, asCurrency, asDateTime } from "@/lib/client/api";
import type { AuditLogRecord, AuthUser, EventRecord, Organization, Venue } from "@/lib/client/types";

type QueueDetail = {
  event: EventRecord;
  audit: AuditLogRecord[];
};

type EventFormValues = {
  title: string;
  description: string;
  organizationId: string;
  venueId: string;
  startAt: string;
  endAt: string;
  budget: string;
  expectedAttendees: string;
};

const editableStatuses = new Set(["DRAFT", "REVISION_REQUIRED"]);

function isEditableStatus(status?: string): boolean {
  return Boolean(status && editableStatuses.has(status));
}

function mapFormValues(values: EventFormValues) {
  return {
    title: values.title,
    description: values.description,
    organizationId: values.organizationId || undefined,
    venueId: values.venueId || undefined,
    startAt: values.startAt,
    endAt: values.endAt,
    budget: Number(values.budget),
    expectedAttendees: Number(values.expectedAttendees),
  };
}

function organizationLabel(event: EventRecord): string {
  if (typeof event.organizationId === "object") {
    return `${event.organizationId.name} (${event.organizationId.code})`;
  }

  return "-";
}

function venueLabel(event: EventRecord): string {
  if (typeof event.venueId === "object") {
    return `${event.venueId.name} (${event.venueId.location})`;
  }

  return "-";
}

export default function ApproverDashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [queue, setQueue] = useState<EventRecord[]>([]);
  const [myEvents, setMyEvents] = useState<EventRecord[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<"queue" | "mine" | null>(null);
  const [detail, setDetail] = useState<QueueDetail | null>(null);
  const [revisionNotes, setRevisionNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const isCreateMode = searchParams.get("create") === "1";
  const canCreate = me?.role === "ADVISER" || me?.role === "DEAN";
  const canViewMyEvents = me?.role === "STUDENT_LEADER" || me?.role === "ADVISER" || me?.role === "DEAN";

  const selectedEvent = useMemo(() => {
    if (selectedSource === "queue") {
      return queue.find((item) => item._id === selectedId);
    }

    if (selectedSource === "mine") {
      return myEvents.find((item) => item._id === selectedId);
    }

    return undefined;
  }, [myEvents, queue, selectedId, selectedSource]);

  const selectedIsQueue = selectedSource === "queue";
  const selectedIsMine = selectedSource === "mine";

  const loadData = useCallback(async () => {
    try {
      const currentUser = await apiRequest<AuthUser>("/api/me");
      setMe(currentUser);

      const requests: Array<Promise<unknown>> = [
        apiRequest<EventRecord[]>("/api/queues/me"),
        apiRequest<EventRecord[]>("/api/events"),
        apiRequest<Venue[]>("/api/venues"),
      ];

      if (currentUser.role === "ADVISER" || currentUser.role === "DEAN") {
        requests.push(apiRequest<Organization[]>("/api/organizations"));
      }

      const [queueRows, myEventRows, venueRows, orgRows] = (await Promise.all(requests)) as [
        EventRecord[],
        EventRecord[],
        Venue[],
        Organization[]?,
      ];

      setQueue(queueRows);
      setMyEvents(myEventRows);
      setVenues(venueRows.filter((venue) => venue.isActive));
      setOrganizations(orgRows ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (eventId: string) => {
    const response = await apiRequest<QueueDetail>(`/api/events/${eventId}`);
    setDetail(response);
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  useEffect(() => {
    if (isCreateMode) {
      setSelectedId(null);
      setSelectedSource(null);
      setDetail(null);
      return;
    }

    const queueSelection = selectedSource === "queue" && selectedId && queue.some((event) => event._id === selectedId);
    const mineSelection = selectedSource === "mine" && selectedId && myEvents.some((event) => event._id === selectedId);

    if (queueSelection || mineSelection) {
      return;
    }

    if (queue.length > 0) {
      setSelectedSource("queue");
      setSelectedId(queue[0]._id);
      return;
    }

    if (canViewMyEvents && myEvents.length > 0) {
      setSelectedSource("mine");
      setSelectedId(myEvents[0]._id);
      return;
    }

    setSelectedId(null);
    setSelectedSource(null);
    setDetail(null);
  }, [canViewMyEvents, isCreateMode, myEvents, queue, selectedId, selectedSource]);

  useEffect(() => {
    if (!selectedId || isCreateMode) {
      setDetail(null);
      return;
    }

    queueMicrotask(() => {
      void loadDetail(selectedId);
    });
  }, [isCreateMode, loadDetail, selectedId]);

  async function refreshData(nextSelectionId?: string, nextSelectionSource?: "queue" | "mine" | null) {
    await loadData();
    if (nextSelectionId) {
      setSelectedId(nextSelectionId);
      setSelectedSource(nextSelectionSource ?? null);
      await loadDetail(nextSelectionId);
    }
  }

  async function patchSelectedEvent(values: EventFormValues) {
    if (!selectedEvent) return;

    await apiRequest<EventRecord>(`/api/events/${selectedEvent._id}`, {
      method: "PATCH",
      body: JSON.stringify(mapFormValues(values)),
    });
  }

  async function createDraft(values: EventFormValues) {
    setError("");
    setLoading(true);
    try {
      const created = await apiRequest<EventRecord>("/api/events", {
        method: "POST",
        body: JSON.stringify(mapFormValues(values)),
      });

      await refreshData(created._id, "mine");
      router.replace("/approver");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create event");
    } finally {
      setLoading(false);
    }
  }

  async function createAndSubmit(values: EventFormValues) {
    setError("");
    setLoading(true);
    try {
      const created = await apiRequest<EventRecord>("/api/events", {
        method: "POST",
        body: JSON.stringify(mapFormValues(values)),
      });

      await apiRequest(`/api/events/${created._id}/submit`, { method: "POST" });
      await refreshData(created._id, "mine");
      router.replace("/approver");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to submit event");
    } finally {
      setLoading(false);
    }
  }

  async function saveSelectedEvent(values: EventFormValues) {
    if (!selectedEvent) return;
    setError("");
    setLoading(true);
    try {
      await patchSelectedEvent(values);
      await refreshData(selectedEvent._id, selectedSource);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save event");
    } finally {
      setLoading(false);
    }
  }

  async function submitSelectedEvent(values: EventFormValues) {
    if (!selectedEvent) return;
    setError("");
    setLoading(true);
    try {
      await patchSelectedEvent(values);
      await apiRequest(`/api/events/${selectedEvent._id}/submit`, { method: "POST" });
      await refreshData(selectedEvent._id, selectedSource);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit event");
    } finally {
      setLoading(false);
    }
  }

  async function approveSelected() {
    if (!selectedId) return;
    setLoading(true);
    await apiRequest(`/api/events/${selectedId}/approve`, { method: "POST" });
    await loadData();
    if (selectedId) await loadDetail(selectedId).catch(() => undefined);
  }

  async function requestRevision() {
    if (!selectedId) return;
    setLoading(true);
    await apiRequest(`/api/events/${selectedId}/request-revision`, {
      method: "POST",
      body: JSON.stringify({ notes: revisionNotes || undefined }),
    });
    setRevisionNotes("");
    await loadData();
    if (selectedId) await loadDetail(selectedId).catch(() => undefined);
  }

  return (
    <AppShell title="Approver Dashboard" subtitle="Review queue items and track your own event proposals in one place.">
      {error && <p className="mb-4 rounded-md border border-[#ef4444]/50 bg-[#ef4444]/10 px-3 py-2 text-sm text-[#fecaca]">{error}</p>}

      {loading ? (
        <div className="linear-panel p-5 text-sm text-[var(--text-tertiary)]">Loading dashboard...</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[0.9fr,1.1fr]">
          <section className="space-y-4">
            <div className="linear-panel p-5">
              <p className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Pending Queue</p>
              <ul className="space-y-2">
                {queue.map((event) => (
                  <li key={event._id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(event._id);
                        setSelectedSource("queue");
                      }}
                      className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                        selectedSource === "queue" && selectedId === event._id
                          ? "border-[rgba(113,112,255,0.5)] bg-[rgba(113,112,255,0.14)]"
                          : "border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] hover:border-[var(--border-standard)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-1 text-sm font-[510] text-[var(--text-primary)]">{event.title}</p>
                        <span className="linear-pill">{event.status}</span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                        {asDateTime(event.startAt)} | {asCurrency(event.budget)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>

              {queue.length === 0 && (
                <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2 text-sm text-[var(--text-tertiary)]">
                  Queue is clear. No pending proposals for your role.
                </p>
              )}
            </div>

            {canViewMyEvents && (
              <div className="linear-panel p-5">
                <p className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">My Events</p>
                <ul className="space-y-2">
                  {myEvents.map((event) => (
                    <li key={event._id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(event._id);
                          setSelectedSource("mine");
                        }}
                        className={`w-full rounded-md border px-3 py-2.5 text-left transition ${
                          selectedSource === "mine" && selectedId === event._id
                            ? "border-[rgba(113,112,255,0.5)] bg-[rgba(113,112,255,0.14)]"
                            : "border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] hover:border-[var(--border-standard)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="line-clamp-1 text-sm font-[510] text-[var(--text-primary)]">{event.title}</p>
                          <span className="linear-pill">{event.status}</span>
                        </div>
                        <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">{organizationLabel(event)}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">Submitted: {asDateTime(event.submittedAt)}</p>
                      </button>
                    </li>
                  ))}
                </ul>

                {myEvents.length === 0 && (
                  <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2 text-sm text-[var(--text-tertiary)]">
                    You have not created any events yet.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="space-y-4">
            {isCreateMode && canCreate && (
              <EventForm
                key="approver-create"
                venues={venues}
                organizations={organizations}
                requireOrganization
                onSave={createDraft}
                onSubmit={createAndSubmit}
              />
            )}

            {!isCreateMode && selectedEvent && isEditableStatus(selectedEvent.status) && selectedIsMine && (
              <EventForm
                key={selectedEvent._id}
                venues={venues}
                organizations={organizations}
                requireOrganization
                initialEvent={selectedEvent}
                onSave={saveSelectedEvent}
                onSubmit={submitSelectedEvent}
              />
            )}

            {!isCreateMode && selectedEvent && (!selectedIsMine || !isEditableStatus(selectedEvent.status)) && (
              <div className="linear-panel p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Event Details</p>
                    <h2 className="mt-2 text-lg font-[510] tracking-[-0.24px] text-[var(--text-primary)]">{selectedEvent.title}</h2>
                  </div>
                  <span className="linear-pill">{selectedEvent.status}</span>
                </div>

                <p className="mt-3 text-sm text-[var(--text-tertiary)]">{selectedEvent.description}</p>

                <dl className="mt-4 grid gap-3 text-xs text-[var(--text-tertiary)] md:grid-cols-2">
                  <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Organization</dt>
                    <dd className="mt-1 text-sm text-[var(--text-secondary)]">{organizationLabel(selectedEvent)}</dd>
                  </div>
                  <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Venue</dt>
                    <dd className="mt-1 text-sm text-[var(--text-secondary)]">{venueLabel(selectedEvent)}</dd>
                  </div>
                  <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Start</dt>
                    <dd className="mt-1 text-sm text-[var(--text-secondary)]">{asDateTime(selectedEvent.startAt)}</dd>
                  </div>
                  <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">End</dt>
                    <dd className="mt-1 text-sm text-[var(--text-secondary)]">{asDateTime(selectedEvent.endAt)}</dd>
                  </div>
                  <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Budget</dt>
                    <dd className="mt-1 text-sm text-[var(--text-secondary)]">{asCurrency(selectedEvent.budget)}</dd>
                  </div>
                  <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2">
                    <dt className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Expected Attendees</dt>
                    <dd className="mt-1 text-sm text-[var(--text-secondary)]">{selectedEvent.expectedAttendees}</dd>
                  </div>
                </dl>

                {detail?.event.revisionNotes && (
                  <div className="mt-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-muted)]">Revision Notes</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{detail.event.revisionNotes}</p>
                  </div>
                )}
              </div>
            )}

            {!isCreateMode && <StatusStepper status={detail?.event.status ?? selectedEvent?.status ?? "DRAFT"} />}

            {!isCreateMode && selectedIsQueue && (
              <div className="linear-panel p-5">
                <p className="mb-2 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Approval Actions</p>
                <textarea
                  className="linear-input min-h-24"
                  placeholder="Optional revision notes"
                  value={revisionNotes}
                  onChange={(event) => setRevisionNotes(event.target.value)}
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" className="linear-btn linear-btn-primary" onClick={approveSelected} disabled={!selectedId}>
                    Approve Stage
                  </button>
                  <button type="button" className="linear-btn" onClick={requestRevision} disabled={!selectedId}>
                    Request Revision
                  </button>
                </div>
              </div>
            )}

            {!isCreateMode && <AuditTrail logs={detail?.audit ?? []} />}
          </section>
        </div>
      )}
    </AppShell>
  );
}
