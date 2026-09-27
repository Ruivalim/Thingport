import nodemailer from "nodemailer";
import { PUBLIC_URL } from "../config";
import { getSmtpSettings } from "./settingsService";

/** Sends one email through the instance's SMTP settings. Only ever called once the caller has
 * already confirmed SMTP is configured (isSmtpConfigured) -- throws if `host` somehow ends up
 * unset here anyway, since silently dropping one of these emails would leave its recipient with
 * no way in. */
async function sendMail(message: { to: string; subject: string; text: string; html: string }): Promise<void> {
  const smtp = await getSmtpSettings();
  if (!smtp.host) throw new Error("SMTP is not configured");

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass ?? undefined } : undefined,
  });
  await transporter.sendMail({ from: smtp.from, ...message });
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Sends the account-verification email a new registration (see routes/auth.ts) waits on before
 * it can sign in. */
export async function sendVerificationEmail(to: string, displayName: string, token: string): Promise<void> {
  const link = `${PUBLIC_URL}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail({
    to,
    subject: "Confirm your Thingport account",
    text: `Hi ${displayName},\n\nConfirm your email address to finish creating your Thingport account:\n${link}\n\nThis link expires in 24 hours.`,
    html: `<p>Hi ${escapeHtml(displayName)},</p><p>Confirm your email address to finish creating your Thingport account:</p><p><a href="${link}">${link}</a></p><p>This link expires in 24 hours.</p>`,
  });
}

/** Sends an invitation to register while registrations are closed (see
 * services/invitationService.ts). `link` is the full registration URL, token included. */
export async function sendInvitationEmail(to: string, inviterName: string, link: string, expiresInDays: number): Promise<void> {
  await sendMail({
    to,
    subject: "You're invited to Thingport",
    text: `${inviterName} invited you to create an account on their Thingport, a library for 3D-printing models.\n\nCreate your account here:\n${link}\n\nThe link works for ${expiresInDays} days, for this email address only.`,
    html: `<p>${escapeHtml(inviterName)} invited you to create an account on their Thingport, a library for 3D-printing models.</p><p><a href="${link}">Create your account</a></p><p>Or open this link: ${link}</p><p>The link works for ${expiresInDays} days, for this email address only.</p>`,
  });
}
