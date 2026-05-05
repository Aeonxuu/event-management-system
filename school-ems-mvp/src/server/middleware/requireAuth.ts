import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../lib/env";

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const cookieName = env.AUTH_COOKIE_NAME;
    const token = req.cookies?.[cookieName];

    if (!token) {
      const err: any = new Error("Missing authentication token");
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const payload = jwt.verify(token, env.JWT_SECRET) as any;
    req.user = payload;
    return next();
  } catch (error: any) {
    error.status = error.status || 401;
    error.code = error.code || "UNAUTHORIZED";
    return next(error);
  }
}
