import type { ZodType } from "zod";
import { HttpError } from "./fileUtils";

// `any, any` stops TS inferring T from the schema's Input type, which would make `.default()`
// fields look optional.
export function parseBody<T>(schema: ZodType<T, any, any>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(400, result.error.issues.map((i) => i.message).join("; ") || "Invalid request body");
  }
  return result.data;
}
