import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger } from "../src/logger";
import { HttpError } from "../src/utils/fileUtils";

let lines: { stream: "log" | "warn" | "error"; text: string }[];
const saved = { level: process.env.LOG_LEVEL, format: process.env.LOG_FORMAT };

beforeEach(() => {
  lines = [];
  for (const stream of ["log", "warn", "error"] as const) {
    vi.spyOn(console, stream).mockImplementation((text: unknown) => {
      lines.push({ stream, text: String(text) });
    });
  }
  delete process.env.LOG_LEVEL;
  delete process.env.LOG_FORMAT;
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const [key, value] of [
    ["LOG_LEVEL", saved.level],
    ["LOG_FORMAT", saved.format],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("logger", () => {
  it("writes a level, the scope, the message and greppable fields", () => {
    createLogger("import").info("job done", { job: "cm1", imported: 3, url: "https://x.test/a b", empty: "" });
    expect(lines).toHaveLength(1);
    expect(lines[0].stream).toBe("log");
    expect(lines[0].text).toMatch(
      /^\d{4}-\d\d-\d\dT[\d:.]+Z INFO  \[import\] job done job=cm1 imported=3 url="https:\/\/x\.test\/a b" empty=""$/,
    );
  });

  it("sends warnings and errors to stderr and leaves out undefined fields", () => {
    const log = createLogger("ai");
    log.warn("slow", { attempt: 2, skipped: undefined });
    log.error("broke");
    expect(lines.map((line) => line.stream)).toEqual(["warn", "error"]);
    expect(lines[0].text).not.toContain("skipped");
  });

  it("drops lines below LOG_LEVEL and falls back to info on a value it doesn't know", () => {
    const log = createLogger("x");
    log.debug("hidden by default");
    process.env.LOG_LEVEL = "DEBUG";
    log.debug("shown");
    process.env.LOG_LEVEL = "warn";
    log.info("hidden");
    log.warn("kept");
    process.env.LOG_LEVEL = "verbose";
    log.debug("hidden again");
    log.info("info again");
    expect(lines.map((line) => line.text.split("] ")[1])).toEqual(["shown", "kept", "info again"]);
  });

  it("logs an error's message, status and code, and the stack only at error level", () => {
    const log = createLogger("x");
    const error = new HttpError(429, "slow down", "rate_limited");
    log.warn("item failed", { error });
    expect(lines[0].text).toContain('error="slow down"');
    expect(lines[0].text).not.toContain("\n");

    log.error("job failed", { error: new Error("disk full") });
    expect(lines[1].text).toContain('error="disk full"');
    expect(lines[1].text).toContain("\nError: disk full\n    at ");

    process.env.LOG_FORMAT = "json";
    log.warn("item failed", { error });
    expect(JSON.parse(lines[2].text).error).toEqual({
      message: "slow down",
      name: "HttpError",
      status: 429,
      code: "rate_limited",
    });
  });

  it("writes one parseable JSON object per line with LOG_FORMAT=json", () => {
    process.env.LOG_FORMAT = "json";
    // A field can't overwrite what the line itself says.
    createLogger("sync", { job: "j1" }).info('he said "hi"\nthen left', { level: "fake", count: 2n });
    const record = JSON.parse(lines[0].text);
    expect(record).toMatchObject({
      level: "info",
      scope: "sync",
      message: 'he said "hi"\nthen left',
      job: "j1",
      count: "2",
    });
    expect(lines[0].text).not.toContain("\n");
  });

  it("still writes the line when a field can't be serialized", () => {
    const circular: Record<string, unknown> = { name: "loop" };
    circular.self = circular;
    const log = createLogger("x");
    log.info("text", { circular });
    expect(lines[0].text).toContain("circular=[unserializable]");
    process.env.LOG_FORMAT = "json";
    log.info("json", { circular });
    expect(JSON.parse(lines[1].text)).toMatchObject({ message: "json", fields: "[unserializable]" });
  });

  it("adds a child's fields to every line, letting a call's own fields win", () => {
    const job = createLogger("import").child({ job: "j1", provider: "makerworld" });
    job.info("start", { provider: "printables" });
    expect(lines[0].text).toContain("job=j1 provider=printables");
  });

  it("redacts bearer tokens wherever they appear", () => {
    const log = createLogger("ai");
    log.warn("request failed Bearer sk-secret1", { error: new Error("header was Bearer sk-secret2, rejected") });
    process.env.LOG_FORMAT = "json";
    log.warn("again", { header: "Bearer sk-secret3" });
    const all = lines.map((line) => line.text).join("\n");
    expect(all).not.toMatch(/sk-secret/);
    expect(all).toContain("Bearer [redacted]");
  });
});
