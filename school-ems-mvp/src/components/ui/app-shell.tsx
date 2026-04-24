"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/client/api";
import type { AuthUser, UserRole } from "@/lib/client/types";

type AppShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

const navItems = [
  { href: "/student", label: "Dashboard", roles: ["STUDENT_LEADER"] as UserRole[] },
  { href: "/approver", label: "Queue", roles: ["ADVISER", "DEAN", "FACILITIES", "OSA"] as UserRole[] },
  { href: "/admin#venues", label: "Venues", roles: ["ADMIN"] as UserRole[] },
  { href: "/admin#archive", label: "Event Archive", roles: ["ADMIN"] as UserRole[] },
];

export function AppShell({ title, subtitle, children }: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);

  useEffect(() => {
    let mounted = true;

    queueMicrotask(() => {
      void (async () => {
        try {
          const me = await apiRequest<AuthUser>("/api/me");
          if (mounted) {
            setMe(me);
          }
        } catch {
          if (mounted) {
            setMe(null);
          }
        }
      })();
    });

    return () => {
      mounted = false;
    };
  }, []);

  const visibleNavItems = useMemo(() => {
    if (!me?.role) {
      return [];
    }

    return navItems.filter((item) => item.roles.includes(me.role));
  }, [me]);

  const userInitials = useMemo(() => {
    if (!me?.name) return "U";
    const parts = me.name.trim().split(/\s+/);
    return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "U";
  }, [me]);

  const isCreateMode = searchParams.get("create") === "1";

  const navLinkClass = (active: boolean) =>
    `block rounded-md border px-3 py-2 text-sm transition ${
      active
        ? "border-[rgba(113,112,255,0.5)] bg-[rgba(113,112,255,0.16)] text-[var(--text-primary)]"
        : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:border-[var(--border-standard)] hover:bg-[var(--bg-surface-soft)]"
    }`;

  async function handleLogout() {
    await apiRequest("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="grid-ambient min-h-screen">
      <aside className="linear-panel fixed inset-y-5 left-4 z-20 hidden w-[260px] flex-col justify-between px-4 py-4 md:flex">
        <div>
          <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">School EMS</p>
          <h2 className="mt-3 text-lg font-[510] tracking-[-0.24px] text-[var(--text-primary)]">Event Workflow</h2>
          <nav className="mt-7 space-y-1.5">
            {visibleNavItems.map((item) => {
              let active = pathname.startsWith(item.href.split("#")[0]);
              if (item.href === "/approver" && isCreateMode) {
                active = false;
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={navLinkClass(active)}
                >
                  {item.label}
                </Link>
              );
            })}
            {(me?.role === "ADVISER" || me?.role === "DEAN") && (
              <Link
                href="/approver?create=1"
                className={navLinkClass(pathname === "/approver" && isCreateMode)}
              >
                Create Event
              </Link>
            )}
            {visibleNavItems.length === 0 && !(me?.role === "ADVISER" || me?.role === "DEAN") && (
              <p className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-2 text-xs text-[var(--text-muted)]">
                Loading navigation...
              </p>
            )}
          </nav>
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface-soft)] px-3 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-standard)] bg-[rgba(113,112,255,0.16)] text-xs font-[610] text-[var(--text-primary)]">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-[510] text-[var(--text-secondary)]">{me?.name ?? "Loading user..."}</p>
                <p className="truncate text-xs text-[var(--text-muted)]">{me?.email ?? ""}</p>
              </div>
            </div>
          </div>

          <button className="linear-btn w-full" onClick={handleLogout} type="button">
            Log out
          </button>
        </div>
      </aside>

      <div className="md:pl-[292px]">
        <main className="h-screen overflow-y-auto px-4 py-5 md:px-6">
          <div className="mx-auto w-full max-w-[1180px]">
            <header className="linear-panel mb-5 px-5 py-5">
              <p className="text-xs font-[510] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                School Event Management System
              </p>
              <h1 className="mt-2 text-[1.8rem] font-[510] tracking-[-0.704px] text-[var(--text-primary)]">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-[var(--text-tertiary)]">{subtitle}</p>
            </header>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
