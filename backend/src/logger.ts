/**
 * Process logs: one line per event, with a level, a scope saying which part of the backend wrote it,
 * and fields an admin can grep (`print=… outcome=…`). Not the audit log in services/auditLog.ts,
 * which stores what users did in the database.
 *
 *   const log = createLogger("import");
 *   log.info("job done", { job: jobId, imported: 3 });
 *   // 2026-10-13T16:36:56.808Z INFO  [import] job done job=cm… imported=3
 *
 * LOG_LEVEL (debug | info | warn | error, default info) drops lines below it. LOG_FORMAT=json writes
 * one JSON object per line instead, for a collector that parses them.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogFields = Record<string, unknown>;

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Read on every line rather than once, so a test or an operator changing the env sees it right away.
function minimumLevel(): number {
  const name = process.env.LOG_LEVEL?.trim().toLowerCase();
  return name && name in LEVELS ? LEVELS[name as LogLevel] : LEVELS.info;
}

function jsonFormat(): boolean {
  return process.env.LOG_FORMAT?.trim().toLowerCase() === "json";
}

/** A token pasted into a URL or carried in an error message shouldn't reach the logs. */
function redact(text: string): string {
  return text.replace(/Bearer\s+[^\s"',]+/gi, "Bearer [redacted]");
}

function errorFields(error: Error, withStack: boolean): LogFields {
  const out: LogFields = { message: error.message };
  // Subclasses that don't set `name` (HttpError) still say which class they are.
  const name = error.name && error.name !== "Error" ? error.name : error.constructor?.name;
  if (name && name !== "Error") out.name = name;
  const extra = error as Error & { status?: unknown; code?: unknown };
  if (extra.status !== undefined) out.status = extra.status;
  if (extra.code !== undefined) out.code = extra.code;
  if (withStack && error.stack) out.stack = error.stack;
  return out;
}

function textValue(value: unknown): string {
  if (value instanceof Error) return textValue(value.message);
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return value === "" || /[\s"=]/.test(value) ? JSON.stringify(value) : value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    // A circular object still says what it was instead of losing the whole line.
    return "[unserializable]";
  }
}

function jsonSafe(value: unknown, withStack: boolean): unknown {
  if (value instanceof Error) return errorFields(value, withStack);
  if (typeof value === "bigint") return value.toString();
  return value;
}

export class Logger {
  constructor(
    readonly scope: string,
    private readonly bound: LogFields = {},
  ) {}

  /** A logger that adds the same fields to every line, such as the job it works on. */
  child(fields: LogFields): Logger {
    return new Logger(this.scope, { ...this.bound, ...fields });
  }

  debug(message: string, fields?: LogFields): void {
    this.write("debug", message, fields);
  }

  info(message: string, fields?: LogFields): void {
    this.write("info", message, fields);
  }

  warn(message: string, fields?: LogFields): void {
    this.write("warn", message, fields);
  }

  error(message: string, fields?: LogFields): void {
    this.write("error", message, fields);
  }

  private write(level: LogLevel, message: string, fields?: LogFields): void {
    if (LEVELS[level] < minimumLevel()) return;
    const all = { ...this.bound, ...fields };
    // An unexpected failure needs its stack to be found; a warning is usually an expected one.
    const withStack = level === "error";
    const time = new Date().toISOString();
    let line: string;
    if (jsonFormat()) {
      const record: LogFields = { time, level, scope: this.scope, message };
      for (const [key, value] of Object.entries(all)) {
        if (value !== undefined && !(key in record)) record[key] = jsonSafe(value, withStack);
      }
      try {
        line = JSON.stringify(record);
      } catch {
        line = JSON.stringify({ time, level, scope: this.scope, message, fields: "[unserializable]" });
      }
    } else {
      const parts = [time, level.toUpperCase().padEnd(5), `[${this.scope}]`, message];
      let stack: string | undefined;
      for (const [key, value] of Object.entries(all)) {
        if (value === undefined) continue;
        parts.push(`${key}=${textValue(value)}`);
        if (withStack && value instanceof Error && value.stack && !stack) stack = value.stack;
      }
      line = parts.join(" ") + (stack ? `\n${stack}` : "");
    }
    line = redact(line);
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }
}

export function createLogger(scope: string, fields?: LogFields): Logger {
  return new Logger(scope, fields);
}
