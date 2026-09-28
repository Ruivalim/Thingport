import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 doesn't forward rejected promises to the error middleware, so async handlers would
 * hang. Wrap every async route handler with this.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
