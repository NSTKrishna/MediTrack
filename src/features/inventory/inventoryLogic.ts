export const MAX_REFILL_AMOUNT = 1000;

export const isLowStock = (remaining: number, threshold: number) => remaining <= threshold;

/**
 * A low-stock alert fires only when a change moves stock from above the threshold to at or
 * below it, or when stock runs out. Repeated deductions while already low do not re-alert.
 */
export function crossedLowStock(previous: number, next: number, threshold: number) {
  if (next >= previous) return false;
  if (next === 0) return true;
  return previous > threshold && next <= threshold;
}

export type RefillValidation = { ok: true; amount: number } | { ok: false; message: string };

export function validateRefillAmount(raw: string): RefillValidation {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return { ok: false, message: 'Enter a whole number of doses.' };
  const amount = Number(trimmed);
  if (amount < 1) return { ok: false, message: 'Refill amount must be at least 1.' };
  if (amount > MAX_REFILL_AMOUNT)
    return { ok: false, message: `Refill amount cannot exceed ${MAX_REFILL_AMOUNT}.` };
  return { ok: true, amount };
}

export function stockLevelPercent(remaining: number, capacity: number) {
  if (capacity <= 0) return remaining > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((remaining / capacity) * 100)));
}
