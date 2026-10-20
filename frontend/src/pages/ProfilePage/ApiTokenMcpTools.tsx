import React from "react";
import { useTranslation } from "react-i18next";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { authApi, type ApiTokenInfo, type McpToolInfo } from "../../api/auth";
import { UnauthorizedError } from "../../api/client";

type Props = {
  info: ApiTokenInfo;
  onChange: (info: ApiTokenInfo) => void;
  onUnauthorized?: () => void;
};

/** Which MCP tools the token may call at /api/mcp. Each box saves on its own, so there's no
 *  unsaved state to lose; a refused save puts the box back. */
export default function ApiTokenMcpTools({ info, onChange, onUnauthorized }: Props) {
  const { t, i18n } = useTranslation(["app", "common"]);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  // Ahead of the server while a save is in flight; back in step with it once the save answers.
  const [selected, setSelected] = React.useState<string[]>(info.mcp_tools);
  React.useEffect(() => setSelected(info.mcp_tools), [info.mcp_tools]);
  const enabled = new Set(selected);

  // A tool added on the server before its translation falls back to the server's English text.
  const label = (tool: McpToolInfo, part: "title" | "description") => {
    const key = `profile.apiToken.mcp.tools.${tool.name}.${part}`;
    return i18n.exists(key, { ns: "app" }) ? t(key) : tool[part];
  };

  const toggle = async (name: string, on: boolean) => {
    const next = info.available_mcp_tools
      .map((tool) => tool.name)
      .filter((tool) => (tool === name ? on : enabled.has(tool)));
    setSelected(next);
    setSaving(name);
    setError(null);
    try {
      onChange(await authApi.setApiTokenMcpTools(next));
    } catch (err) {
      setSelected(info.mcp_tools);
      if (err instanceof UnauthorizedError) onUnauthorized?.();
      else setError(t("profile.apiToken.mcp.failed"));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}>
      <Typography variant="body2" fontWeight={600}>
        {t("profile.apiToken.mcp.heading")}
      </Typography>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
        {t("profile.apiToken.mcp.description")}
      </Typography>
      <Stack spacing={0.5}>
        {info.available_mcp_tools.map((tool) => (
          <FormControlLabel
            key={tool.name}
            sx={{ alignItems: "flex-start", m: 0 }}
            control={
              <Checkbox
                size="small"
                sx={{ pt: 0.25 }}
                checked={enabled.has(tool.name)}
                disabled={saving !== null}
                onChange={(e) => void toggle(tool.name, e.target.checked)}
              />
            }
            label={
              <Box sx={{ pt: 0.25 }}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="body2">{label(tool, "title")}</Typography>
                  {!tool.read_only && (
                    <Chip size="small" color="warning" variant="outlined" label={t("profile.apiToken.mcp.writes")} />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  {label(tool, "description")}
                </Typography>
              </Box>
            }
          />
        ))}
      </Stack>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
    </Box>
  );
}
