import { Router } from "express";
import { Event } from "../../models/event.model";
import { requireAuth, AuthenticatedRequest } from "../middleware/requireAuth";

const router = Router();

// Get events pending current user's approval
router.get("/me", requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const role = req.user.role;
    // statuses that represent pending approvals
    const statuses = ["PENDING_ADVISER", "PENDING_DEAN", "PENDING_FACILITIES", "PENDING_OSA"];
    const items = await Event.find({ currentApproverRole: role, status: { $in: statuses } }).sort({ updatedAt: -1 }).lean();
    return res.json({ success: true, data: { queue: items } });
  } catch (err) {
    return next(err);
  }
});

export default router;
