// Image captchas for login, registration and import. svg-captcha draws characters as outlines,
// not <text>, so the answer isn't in the markup.
//
// Answers live in memory, are single-use, and expire after CAPTCHA_TTL_MS.

import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import svgCaptcha from "svg-captcha";
import { HttpError } from "../utils/fileUtils";
import { isCaptchaEnabled, type CaptchaPlace } from "./settingsService";

const CAPTCHA_TTL_MS = 10 * 60 * 1000;
// Bounds memory if something requests captchas in a loop.
const MAX_PENDING = 5000;
// Confusable characters are left out.
const IGNORE_CHARS = "0oO1iIlL";

const pending = new Map<string, { answer: string; expiresAt: number }>();

function dropExpired(now: number): void {
  for (const [id, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(id);
  }
}

/** `answer` must never be sent to the client (tests only). */
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

/** Uses the captcha up. Case-insensitive. */
export function verifyCaptcha(id: unknown, answer: unknown): boolean {
  if (typeof id !== "string" || typeof answer !== "string") return false;
  const entry = pending.get(id);
  pending.delete(id);
  if (!entry || entry.expiresAt <= Date.now()) return false;
  return entry.answer.toLowerCase() === answer.trim().toLowerCase();
}

// MV3 service worker requests carry chrome-extension://<id> as Origin.
const EXTENSION_ORIGIN = /^(chrome|moz|safari-web)-extension:\/\//i;

/** The extension has nowhere to show a captcha. Recognized by X-Thingport-Client or, for older
 *  versions, its Origin. Anything outside a browser can fake either, so this isn't a security
 *  boundary. */
export function isExtensionRequest(req: Request): boolean {
  return req.get("x-thingport-client") === "grab" || EXTENSION_ORIGIN.test(req.get("origin") ?? "");
}

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

export function requireCaptcha(place: CaptchaPlace) {
  return (req: Request, _res: Response, next: NextFunction) => {
    checkCaptcha(req, place).then(() => next(), next);
  };
}
