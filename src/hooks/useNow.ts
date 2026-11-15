import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** The current time, refreshed every minute and whenever the app returns to the foreground. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs]);
  return now;
}
