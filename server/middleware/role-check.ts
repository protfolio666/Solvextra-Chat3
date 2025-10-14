import { Request, Response, NextFunction } from "express";
import { UserRole, User } from "@shared/schema";

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as Omit<User, 'password'> | undefined;
    
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "Forbidden - insufficient permissions" });
    }

    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  return requireRole("admin")(req, res, next);
}
