import type { ApiEnvelope } from "@/lib/client/types";

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;

  if (!response.ok || payload.success === false) {
    throw new Error(payload.error ?? "Request failed");
  }

  return payload.data as T;
}

export function asCurrency(value: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

export function asDateTime(value?: string): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}
