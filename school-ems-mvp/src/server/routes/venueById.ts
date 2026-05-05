import { Router } from "express";
import { Venue } from "../../models/venue.model";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const v = await Venue.findById(req.params.id).lean();
    if (!v) {
      const err: any = new Error("Venue not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    return res.json({ success: true, data: { venue: v } });
  } catch (err) {
    return next(err);
  }
});

router.patch("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const v = await Venue.findById(req.params.id);
    if (!v) {
      const err: any = new Error("Venue not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    Object.assign(v, req.body);
    await v.save();
    return res.json({ success: true, data: { venue: v } });
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const v = await Venue.findById(req.params.id);
    if (!v) {
      const err: any = new Error("Venue not found");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    // Soft-delete: deactivate
    v.isActive = false;
    await v.save();
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

export default router;
