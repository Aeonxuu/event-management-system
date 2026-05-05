import { Router } from "express";
import { Venue } from "../../models/venue.model";
import { requireAuth } from "../middleware/requireAuth";
import { requireRole } from "../middleware/requireRole";

const router = Router();

// List active venues
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const venues = await Venue.find({ isActive: true }).sort({ name: 1 }).lean();
    return res.json({ success: true, data: { venues } });
  } catch (err) {
    return next(err);
  }
});

// Create venue (admin only)
router.post("/", requireAuth, requireRole(["ADMIN"]), async (req, res, next) => {
  try {
    const { name, location, capacity, notes } = req.body ?? {};
    if (!name || !location || !capacity) {
      const err: any = new Error("Missing required fields");
      err.status = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }

    const v = await Venue.create({ name, location, capacity, notes });
    return res.status(201).json({ success: true, data: { venue: v } });
  } catch (err) {
    return next(err);
  }
});

export default router;
