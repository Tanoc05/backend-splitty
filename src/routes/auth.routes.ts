import { Router } from 'express';
import { getMe, updateProfile } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/me', requireAuth, getMe);
router.put('/me', requireAuth, updateProfile);

export default router;
