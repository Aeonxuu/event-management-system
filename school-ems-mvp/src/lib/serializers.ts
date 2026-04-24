type DecimalLike = {
  toString: () => string;
};

export function serializeEvent<T extends { budget?: DecimalLike | null }>(event: T): T & { budget?: number } {
  if (!event.budget) {
    return event as T & { budget?: number };
  }

  return {
    ...event,
    budget: Number.parseFloat(event.budget.toString()),
  };
}
