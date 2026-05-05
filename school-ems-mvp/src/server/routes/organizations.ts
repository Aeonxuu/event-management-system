import { Router } from "express";
import { Organization } from "../../models/organization.model";
import { requireAuth } from "../middleware/requireAuth";

const router = Router();

// Public list of organizations (requires auth)
router.get("/", requireAuth, async (_req, res, next) => {
  try {
    const orgs = await Organization.find().sort({ name: 1 }).lean();
    return res.json({ success: true, data: { organizations: orgs } });
  } catch (err) {
    return next(err);
  }
});

export default router;
