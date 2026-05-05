import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../../models/user.model";
import { env } from "../../lib/env";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      const err: any = new Error("Missing email or password");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
    if (!user) {
      const err: any = new Error("Invalid credentials");
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const ok = await bcrypt.compare(password, (user as any).passwordHash);
    if (!ok) {
      const err: any = new Error("Invalid credentials");
      err.status = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const payload = {
      sub: String((user as any)._id),
      role: (user as any).role,
      email: (user as any).email,
      name: (user as any).name,
      organizationId: (user as any).organizationId,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });

    // Set cookie
    res.cookie(env.AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days default
    });

    return res.json({ success: true, data: { user: payload } });
  } catch (err) {
    return next(err);
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie(env.AUTH_COOKIE_NAME, { path: "/" });
  return res.json({ success: true });
});

export default router;
