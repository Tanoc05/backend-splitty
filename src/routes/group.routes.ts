import { Router } from 'express';
import {
  getGroups,
  getGroupById,
  createGroup,
  addMember,
} from '../controllers/group.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import { createGroupSchema, addMemberSchema } from '../schemas/group.schema.js';

const router = Router();

router.use(requireAuth);

router.get('/', getGroups);
router.post('/', validateBody(createGroupSchema), createGroup);
router.get('/:id', getGroupById);
router.post('/:id/members', validateBody(addMemberSchema), addMember);

export default router;

