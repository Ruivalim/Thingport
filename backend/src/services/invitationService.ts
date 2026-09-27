// Invitations to register while new registrations are turned off (Administration > Users).
// An admin enters an email; the invitee gets a link with a single-use token, and registering with
// that token is the only way to create an account for that address (see routes/auth.ts). The token
// -- not just the email in the link -- is what authorizes it: otherwise anyone who knew an invited
// address could register it first and lock the real invitee out. It also proves the invitee owns
// the mailbox, so accounts created from an invitation skip the separate verification email.

import crypto from "node:crypto";
import type { Invitation } from "@prisma/client";
import { PUBLIC_URL } from "../config";
import { prisma } from "../db";
import { HttpError } from "../utils/fileUtils";
import { sendInvitationEmail } from "./mailer";
import { getAllowRegistrations, isSmtpConfigured } from "./settingsService";

export const INVITATION_TTL_DAYS = 7;

/** The registration link an invitation email points to. `origin` (the admin's own browser origin)
 *  is only a fallback for instances without PUBLIC_URL -- it's the address the admin reached the
 *  frontend at, which is exactly what the invitee needs too. */
export function invitationLink(email: string, token: string, origin: string | null): string {
  const base = PUBLIC_URL || (origin ?? "").replace(/\/+$/, "");
  return `${base}/register?email=${encodeURIComponent(email)}&invite=${encodeURIComponent(token)}`;
}

/** Creates (or, for an address already invited, replaces) the invitation and emails it. Only
 *  allowed while registrations are closed -- open registrations need no invitation -- and with SMTP
 *  set up, since the link only ever travels by email. */
export async function inviteUser(params: { email: string; invitedById: string; inviterName: string; origin: string | null }): Promise<Invitation> {
  const email = params.email.trim().toLowerCase();
  if (await getAllowRegistrations(true)) {
    throw new HttpError(400, "Registrations are open, so anyone can sign up without an invitation.");
  }
  if (!(await isSmtpConfigured())) {
    throw new HttpError(400, "Set up SMTP (Connections > SMTP) to send invitations.");
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    throw new HttpError(409, "An account with this email already exists");
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const previous = await prisma.invitation.findUnique({ where: { email } });
  const invitation = await prisma.invitation.upsert({
    where: { email },
    create: { email, token, expiresAt, invitedById: params.invitedById },
    update: { token, expiresAt, invitedById: params.invitedById },
  });

  try {
    await sendInvitationEmail(email, params.inviterName, invitationLink(email, token, params.origin), INVITATION_TTL_DAYS);
  } catch (err) {
    console.error("[invitations] Failed to send invitation email:", err);
    // Leave things as they were: no brand-new invitation nobody received, and a re-invite keeps
    // the earlier (already delivered) link working.
    if (previous) {
      await prisma.invitation.update({
        where: { email },
        data: { token: previous.token, expiresAt: previous.expiresAt, invitedById: previous.invitedById },
      });
    } else {
      await prisma.invitation.delete({ where: { email } }).catch(() => undefined);
    }
    throw new HttpError(500, "Failed to send the invitation email. Check the SMTP settings and try again.");
  }
  return invitation;
}

/** The invitation behind a registration link, or null if the token is unknown or expired. */
export async function findValidInvitation(token: string): Promise<Invitation | null> {
  const invitation = await prisma.invitation.findUnique({ where: { token } });
  if (!invitation || invitation.expiresAt < new Date()) return null;
  return invitation;
}
