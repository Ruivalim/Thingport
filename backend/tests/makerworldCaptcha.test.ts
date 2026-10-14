import { afterEach, describe, expect, it } from "vitest";
import {
  clearCaptchaCooloff,
  isCaptchaChallenge,
  makerworldCaptchaCooloffActive,
  noteCaptchaChallenge,
} from "../src/services/makerworldCaptcha";

describe("isCaptchaChallenge", () => {
  it("spots the real challenge shapes", () => {
    expect(isCaptchaChallenge({ captchaId: "abc", error: "We need you to confirm you are not a robot" })).toBe(true);
    expect(isCaptchaChallenge({ captcha_id: "abc" })).toBe(true);
    expect(isCaptchaChallenge({ code: 1, message: "Please complete the captcha" })).toBe(true);
    expect(isCaptchaChallenge({ msg: "confirm you are not a robot" })).toBe(true);
  });

  it("doesn't take a design that talks about robots or captchas for a challenge", () => {
    expect(isCaptchaChallenge({ id: 1, title: "Robot vacuum dock", summary: "<p>For my robot</p>" })).toBe(false);
    expect(isCaptchaChallenge({ id: 2, title: "CAPTCHA keychain", tags: ["captcha"] })).toBe(false);
    expect(isCaptchaChallenge({ message: "success", url: "https://cdn.example.com/robot-arm.3mf" })).toBe(false);
  });

  it("ignores anything that isn't an object", () => {
    expect(isCaptchaChallenge(null)).toBe(false);
    expect(isCaptchaChallenge("captcha")).toBe(false);
    expect(isCaptchaChallenge(["captchaId"])).toBe(false);
  });
});

describe("the CAPTCHA cooloff", () => {
  afterEach(() => clearCaptchaCooloff());

  it("can be lifted by hand once a person has solved the puzzle", () => {
    noteCaptchaChallenge();
    expect(makerworldCaptchaCooloffActive()).toBe(true);
    clearCaptchaCooloff();
    expect(makerworldCaptchaCooloffActive()).toBe(false);
  });
});
