import {
  MAX_REFILL_AMOUNT,
  crossedLowStock,
  isLowStock,
  stockLevelPercent,
  validateRefillAmount,
} from '@/src/features/inventory/inventoryLogic';

describe('low-stock detection', () => {
  it('fires only when crossing the threshold or running out', () => {
    expect(crossedLowStock(6, 5, 5)).toBe(true);
    expect(crossedLowStock(5, 4, 5)).toBe(false);
    expect(crossedLowStock(7, 6, 5)).toBe(false);
    expect(crossedLowStock(1, 0, 0)).toBe(true);
    expect(crossedLowStock(2, 0, 5)).toBe(true);
  });
  it('never fires on increases', () => {
    expect(crossedLowStock(3, 33, 5)).toBe(false);
    expect(crossedLowStock(0, 0, 0)).toBe(false);
  });
  it('treats stock at the threshold as low', () => {
    expect(isLowStock(5, 5)).toBe(true);
    expect(isLowStock(6, 5)).toBe(false);
  });
});

describe('refill amount validation', () => {
  it('accepts whole numbers in range', () => {
    expect(validateRefillAmount(' 30 ')).toEqual({ ok: true, amount: 30 });
    expect(validateRefillAmount(String(MAX_REFILL_AMOUNT))).toEqual({
      ok: true,
      amount: MAX_REFILL_AMOUNT,
    });
  });
  it.each(['', '0', '-5', '2.5', 'abc', '1e3', String(MAX_REFILL_AMOUNT + 1)])(
    'rejects %p',
    (value) => expect(validateRefillAmount(value).ok).toBe(false),
  );
});

describe('stock level', () => {
  it('clamps to 0–100', () => {
    expect(stockLevelPercent(15, 30)).toBe(50);
    expect(stockLevelPercent(45, 30)).toBe(100);
    expect(stockLevelPercent(0, 0)).toBe(0);
    expect(stockLevelPercent(3, 0)).toBe(100);
  });
});
