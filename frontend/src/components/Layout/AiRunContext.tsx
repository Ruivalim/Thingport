import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { aiCategorizationApi, type AiRun, type AiRunScope } from "../../api/aiCategorization";
import { aiDescriptionsApi, type AiDescriptionRun } from "../../api/aiDescriptions";
import { UnauthorizedError } from "../../api/client";

/** One library run of an AI feature: the latest one, finished or not, and how to start or stop it. */
export type TrackedRun<R, S> = {
  /** Null before the first run. */
  run: R | null;
  running: boolean;
  startRun: (scope: S) => Promise<void>;
  cancelRun: () => Promise<void>;
};

type AiRunContextValue = {
  categorization: TrackedRun<AiRun, AiRunScope>;
  descriptions: TrackedRun<AiDescriptionRun, void>;
};

const AiRunContext = createContext<AiRunContextValue | null>(null);

const POLL_INTERVAL_MS = 2000;

type RunApi<R, S> = {
  /** Whether the feature is on; there's no run to pick up when it isn't. */
  enabled: () => Promise<boolean>;
  state: () => Promise<R | null>;
  start: (scope: S) => Promise<R>;
  cancel: () => Promise<R | null>;
};

/** Picks up a run already going after a reload, follows it while it runs, and says when it ends. */
function useTrackedRun<R extends { running: boolean }, S>(
  api: RunApi<R, S>,
  onUnauthorized: (() => void) | undefined,
  onFinished: React.RefObject<(() => void) | undefined>,
): TrackedRun<R, S> {
  const [run, setRun] = useState<R | null>(null);
  const running = Boolean(run?.running);

  const refresh = useCallback(async () => {
    try {
      setRun(await api.state());
    } catch (err) {
      if (err instanceof UnauthorizedError) onUnauthorized?.();
    }
  }, [api, onUnauthorized]);

  useEffect(() => {
    let active = true;
    void api
      .enabled()
      .then((enabled) => {
        if (active && enabled) void refresh();
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [api, refresh]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [running, refresh]);

  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) onFinished.current?.();
    wasRunning.current = running;
  }, [running, onFinished]);

  const startRun = useCallback(async (scope: S) => setRun(await api.start(scope)), [api]);
  const cancelRun = useCallback(async () => setRun(await api.cancel()), [api]);
  return useMemo(() => ({ run, running, startRun, cancelRun }), [run, running, startRun, cancelRun]);
}

// Module-level, so the hooks above see the same object on every render.
const categorizationRuns: RunApi<AiRun, AiRunScope> = {
  enabled: async () => (await aiCategorizationApi.status()).enabled,
  state: async () => (await aiCategorizationApi.runState()).run,
  start: async (scope) => (await aiCategorizationApi.startRun(scope)).run,
  cancel: async () => (await aiCategorizationApi.cancelRun()).run,
};
const descriptionRuns: RunApi<AiDescriptionRun, void> = {
  enabled: async () => (await aiDescriptionsApi.status()).enabled,
  state: async () => (await aiDescriptionsApi.runState()).run,
  start: async () => (await aiDescriptionsApi.startRun()).run,
  cancel: async () => (await aiDescriptionsApi.cancelRun()).run,
};

/** The library runs of the AI features, followed app-wide so their progress bars outlive the dialog that started
 *  them. */
export function AiRunProvider({
  onUnauthorized,
  onRunFinished,
  children,
}: {
  onUnauthorized?: () => void;
  /** Models may have changed, and the run's summary notification has arrived. */
  onRunFinished?: () => void;
  children: React.ReactNode;
}) {
  const onRunFinishedRef = useRef(onRunFinished);
  useEffect(() => {
    onRunFinishedRef.current = onRunFinished;
  }, [onRunFinished]);

  const categorization = useTrackedRun(categorizationRuns, onUnauthorized, onRunFinishedRef);
  const descriptions = useTrackedRun(descriptionRuns, onUnauthorized, onRunFinishedRef);
  const value = useMemo(() => ({ categorization, descriptions }), [categorization, descriptions]);
  return <AiRunContext.Provider value={value}>{children}</AiRunContext.Provider>;
}

function useAiRuns(): AiRunContextValue {
  const value = useContext(AiRunContext);
  if (!value) throw new Error("useAiRun must be used inside AiRunProvider");
  return value;
}

/** The AI categorization run. */
export function useAiRun(): TrackedRun<AiRun, AiRunScope> {
  return useAiRuns().categorization;
}

export function useAiDescriptionRun(): TrackedRun<AiDescriptionRun, void> {
  return useAiRuns().descriptions;
}
