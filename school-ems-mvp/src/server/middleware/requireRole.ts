import { NextFunction, Response } from "express";
import { AuthenticatedRequest } from "./requireAuth";

export function requireRole(allowed: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      const err: any = new Error("Forbidden");
      err.status = 403;
      err.code = "FORBIDDEN_ROLE";
      return next(err);
    }

    return next();
  };
}
