import React from "react";
import { useTranslation } from "react-i18next";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Alert from "@mui/material/Alert";
import type { AuthUser } from "../../api/auth";
import Wordmark from "../../components/Wordmark";
import SignInPanel from "./SignInPanel";
import RegisterPanel, { type Invite } from "./RegisterPanel";

type Props = {
  onSuccess: (token: string, expires_in: number, user: AuthUser) => void;
  apiUp: boolean | null;
  allowRegistrations: boolean;
  /** From an invitation link -- opens on the register form for that address, even while
   *  registrations are closed. */
  invite?: Invite | null;
};

export default function AuthPage({ onSuccess, apiUp, allowRegistrations, invite = null }: Props) {
  const { t } = useTranslation("app");
  const [tab, setTab] = React.useState<"signIn" | "register">(invite ? "register" : "signIn");
  // Closed registrations drop the Register tab altogether -- there's nothing to fill in -- unless
  // this visit came from an invitation.
  const canRegister = allowRegistrations || invite !== null;

  return (
    <Paper
      elevation={8}
      sx={{
        width: "100%",
        maxWidth: 420,
        borderRadius: 3,
        p: 4,
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack spacing={3} sx={{ mb: 3, textAlign: "center" }}>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Wordmark size="lg" />
        </Box>
        <Typography variant="body2" color="text.secondary">
          {t("auth.subtitle")}
        </Typography>
      </Stack>

      {apiUp === false && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t("auth.apiOffline")}
        </Alert>
      )}

      {canRegister && (
        <Tabs
          value={tab}
          onChange={(_e, value) => setTab(value)}
          variant="fullWidth"
          sx={{ mb: 3, borderBottom: "1px solid", borderColor: "divider" }}
        >
          <Tab value="signIn" label={t("auth.signInTab")} />
          <Tab value="register" label={t("auth.registerTab")} />
        </Tabs>
      )}

      {tab === "register" && canRegister ? (
        <RegisterPanel onSuccess={onSuccess} invite={invite} />
      ) : (
        <SignInPanel onSuccess={onSuccess} />
      )}
    </Paper>
  );
}
