import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { UnauthorizedError } from "../../api/client";
import { printsApi } from "../../api/prints";
import type { SlicerTarget } from "./useOpenInSlicer";

export type SanitizeState = "idle" | "preparing" | "ready";

const POLL_MS = 2000;

/** "Open sanitized in <slicer>": asks the server for a sanitized copy and polls until it's built, so no
 *  request has to outlast a proxy timeout. A cached copy opens straight away. A slow one ends in
 *  "ready" and needs a second click: browsers only launch a slicer's protocol right after a click. */
export function useSanitizedOpen(printId: string, onOpened: () => void, onUnauthorized?: () => void) {
  const { t } = useTranslation(["models"]);
  const [states, setStates] = useState<Record<string, SanitizeState>>({});
  // Set on every mount: StrictMode unmounts and remounts once in development.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setState = useCallback((key: string, state: SanitizeState) => {
    if (mounted.current) setStates((prev) => ({ ...prev, [key]: state }));
  }, []);

  const stateOf = useCallback((target: SlicerTarget): SanitizeState => states[target.key] ?? "idle", [states]);

  /** Resolves true when the slicer was launched, so a menu can close. */
  const open = useCallback(
    async (target: SlicerTarget): Promise<boolean> => {
      const launch = () => {
        window.location.href = target.href;
        setState(target.key, "idle");
        onOpened();
        return true;
      };
      const current = states[target.key] ?? "idle";
      if (current === "ready") return launch();
      if (current === "preparing" || !target.plate) return false;

      setState(target.key, "preparing");
      try {
        let { status } = await printsApi.sanitizePlate(printId, target.plate.id);
        if (status === "ready") return launch();
        while (status === "preparing") {
          await new Promise((resolve) => setTimeout(resolve, POLL_MS));
          if (!mounted.current) return false;
          ({ status } = await printsApi.sanitizePlate(printId, target.plate.id));
        }
        if (status === "failed") throw new Error("Sanitizing failed");
        setState(target.key, "ready");
        return false;
      } catch (err) {
        setState(target.key, "idle");
        if (err instanceof UnauthorizedError) onUnauthorized?.();
        else if (mounted.current) alert(t("models:detail.sanitizeFailed"));
        return false;
      }
    },
    [states, printId, onOpened, onUnauthorized, setState, t],
  );

  return { stateOf, open };
}
