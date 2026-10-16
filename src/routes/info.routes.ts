import { Router } from 'express';
import {
  getInfoItems,
  createInfoItem,
  updateInfoItem,
  deleteInfoItem,
} from '../controllers/info.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  createInfoItemSchema,
  updateInfoItemSchema,
} from '../schemas/info.schema.js';

const router = Router();

router.use(requireAuth);

router.get('/', getInfoItems);
router.post('/', validateBody(createInfoItemSchema), createInfoItem);
router.put('/:id', validateBody(updateInfoItemSchema), updateInfoItem);
router.delete('/:id', deleteInfoItem);

export default router;

