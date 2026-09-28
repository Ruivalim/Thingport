import React from "react";
import { useLocation, useNavigate, useNavigationType } from "react-router-dom";

type LogEntry = { key: string; pathname: string };

type NavigationHistoryValue = {
  /** Like `navigate(-1)`, but skips consecutive entries for the same pathname (e.g. sort changes). */
  goBack: () => void;
};

const NavigationHistoryContext = React.createContext<NavigationHistoryValue | null>(null);

/** Keeps its own log since the History API doesn't expose previous entries. Mount inside the
 *  Router. */
export function NavigationHistoryProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const navigate = useNavigate();
  const logRef = React.useRef<LogEntry[]>([]);
  const posRef = React.useRef(-1);

  React.useEffect(() => {
    const log = logRef.current;
    const entry: LogEntry = { key: location.key, pathname: location.pathname };
    if (navigationType === "PUSH") {
      log.splice(posRef.current + 1);
      log.push(entry);
      posRef.current = log.length - 1;
    } else if (navigationType === "REPLACE") {
      if (posRef.current >= 0) log[posRef.current] = entry;
      else {
        log.push(entry);
        posRef.current = 0;
      }
    } else {
      // Back/forward or our own navigate(-n): find the entry by key rather than assuming one step.
      const idx = log.findIndex((e) => e.key === entry.key);
      if (idx !== -1) {
        posRef.current = idx;
      } else {
        log.length = 0;
        log.push(entry);
        posRef.current = 0;
      }
    }
  }, [location.key, location.pathname, navigationType]);

  const goBack = React.useCallback(() => {
    const log = logRef.current;
    const pos = posRef.current;
    if (pos <= 0) {
      navigate("/");
      return;
    }
    const currentPathname = log[pos].pathname;
    let steps = 1;
    while (pos - steps > 0 && log[pos - steps].pathname === currentPathname) {
      steps += 1;
    }
    navigate(-steps);
  }, [navigate]);

  const value = React.useMemo(() => ({ goBack }), [goBack]);

  return <NavigationHistoryContext.Provider value={value}>{children}</NavigationHistoryContext.Provider>;
}

export function useSmartBack(): () => void {
  const ctx = React.useContext(NavigationHistoryContext);
  if (!ctx) throw new Error("useSmartBack must be used within a NavigationHistoryProvider");
  return ctx.goBack;
}
