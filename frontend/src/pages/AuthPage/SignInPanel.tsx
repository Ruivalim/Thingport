import React from "react";
import { useTranslation } from "react-i18next";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import Link from "@mui/material/Link";
import { authApi, type AuthUser } from "../../api/auth";
import { EmailNotVerifiedError } from "../../api/client";
import type { CaptchaAnswer } from "../../api/captcha";
import CaptchaField from "../../components/CaptchaField";
import { useCaptchaSettings } from "../../hooks/useCaptchaSettings";
import ResendVerificationButton from "./ResendVerificationButton";

type Props = {
  onSuccess: (token: string, expires_in: number, user: AuthUser) => void;
  /** Shown only when set, i.e. when SMTP is configured. Gets whatever email was typed. */
  onForgotPassword?: (email: string) => void;
};

export default function SignInPanel({ onSuccess, onForgotPassword }: Props) {
  const { t } = useTranslation("app");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = React.useState(false);
  const captchaSettings = useCaptchaSettings();
  const [captcha, setCaptcha] = React.useState<CaptchaAnswer | null>(null);
  const [captchaKey, setCaptchaKey] = React.useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setLoading(true);
    try {
      const res = await authApi.login(email, password, captchaSettings?.login ? captcha : null);
      onSuccess(res.token, res.expires_in, res.user);
    } catch (err) {
      console.error(err);
      // Every attempt uses the captcha up.
      if (captchaSettings?.login) setCaptchaKey((k) => k + 1);
      if (err instanceof EmailNotVerifiedError) {
        setNeedsVerification(true);
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : t("auth.signIn.failed"));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack spacing={2}>
        {error && <Alert severity="error">{error}</Alert>}
        {needsVerification && <ResendVerificationButton email={email} />}
        <TextField
          type="email"
          label={t("auth.signIn.emailLabel")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          fullWidth
          size="small"
        />
        <TextField
          type="password"
          label={t("auth.signIn.passwordLabel")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          fullWidth
          size="small"
        />
        {onForgotPassword && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: "4px !important" }}>
            <Link component="button" type="button" variant="body2" onClick={() => onForgotPassword(email.trim())}>
              {t("auth.signIn.forgotPassword")}
            </Link>
          </Box>
        )}
        {captchaSettings?.login && <CaptchaField key={captchaKey} onChange={setCaptcha} disabled={loading} />}
        <Button type="submit" variant="contained" disabled={loading} fullWidth size="large">
          {loading ? t("auth.signIn.submitting") : t("auth.signIn.submit")}
        </Button>
      </Stack>
    </Box>
  );
}
