"use client";

import { useMemo, useState } from "react";
import type { EventRecord, Organization, Venue } from "@/lib/client/types";

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

type EventFormProps = {
  venues: Venue[];
  organizations?: Organization[];
  requireOrganization?: boolean;
  initialEvent?: EventRecord;
  disabled?: boolean;
  onSave: (values: EventFormValues) => Promise<void>;
  onSubmit?: (values: EventFormValues) => Promise<void>;
};

type FormErrors = Partial<Record<keyof EventFormValues, string>>;

const emptyValues: EventFormValues = {
  title: "",
  description: "",
  organizationId: "",
  venueId: "",
  startAt: "",
  endAt: "",
  budget: "0",
  expectedAttendees: "1",
};

function toInputDate(value?: string): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

export function EventForm({ organizations, requireOrganization, venues, initialEvent, disabled, onSave, onSubmit }: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>(() => {
    if (!initialEvent) return emptyValues;

    return {
      title: initialEvent.title ?? "",
      description: initialEvent.description ?? "",
      organizationId:
        typeof initialEvent.organizationId === "object"
          ? initialEvent.organizationId?._id ?? ""
          : initialEvent.organizationId ?? "",
      venueId:
        typeof initialEvent.venueId === "object" ? initialEvent.venueId?._id ?? "" : initialEvent.venueId ?? "",
      startAt: toInputDate(initialEvent.startAt),
      endAt: toInputDate(initialEvent.endAt),
      budget: String(initialEvent.budget ?? 0),
      expectedAttendees: String(initialEvent.expectedAttendees ?? 1),
    };
  });
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  const editableByStatus = !initialEvent || ["DRAFT", "REVISION_REQUIRED"].includes(initialEvent.status);
  const editable = !disabled && editableByStatus;

  const canShowSubmit = editable && Boolean(onSubmit);

  const canSubmit = useMemo(() => {
    return (
      canShowSubmit &&
      !!values.title.trim() &&
      !!values.description.trim() &&
      !!values.venueId &&
      !!values.startAt &&
      !!values.endAt
    );
  }, [canShowSubmit, values]);

  function validateForm(): FormErrors {
    const nextErrors: FormErrors = {};

    const title = values.title.trim();
    const description = values.description.trim();

    if (!title) {
      nextErrors.title = "Title is required.";
    } else if (title.length < 3) {
      nextErrors.title = "Title must be at least 3 characters.";
    }

    if (!description) {
      nextErrors.description = "Description is required.";
    } else if (description.length < 10) {
      nextErrors.description = "Description must be at least 10 characters.";
    }
    if (requireOrganization && !values.organizationId) nextErrors.organizationId = "Organization is required.";
    if (!values.venueId) nextErrors.venueId = "Venue is required.";
    if (!values.startAt) nextErrors.startAt = "Start date is required.";
    if (!values.endAt) nextErrors.endAt = "End date is required.";

    if (values.startAt && values.endAt) {
      const start = new Date(values.startAt);
      const end = new Date(values.endAt);
      if (!(end > start)) {
        nextErrors.endAt = "End date must be after start date.";
      }
    }

    if (Number(values.budget) < 0) nextErrors.budget = "Budget must be non-negative.";
    if (!Number.isInteger(Number(values.expectedAttendees)) || Number(values.expectedAttendees) < 1) {
      nextErrors.expectedAttendees = "Expected attendees must be at least 1.";
    }

    return nextErrors;
  }

  async function handleSave() {
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSaving(true);
    try {
      await onSave(values);
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit() {
    if (!onSubmit) return;
    const nextErrors = validateForm();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="linear-panel p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Event Details</p>
        <div className="flex gap-2">
          <button className="linear-btn" disabled={!editable || saving} onClick={handleSave} type="button">
            {saving ? "Saving..." : "Save as Draft"}
          </button>
          {canShowSubmit && (
            <button
              className="linear-btn linear-btn-primary"
              disabled={!canSubmit || submitting || !onSubmit}
              onClick={handleSubmit}
              type="button"
            >
              {submitting ? "Submitting..." : "Submit for Approval"}
            </button>
          )}
        </div>
      </div>

      {!editable && (
        <p className="mb-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2 text-xs text-[var(--text-muted)]">
          This event is read-only until it returns to Draft or Revision Required.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm text-[var(--text-secondary)]">
          Title
          <input
            className={`linear-input mt-1 ${errors.title ? "border-[#ef4444]" : ""}`}
            disabled={!editable}
            value={values.title}
            onChange={(event) => {
              setValues((prev) => ({ ...prev, title: event.target.value }));
              setErrors((prev) => ({ ...prev, title: undefined }));
            }}
          />
          {errors.title && <p className="mt-1 text-xs text-[#fda4af]">{errors.title}</p>}
        </label>

        {requireOrganization && (
          <label className="text-sm text-[var(--text-secondary)]">
            Organization
            <select
              className={`linear-input mt-1 ${errors.organizationId ? "border-[#ef4444]" : ""}`}
              disabled={!editable}
              style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", colorScheme: "dark" }}
              value={values.organizationId}
              onChange={(event) => {
                setValues((prev) => ({ ...prev, organizationId: event.target.value }));
                setErrors((prev) => ({ ...prev, organizationId: undefined }));
              }}
            >
              <option style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }} value="">
                Select organization
              </option>
              {(organizations ?? []).map((organization) => (
                <option
                  key={organization._id}
                  style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}
                  value={organization._id}
                >
                  {organization.name} ({organization.code})
                </option>
              ))}
            </select>
            {errors.organizationId && <p className="mt-1 text-xs text-[#fda4af]">{errors.organizationId}</p>}
          </label>
        )}

        <label className="text-sm text-[var(--text-secondary)]">
          Venue
          <select
            className={`linear-input mt-1 ${errors.venueId ? "border-[#ef4444]" : ""}`}
            disabled={!editable}
            style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", colorScheme: "dark" }}
            value={values.venueId}
            onChange={(event) => {
              setValues((prev) => ({ ...prev, venueId: event.target.value }));
              setErrors((prev) => ({ ...prev, venueId: undefined }));
            }}
          >
            <option style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }} value="">
              Select venue
            </option>
            {venues.map((venue) => (
              <option
                key={venue._id}
                style={{ backgroundColor: "var(--bg-panel)", color: "var(--text-primary)" }}
                value={venue._id}
              >
                {venue.name} ({venue.location})
              </option>
            ))}
          </select>
          {errors.venueId && <p className="mt-1 text-xs text-[#fda4af]">{errors.venueId}</p>}
        </label>
      </div>

      <label className="mt-3 block text-sm text-[var(--text-secondary)]">
        Description
        <textarea
          className={`linear-input mt-1 min-h-28 ${errors.description ? "border-[#ef4444]" : ""}`}
          disabled={!editable}
          value={values.description}
          onChange={(event) => {
            setValues((prev) => ({ ...prev, description: event.target.value }));
            setErrors((prev) => ({ ...prev, description: undefined }));
          }}
        />
        {errors.description && <p className="mt-1 text-xs text-[#fda4af]">{errors.description}</p>}
      </label>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <label className="text-sm text-[var(--text-secondary)]">
          Start
          <input
            className={`linear-input mt-1 ${errors.startAt ? "border-[#ef4444]" : ""}`}
            disabled={!editable}
            type="datetime-local"
            value={values.startAt}
            onChange={(event) => {
              setValues((prev) => ({ ...prev, startAt: event.target.value }));
              setErrors((prev) => ({ ...prev, startAt: undefined }));
            }}
          />
          {errors.startAt && <p className="mt-1 text-xs text-[#fda4af]">{errors.startAt}</p>}
        </label>
        <label className="text-sm text-[var(--text-secondary)]">
          End
          <input
            className={`linear-input mt-1 ${errors.endAt ? "border-[#ef4444]" : ""}`}
            disabled={!editable}
            type="datetime-local"
            value={values.endAt}
            onChange={(event) => {
              setValues((prev) => ({ ...prev, endAt: event.target.value }));
              setErrors((prev) => ({ ...prev, endAt: undefined }));
            }}
          />
          {errors.endAt && <p className="mt-1 text-xs text-[#fda4af]">{errors.endAt}</p>}
        </label>
        <label className="text-sm text-[var(--text-secondary)]">
          Budget
          <input
            className={`linear-input mt-1 ${errors.budget ? "border-[#ef4444]" : ""}`}
            disabled={!editable}
            min="0"
            type="number"
            value={values.budget}
            onChange={(event) => {
              setValues((prev) => ({ ...prev, budget: event.target.value }));
              setErrors((prev) => ({ ...prev, budget: undefined }));
            }}
          />
          {errors.budget && <p className="mt-1 text-xs text-[#fda4af]">{errors.budget}</p>}
        </label>
        <label className="text-sm text-[var(--text-secondary)]">
          Expected Attendees
          <input
            className={`linear-input mt-1 ${errors.expectedAttendees ? "border-[#ef4444]" : ""}`}
            disabled={!editable}
            min="1"
            type="number"
            value={values.expectedAttendees}
            onChange={(event) => {
              setValues((prev) => ({ ...prev, expectedAttendees: event.target.value }));
              setErrors((prev) => ({ ...prev, expectedAttendees: undefined }));
            }}
          />
          {errors.expectedAttendees && <p className="mt-1 text-xs text-[#fda4af]">{errors.expectedAttendees}</p>}
        </label>
      </div>
    </div>
  );
}
