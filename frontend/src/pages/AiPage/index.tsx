import { useCallback, useEffect, useState } from "react";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import { UnauthorizedError } from "../../api/client";
import { aiConnectionsApi, type AiConnection } from "../../api/aiConnections";
import AiConnectionsSection from "./AiConnectionsSection";
import AiFeaturesSection from "./AiFeaturesSection";

type Props = {
  onUnauthorized?: () => void;
};

export default function AiPage({ onUnauthorized }: Props) {
  // Shared: a feature picks from the same models the grid shows.
  const [connections, setConnections] = useState<AiConnection[] | null>(null);

  const load = useCallback(() => {
    void aiConnectionsApi
      .list()
      .then(setConnections)
      .catch((err: unknown) => {
        if (err instanceof UnauthorizedError) onUnauthorized?.();
        else setConnections((current) => current ?? []);
      });
  }, [onUnauthorized]);
  useEffect(load, [load]);

  return (
    <Stack spacing={4} divider={<Divider />}>
      <AiConnectionsSection connections={connections} onChanged={load} onUnauthorized={onUnauthorized} />
      <AiFeaturesSection connections={connections ?? []} onUnauthorized={onUnauthorized} />
    </Stack>
  );
}
