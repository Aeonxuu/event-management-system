import { Router } from "express";
import { Event } from "../../models/event.model";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

// Admin: paginated events
router.get("/events", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 25);
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Event.find().sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Event.countDocuments(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.json({ success: true, data: { items, page, limit, total, totalPages } });
  } catch (err) {
    return next(err);
  }
});

export default router;
