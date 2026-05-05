import { Router } from "express";
import { User } from "../../models/user.model";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

router.get("/", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const u = await User.findById(req.user.sub).lean();
    if (!u) {
      const err: any = new Error("User not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    return res.json({ success: true, data: { user: u } });
  } catch (err) {
    return next(err);
  }
});

export default router;
