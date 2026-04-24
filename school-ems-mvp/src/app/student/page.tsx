"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { EventForm } from "@/components/dashboard/event-form";
import { StatusStepper } from "@/components/dashboard/status-stepper";
import { AuditTrail } from "@/components/dashboard/audit-trail";
import { apiRequest, asCurrency, asDateTime } from "@/lib/client/api";
import type { AuditLogRecord, AuthUser, EventRecord, Venue } from "@/lib/client/types";

type EventDetailResponse = {
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

function isSmokeEvent(event: EventRecord): boolean {
  const title = event.title?.toLowerCase() ?? "";
  const description = event.description?.toLowerCase() ?? "";
  return title.startsWith("smoke event") || description.includes("automated smoke-test proposal");
}

function isSmokeVenue(venue: Venue): boolean {
  const name = venue.name?.toLowerCase() ?? "";
  const notes = venue.notes?.toLowerCase() ?? "";
  return /^main hall\s/.test(name) || notes.includes("smoke test");
}

export default function StudentDashboardPage() {
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [canManageEvents, setCanManageEvents] = useState(false);
  const [detail, setDetail] = useState<EventDetailResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) return undefined;
    return events.find((event) => event._id === selectedEventId);
  }, [events, selectedEventId]);

  const loadBase = useCallback(async () => {
    try {
      const [eventRows, venueRows, me] = await Promise.all([
        apiRequest<EventRecord[]>("/api/events"),
        apiRequest<Venue[]>("/api/venues"),
        apiRequest<AuthUser>("/api/me"),
      ]);

      setEvents(eventRows.filter((event) => !isSmokeEvent(event)));
      setVenues(venueRows.filter((venue) => venue.isActive && !isSmokeVenue(venue)));
      setCanManageEvents(me.role === "STUDENT_LEADER");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (eventId: string) => {
    try {
      const response = await apiRequest<EventDetailResponse>(`/api/events/${eventId}`);
      setDetail(response);
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "Failed to load event detail");
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadBase();
    });
  }, [loadBase]);

  useEffect(() => {
    queueMicrotask(() => {
      if (!selectedEventId) {
        setDetail(null);
        return;
      }
      if (isCreating) {
        setDetail(null);
        return;
      }
      void loadDetail(selectedEventId);
    });
  }, [isCreating, loadDetail, selectedEventId]);

  useEffect(() => {
    if (events.length === 0) {
      setSelectedEventId(null);
      return;
    }

    if (isCreating) {
      return;
    }

    setSelectedEventId((current) => {
      if (current && events.some((event) => event._id === current)) {
        return current;
      }
      return events[0]._id;
    });
  }, [events, isCreating]);

  async function handleSave(values: EventFormValues) {
    setError("");
    setLoading(true);

    try {
      if (isCreating || !selectedEventId) {
        const created = await apiRequest<EventRecord>("/api/events", {
          method: "POST",
          body: JSON.stringify(mapFormValues(values)),
        });

        setIsCreating(false);
        setSelectedEventId(created._id);
        await loadBase();
        await loadDetail(created._id);
        return;
      }

      await apiRequest<EventRecord>(`/api/events/${selectedEventId}`, {
        method: "PATCH",
        body: JSON.stringify(mapFormValues(values)),
      });

      await loadBase();
      await loadDetail(selectedEventId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save event");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(values: EventFormValues) {
    setError("");
    setLoading(true);

    try {
      if (isCreating || !selectedEventId) {
        const created = await apiRequest<EventRecord>("/api/events", {
          method: "POST",
          body: JSON.stringify(mapFormValues(values)),
        });

        await apiRequest<EventRecord>(`/api/events/${created._id}/submit`, { method: "POST" });
        setIsCreating(false);
        setSelectedEventId(created._id);
        await loadBase();
        await loadDetail(created._id);
        return;
      }

      await apiRequest<EventRecord>(`/api/events/${selectedEventId}/submit`, { method: "POST" });
      await loadBase();
      await loadDetail(selectedEventId);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to submit event");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell
      title="Student Dashboard"
      subtitle="Create, revise, and submit event proposals. Track each approval stage and audit timeline."
    >
      {error && <p className="mb-4 rounded-md border border-[#ef4444]/50 bg-[#ef4444]/10 px-3 py-2 text-sm text-[#fecaca]">{error}</p>}

      {loading ? (
        <div className="linear-panel p-5 text-sm text-[var(--text-tertiary)]">Loading dashboard...</div>
      ) : (
        <div id="events" className="grid gap-4 lg:grid-cols-[360px,1fr]">
          <section className="linear-panel p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">My Events</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{events.length} total</p>
              </div>
              <button
                type="button"
                className="linear-btn linear-btn-primary"
                disabled={!canManageEvents}
                onClick={() => {
                  if (!canManageEvents) return;
                  setIsCreating(true);
                  setSelectedEventId(null);
                  setDetail(null);
                }}
              >
                Create New Event
              </button>
            </div>

            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event._id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreating(false);
                      setSelectedEventId(event._id);
                    }}
                    className={`w-full rounded-md border px-3 py-3 text-left transition ${
                      selectedEventId === event._id
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

              {events.length === 0 && (
                <li className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] p-3 text-sm text-[var(--text-tertiary)]">
                  No events yet. Create your first event.
                </li>
              )}
            </ul>
          </section>

          <section className="space-y-4">
            {isCreating || selectedEventId || events.length === 0 ? (
              <>
                <EventForm
                  key={isCreating ? "new-event" : selectedEvent?._id ?? "new-event"}
                  venues={venues}
                  initialEvent={isCreating ? undefined : selectedEvent}
                  disabled={!canManageEvents}
                  onSave={handleSave}
                  onSubmit={
                    canManageEvents &&
                    (isCreating || (selectedEventId && ["DRAFT", "REVISION_REQUIRED"].includes(selectedEvent?.status ?? "")))
                      ? handleSubmit
                      : undefined
                  }
                />

                <StatusStepper status={isCreating ? "DRAFT" : detail?.event.status ?? selectedEvent?.status ?? "DRAFT"} />

                {!isCreating && detail?.event.revisionNotes && (
                  <div className="linear-panel p-5">
                    <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Revision Notes</p>
                    <p className="mt-2 text-sm text-[var(--text-tertiary)]">{detail.event.revisionNotes}</p>
                  </div>
                )}

                <AuditTrail logs={isCreating ? [] : detail?.audit ?? []} />
              </>
            ) : (
              <div className="linear-panel p-8 text-center">
                <p className="text-sm text-[var(--text-tertiary)]">Select an event to view details or create a new event.</p>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
