const retryableCodes = new Set(['aborted', 'failed-precondition', 'permission-denied']);

const codeOf = (error: unknown) =>
  typeof error === 'object' && error && 'code' in error ? String(error.code) : '';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Re-runs a Firestore transaction that lost a race.
 *
 * The security rules require each stock change to chain exactly from the stored stock value.
 * When two devices change the same medicine at once, the slower commit is evaluated against the
 * newer stock and is rejected as `permission-denied` rather than as a retryable conflict, so the
 * SDK does not retry it. Running the transaction again reads fresh data and either succeeds or
 * resolves to a duplicate. Genuine authorization failures still fail after the bounded attempts.
 */
export async function withContentionRetry<T>(
  operation: () => Promise<T>,
  attempts = 8,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!retryableCodes.has(codeOf(error)) || attempt === attempts - 1) break;
      // Full jitter spreads competing writers apart so they stop colliding.
      await wait(Math.random() * Math.min(2000, 60 * 2 ** attempt));
    }
  }
  throw lastError;
}
