import { Router } from "express";
import bcrypt from "bcryptjs";
import { User } from "../../models/user.model";
import { Organization } from "../../models/organization.model";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

// Admin: list users
router.get("/users", requireAuth, requireRole(["ADMIN"]), async (_req, res, next) => {
  try {
    const users = await User.find().lean();
    return res.json({ success: true, data: { users } });
  } catch (err) {
    return next(err);
  }
});

// Admin: create user
router.post("/users", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const { name, email, role, organizationId, password } = req.body ?? {};
    if (!name || !email || !role) {
      const err: any = new Error("Missing required fields");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const pw = password ?? "demo123";
    const hash = await bcrypt.hash(pw, 10);

    const u = await User.create({ name, email: email.toLowerCase(), role, organizationId, passwordHash: hash });
    return res.status(201).json({ success: true, data: { user: u } });
  } catch (err) {
    return next(err);
  }
});

// Admin: update user
router.patch("/users/:id", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) {
      const err: any = new Error("User not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    Object.assign(u, req.body);
    await u.save();
    return res.json({ success: true, data: { user: u } });
  } catch (err) {
    return next(err);
  }
});

// Admin: reset password
router.post("/users/:id/password", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const { password } = req.body ?? {};
    if (!password) {
      const err: any = new Error("Missing password");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const u = await User.findById(req.params.id).select("+passwordHash");
    if (!u) {
      const err: any = new Error("User not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    u.passwordHash = await bcrypt.hash(password, 10);
    await u.save();
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// Organizations
router.get("/organizations", requireAuth, requireRole(["ADMIN"]), async (_req, res, next) => {
  try {
    const orgs = await Organization.find().lean();
    return res.json({ success: true, data: { organizations: orgs } });
  } catch (err) {
    return next(err);
  }
});

router.post("/organizations", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const { name, code, description } = req.body ?? {};
    if (!name || !code) {
      const err: any = new Error("Missing required fields");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const org = await Organization.create({ name, code: String(code).toUpperCase(), description });
    return res.status(201).json({ success: true, data: { organization: org } });
  } catch (err) {
    return next(err);
  }
});

export default router;
