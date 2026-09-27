// Image captchas for login, registration and import (turned on per place in Administration >
// Captcha). Generated here, no outside service: svg-captcha draws each character as vector
// outlines -- not <text> -- with a slight tilt and a couple of noise lines, so the answer isn't
// sitting in the image's markup, yet it stays easy for a person to read.
//
// Answers live only in this process's memory: each captcha is single-use (checked answers are
// dropped, right or wrong) and expires after CAPTCHA_TTL_MS. A restart simply invalidates any
// captcha that was on screen -- the form fetches a new one.

import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import svgCaptcha from "svg-captcha";
import { HttpError } from "../utils/fileUtils";
import { isCaptchaEnabled, type CaptchaPlace } from "./settingsService";

const CAPTCHA_TTL_MS = 10 * 60 * 1000;
// Bounds memory if something requests captchas in a loop: the oldest pending ones go first.
const MAX_PENDING = 5000;
// Characters people mix up (0/O, 1/I/l) are left out -- the point is stopping scripts, not people.
const IGNORE_CHARS = "0oO1iIlL";

const pending = new Map<string, { answer: string; expiresAt: number }>();

function dropExpired(now: number): void {
  for (const [id, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(id);
  }
}

/** A new captcha: its id, the image to show (as a data: URL), and the answer -- which callers
 *  other than tests must not send to the client. */
export function createCaptcha(): { id: string; image: string; answer: string } {
  const now = Date.now();
  dropExpired(now);
  while (pending.size >= MAX_PENDING) pending.delete(pending.keys().next().value!);

  const { data, text } = svgCaptcha.create({
    size: 5,
    ignoreChars: IGNORE_CHARS,
    noise: 2,
    color: true,
    background: "#f4f6f8",
    width: 160,
    height: 56,
    fontSize: 52,
  });
  const id = crypto.randomUUID();
  pending.set(id, { answer: text, expiresAt: now + CAPTCHA_TTL_MS });
  return { id, image: `data:image/svg+xml;base64,${Buffer.from(data).toString("base64")}`, answer: text };
}

/** Checks (and uses up) a captcha. Case-insensitive, surrounding spaces ignored. */
export function verifyCaptcha(id: unknown, answer: unknown): boolean {
  if (typeof id !== "string" || typeof answer !== "string") return false;
  const entry = pending.get(id);
  pending.delete(id);
  if (!entry || entry.expiresAt <= Date.now()) return false;
  return entry.answer.toLowerCase() === answer.trim().toLowerCase();
}

// The Origin a browser puts on a request an extension's background script sends to another site
// (checked live for Chromium: a POST from an MV3 service worker carries chrome-extension://<id>).
const EXTENSION_ORIGIN = /^(chrome|moz|safari-web)-extension:\/\//i;

/** Thingport Grab (the browser extension) isn't asked for captchas -- it signs in and imports in the
 *  background, with nowhere to show one. It's recognized by its X-Thingport-Client header, or, for
 *  versions from before that header existed, by the extension Origin its browser attaches: every
 *  guarded endpoint is a POST, which always carries one. A page's own requests can't claim an
 *  extension Origin (the browser sets it), but anything outside a browser can send either, so this
 *  is a convenience for the extension, not a security boundary. */
export function isExtensionRequest(req: Request): boolean {
  return req.get("x-thingport-client") === "grab" || EXTENSION_ORIGIN.test(req.get("origin") ?? "");
}

/** Throws unless `place` doesn't need a captcha right now, or the request body carries a correct
 *  one (`captcha_id` + `captcha_answer`). */
export async function checkCaptcha(req: Request, place: CaptchaPlace): Promise<void> {
  if (isExtensionRequest(req) || !(await isCaptchaEnabled(place))) return;
  const body = (req.body ?? {}) as { captcha_id?: unknown; captcha_answer?: unknown };
  if (typeof body.captcha_answer !== "string" || !body.captcha_answer.trim()) {
    throw new HttpError(400, "Enter the characters shown in the image.", "CAPTCHA_REQUIRED");
  }
  if (!verifyCaptcha(body.captcha_id, body.captcha_answer)) {
    throw new HttpError(400, "The characters didn't match the image. Try the new one.", "CAPTCHA_INVALID");
  }
}

/** Route middleware form of checkCaptcha, for endpoints guarded as a whole (the import starts). */
export function requireCaptcha(place: CaptchaPlace) {
  return (req: Request, _res: Response, next: NextFunction) => {
    checkCaptcha(req, place).then(() => next(), next);
  };
}
