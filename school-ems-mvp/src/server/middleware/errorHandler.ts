import { NextFunction, Request, Response } from "express";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // eslint-disable-next-line no-console
  console.error(err);

  const status = err?.status || 500;
  const code = err?.code || "INTERNAL_ERROR";
  const message = err?.message || "Internal server error";

  res.status(status).json({ success: false, error: message, code });
}
