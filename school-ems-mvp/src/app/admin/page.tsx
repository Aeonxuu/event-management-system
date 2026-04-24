"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/ui/app-shell";
import { apiRequest, asCurrency, asDateTime } from "@/lib/client/api";
import type { AdminUserRecord, EventRecord, Organization, UserRole, Venue } from "@/lib/client/types";

type AdminEventResponse = {
  data?: EventRecord[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type UserForm = {
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  isActive: boolean;
};

type OrganizationForm = {
  name: string;
  code: string;
  description: string;
};

type PasswordForm = {
  userId: string;
  userLabel: string;
  newPassword: string;
  confirmPassword: string;
};

const roleOptions: UserRole[] = ["STUDENT_LEADER", "ADVISER", "DEAN", "FACILITIES", "OSA", "ADMIN"];

type VenueForm = {
  name: string;
  location: string;
  capacity: string;
  notes: string;
};

const emptyVenue: VenueForm = {
  name: "",
  location: "",
  capacity: "1",
  notes: "",
};

const emptyUserForm: UserForm = {
  name: "",
  email: "",
  role: "STUDENT_LEADER",
  organizationId: "",
  isActive: true,
};

const emptyOrganizationForm: OrganizationForm = {
  name: "",
  code: "",
  description: "",
};

export default function AdminDashboardPage() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [events, setEvents] = useState<EventRecord[] | null>(null);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [venueForm, setVenueForm] = useState<VenueForm>(emptyVenue);
  const [accountForm, setAccountForm] = useState<UserForm>(emptyUserForm);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserForm, setEditingUserForm] = useState<UserForm>(emptyUserForm);
  const [organizationForm, setOrganizationForm] = useState<OrganizationForm>(emptyOrganizationForm);
  const [editingOrganizationId, setEditingOrganizationId] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordForm | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [venueRows, eventRows, userRows, orgRows] = await Promise.all([
        apiRequest<Venue[]>("/api/venues"),
        apiRequest<EventRecord[] | AdminEventResponse>("/api/admin/events?page=1&limit=20"),
        apiRequest<AdminUserRecord[]>("/api/admin/users"),
        apiRequest<Organization[]>("/api/admin/organizations"),
      ]);

      setVenues(venueRows);
      setUsers(userRows);
      setOrganizations(orgRows);
      if (Array.isArray(eventRows)) {
        setEvents(eventRows);
      } else {
        setEvents(Array.isArray(eventRows?.data) ? eventRows.data : []);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin data");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void loadData();
    });
  }, [loadData]);

  async function createVenue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    await apiRequest<Venue>("/api/venues", {
      method: "POST",
      body: JSON.stringify({
        name: venueForm.name,
        location: venueForm.location,
        capacity: Number(venueForm.capacity),
        notes: venueForm.notes || undefined,
      }),
    });
    setVenueForm(emptyVenue);
    setNotice("Venue created.");
    await loadData();
  }

  async function deactivateVenue(venueId: string) {
    setLoading(true);
    setError("");
    setNotice("");
    await apiRequest(`/api/venues/${venueId}`, { method: "DELETE" });
    setNotice("Venue updated.");
    await loadData();
  }

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    await apiRequest<AdminUserRecord>("/api/admin/users", {
      method: "POST",
      body: JSON.stringify({
        name: accountForm.name,
        email: accountForm.email,
        role: accountForm.role,
        organizationId: accountForm.role === "STUDENT_LEADER" ? accountForm.organizationId : undefined,
        isActive: accountForm.isActive,
      }),
    });

    setAccountForm(emptyUserForm);
    setNotice("Account created. Default password is demo123.");
    await loadData();
  }

  function startEditUser(user: AdminUserRecord) {
    setEditingUserId(user._id);
    setEditingUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: typeof user.organizationId === "object" ? user.organizationId?._id ?? "" : user.organizationId ?? "",
      isActive: Boolean(user.isActive),
    });
  }

  async function saveUserEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUserId) return;

    setLoading(true);
    setError("");
    setNotice("");

    await apiRequest<AdminUserRecord>(`/api/admin/users/${editingUserId}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: editingUserForm.name,
        email: editingUserForm.email,
        role: editingUserForm.role,
        organizationId: editingUserForm.role === "STUDENT_LEADER" ? editingUserForm.organizationId : null,
        isActive: editingUserForm.isActive,
      }),
    });

    setEditingUserId(null);
    setEditingUserForm(emptyUserForm);
    setNotice("User updated.");
    await loadData();
  }

  function openPasswordDialog(user: AdminUserRecord) {
    setPasswordForm({
      userId: user._id,
      userLabel: `${user.name} (${user.email})`,
      newPassword: "",
      confirmPassword: "",
    });
  }

  async function submitPasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordForm) return;

    setLoading(true);
    setError("");
    setNotice("");

    await apiRequest(`/api/admin/users/${passwordForm.userId}/password`, {
      method: "PATCH",
      body: JSON.stringify({
        newPassword: passwordForm.newPassword,
        confirmPassword: passwordForm.confirmPassword,
      }),
    });

    setPasswordForm(null);
    setNotice("Password updated successfully.");
    setLoading(false);
  }

  async function saveOrganization(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");

    if (editingOrganizationId) {
      await apiRequest(`/api/admin/organizations/${editingOrganizationId}`, {
        method: "PATCH",
        body: JSON.stringify(organizationForm),
      });
      setNotice("Organization updated.");
    } else {
      await apiRequest("/api/admin/organizations", {
        method: "POST",
        body: JSON.stringify(organizationForm),
      });
      setNotice("Organization created.");
    }

    setOrganizationForm(emptyOrganizationForm);
    setEditingOrganizationId(null);
    await loadData();
  }

  function startEditOrganization(organization: Organization) {
    setEditingOrganizationId(organization._id);
    setOrganizationForm({
      name: organization.name,
      code: organization.code,
      description: organization.description ?? "",
    });
  }

  async function deleteOrganization(organizationId: string) {
    setLoading(true);
    setError("");
    setNotice("");
    await apiRequest(`/api/admin/organizations/${organizationId}`, {
      method: "DELETE",
    });
    setNotice("Organization deleted.");
    await loadData();
  }

  function organizationName(value?: Organization | string): string {
    if (!value) return "-";
    if (typeof value === "object") {
      return `${value.name} (${value.code})`;
    }

    const match = organizations.find((organization) => organization._id === value);
    if (!match) return "-";
    return `${match.name} (${match.code})`;
  }

  if (!events) {
    return <div>Loading...</div>;
  }

  return (
    <AppShell
      title="Admin Dashboard"
      subtitle="Manage users, organizations, and venues, then inspect the complete event archive."
    >
      {notice && <p className="mb-4 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{notice}</p>}
      {error && <p className="mb-4 rounded-md border border-[#ef4444]/50 bg-[#ef4444]/10 px-3 py-2 text-sm text-[#fecaca]">{error}</p>}

      {loading ? (
        <div className="linear-panel p-5 text-sm text-[var(--text-tertiary)]">Loading admin dashboard...</div>
      ) : (
        <div className="space-y-4">
          <section className="linear-panel p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Create Account</p>
            <form className="grid gap-3 md:grid-cols-5" onSubmit={createAccount}>
              <input
                className="linear-input"
                placeholder="Full name"
                value={accountForm.name}
                onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <input
                className="linear-input"
                placeholder="Email"
                type="email"
                value={accountForm.email}
                onChange={(event) => setAccountForm((prev) => ({ ...prev, email: event.target.value }))}
                required
              />
              <select
                className="linear-input"
                style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", colorScheme: "dark" }}
                value={accountForm.role}
                onChange={(event) =>
                  setAccountForm((prev) => ({
                    ...prev,
                    role: event.target.value as UserRole,
                    organizationId: event.target.value === "STUDENT_LEADER" ? prev.organizationId : "",
                  }))
                }
              >
                {roleOptions.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
              <select
                className="linear-input"
                style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", colorScheme: "dark" }}
                value={accountForm.organizationId}
                disabled={accountForm.role !== "STUDENT_LEADER"}
                onChange={(event) => setAccountForm((prev) => ({ ...prev, organizationId: event.target.value }))}
                required={accountForm.role === "STUDENT_LEADER"}
              >
                <option value="">Select organization</option>
                {organizations.map((organization) => (
                  <option key={organization._id} value={organization._id}>
                    {organization.name} ({organization.code})
                  </option>
                ))}
              </select>
              <button className="linear-btn linear-btn-primary" type="submit">
                Create Account
              </button>
            </form>
            <p className="mt-2 text-xs text-[var(--text-muted)]">New accounts use default password: demo123</p>
          </section>

          <section className="linear-panel p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Manage Users</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Email</th>
                    <th className="px-2 py-2">Role</th>
                    <th className="px-2 py-2">Organization</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id} className="border-t border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      <td className="px-2 py-2">{user.name}</td>
                      <td className="px-2 py-2">{user.email}</td>
                      <td className="px-2 py-2">{user.role}</td>
                      <td className="px-2 py-2">{organizationName(user.organizationId)}</td>
                      <td className="px-2 py-2">{user.isActive ? "Active" : "Inactive"}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button className="linear-btn" type="button" onClick={() => startEditUser(user)}>
                            Edit
                          </button>
                          <button className="linear-btn" type="button" onClick={() => openPasswordDialog(user)}>
                            Change Password
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {editingUserId && (
              <form className="mt-4 grid gap-3 rounded-md border border-[var(--border-subtle)] p-3 md:grid-cols-6" onSubmit={saveUserEdit}>
                <input
                  className="linear-input"
                  value={editingUserForm.name}
                  onChange={(event) => setEditingUserForm((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
                <input
                  className="linear-input"
                  type="email"
                  value={editingUserForm.email}
                  onChange={(event) => setEditingUserForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
                <select
                  className="linear-input"
                  style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", colorScheme: "dark" }}
                  value={editingUserForm.role}
                  onChange={(event) =>
                    setEditingUserForm((prev) => ({
                      ...prev,
                      role: event.target.value as UserRole,
                      organizationId: event.target.value === "STUDENT_LEADER" ? prev.organizationId : "",
                    }))
                  }
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                <select
                  className="linear-input"
                  style={{ backgroundColor: "var(--bg-surface)", color: "var(--text-primary)", colorScheme: "dark" }}
                  value={editingUserForm.organizationId}
                  disabled={editingUserForm.role !== "STUDENT_LEADER"}
                  onChange={(event) => setEditingUserForm((prev) => ({ ...prev, organizationId: event.target.value }))}
                  required={editingUserForm.role === "STUDENT_LEADER"}
                >
                  <option value="">Select organization</option>
                  {organizations.map((organization) => (
                    <option key={organization._id} value={organization._id}>
                      {organization.name} ({organization.code})
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <input
                    type="checkbox"
                    checked={editingUserForm.isActive}
                    onChange={(event) => setEditingUserForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                  />
                  Active
                </label>
                <div className="flex gap-2">
                  <button className="linear-btn linear-btn-primary" type="submit">
                    Save
                  </button>
                  <button
                    className="linear-btn"
                    type="button"
                    onClick={() => {
                      setEditingUserId(null);
                      setEditingUserForm(emptyUserForm);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>

          <section className="linear-panel p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Manage Organizations</p>
            <form className="grid gap-3 md:grid-cols-4" onSubmit={saveOrganization}>
              <input
                className="linear-input"
                placeholder="Organization name"
                value={organizationForm.name}
                onChange={(event) => setOrganizationForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <input
                className="linear-input"
                placeholder="Code"
                value={organizationForm.code}
                onChange={(event) => setOrganizationForm((prev) => ({ ...prev, code: event.target.value }))}
                required
              />
              <input
                className="linear-input"
                placeholder="Description"
                value={organizationForm.description}
                onChange={(event) => setOrganizationForm((prev) => ({ ...prev, description: event.target.value }))}
              />
              <div className="flex gap-2">
                <button className="linear-btn linear-btn-primary" type="submit">
                  {editingOrganizationId ? "Update Organization" : "Create Organization"}
                </button>
                {editingOrganizationId && (
                  <button
                    className="linear-btn"
                    type="button"
                    onClick={() => {
                      setEditingOrganizationId(null);
                      setOrganizationForm(emptyOrganizationForm);
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Code</th>
                    <th className="px-2 py-2">Description</th>
                    <th className="px-2 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {organizations.map((organization) => (
                    <tr key={organization._id} className="border-t border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      <td className="px-2 py-2">{organization.name}</td>
                      <td className="px-2 py-2">{organization.code}</td>
                      <td className="px-2 py-2">{organization.description || "-"}</td>
                      <td className="px-2 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button className="linear-btn" type="button" onClick={() => startEditOrganization(organization)}>
                            Edit
                          </button>
                          <button className="linear-btn" type="button" onClick={() => deleteOrganization(organization._id)}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="linear-panel p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Create Venue</p>
            <form className="grid gap-3 md:grid-cols-4" onSubmit={createVenue}>
              <input
                className="linear-input"
                placeholder="Venue name"
                value={venueForm.name}
                onChange={(event) => setVenueForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <input
                className="linear-input"
                placeholder="Location"
                value={venueForm.location}
                onChange={(event) => setVenueForm((prev) => ({ ...prev, location: event.target.value }))}
                required
              />
              <input
                className="linear-input"
                placeholder="Capacity"
                min={1}
                type="number"
                value={venueForm.capacity}
                onChange={(event) => setVenueForm((prev) => ({ ...prev, capacity: event.target.value }))}
                required
              />
              <button className="linear-btn linear-btn-primary" type="submit">
                Add Venue
              </button>
            </form>
            <textarea
              className="linear-input mt-3"
              placeholder="Optional venue notes"
              value={venueForm.notes}
              onChange={(event) => setVenueForm((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </section>

          <section className="linear-panel p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">Venue Management</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Location</th>
                    <th className="px-2 py-2">Capacity</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {venues.map((venue) => (
                    <tr key={venue._id} className="border-t border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      <td className="px-2 py-2">{venue.name}</td>
                      <td className="px-2 py-2">{venue.location}</td>
                      <td className="px-2 py-2">{venue.capacity}</td>
                      <td className="px-2 py-2">{venue.isActive ? "Active" : "Inactive"}</td>
                      <td className="px-2 py-2">
                        <button type="button" className="linear-btn" onClick={() => deactivateVenue(venue._id)}>
                          Delete / Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="linear-panel p-5">
            <p className="mb-3 text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">All Events Archive</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <tr>
                    <th className="px-2 py-2">Title</th>
                    <th className="px-2 py-2">Organization</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Start</th>
                    <th className="px-2 py-2">End</th>
                    <th className="px-2 py-2">Budget</th>
                    <th className="px-2 py-2">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event._id} className="border-t border-[var(--border-subtle)] text-[var(--text-secondary)]">
                      <td className="px-2 py-2">{event.title}</td>
                      <td className="px-2 py-2">{organizationName(event.organizationId)}</td>
                      <td className="px-2 py-2">{event.status}</td>
                      <td className="px-2 py-2">{asDateTime(event.startAt)}</td>
                      <td className="px-2 py-2">{asDateTime(event.endAt)}</td>
                      <td className="px-2 py-2">{asCurrency(event.budget)}</td>
                      <td className="px-2 py-2">{asDateTime(event.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {passwordForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="linear-panel w-full max-w-md p-5">
            <p className="text-sm font-[520] text-[var(--text-primary)]">Change Password</p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">Confirm password change for {passwordForm.userLabel}</p>

            <form className="mt-4 space-y-3" onSubmit={submitPasswordChange}>
              <input
                className="linear-input"
                placeholder="New password"
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => (prev ? { ...prev, newPassword: event.target.value } : prev))
                }
                required
                minLength={6}
              />
              <input
                className="linear-input"
                placeholder="Confirm password"
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => (prev ? { ...prev, confirmPassword: event.target.value } : prev))
                }
                required
                minLength={6}
              />
              <div className="flex justify-end gap-2">
                <button className="linear-btn" type="button" onClick={() => setPasswordForm(null)}>
                  Cancel
                </button>
                <button className="linear-btn linear-btn-primary" type="submit">
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
