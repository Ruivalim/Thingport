import { useId } from "react";
import { useTranslation } from "react-i18next";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import type { AiConnection } from "../../api/aiConnections";
import { AiLogo, hostOf } from "./aiLogos";

/** An option in the list: the model's logo and what to call it. */
function AiOption({ connection, label }: { connection: AiConnection | undefined; label: string }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      {connection ? (
        <AiLogo model={connection.model} baseUrl={connection.base_url} size={18} />
      ) : (
        <span style={{ width: 18 }} />
      )}
      <span>{label}</span>
    </Stack>
  );
}

/** A model as it shows in the list. */
function ModelOption({ connection }: { connection: AiConnection }) {
  return <AiOption connection={connection} label={`${connection.model} · ${hostOf(connection.base_url)}`} />;
}

type Props = {
  /** Null is the default AI. */
  value: string | null;
  connections: AiConnection[];
  onChange: (id: string | null) => void;
  disabled?: boolean;
};

/** Which model a feature uses: the default one, or one picked out. */
export default function UseAiSelect({ value, connections, onChange, disabled }: Props) {
  const { t } = useTranslation("app");
  const labelId = useId();
  const defaultConnection = connections.find((connection) => connection.is_default);
  const defaultOption = (
    <AiOption
      connection={defaultConnection}
      label={t("adminSettings.aiCategorization.defaultAi", { model: defaultConnection?.model ?? "—" })}
    />
  );
  return (
    <FormControl fullWidth>
      {/* Empty means the default AI, which still shows text, so the label stays up on the border. */}
      <InputLabel id={labelId} shrink>
        {t("adminSettings.aiCategorization.useAi")}
      </InputLabel>
      <Select
        labelId={labelId}
        label={t("adminSettings.aiCategorization.useAi")}
        // A saved choice that's gone (deleted meanwhile) reads as the default, as the backend treats it.
        value={value && connections.some((connection) => connection.id === value) ? value : ""}
        displayEmpty
        notched
        // The chosen option as it looks in the list, logo included; empty is the default AI.
        renderValue={(chosen) => {
          const connection = connections.find((candidate) => candidate.id === chosen);
          return connection ? <ModelOption connection={connection} /> : defaultOption;
        }}
        onChange={(event) => onChange(event.target.value || null)}
        disabled={disabled || !connections.length}
      >
        <MenuItem value="">{defaultOption}</MenuItem>
        {connections.map((connection) => (
          <MenuItem key={connection.id} value={connection.id}>
            <ModelOption connection={connection} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
