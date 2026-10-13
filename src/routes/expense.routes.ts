import { Router } from 'express';
import {
  getExpenses,
  createExpense,
  deleteExpense,
  getGroupBalances,
  createSettlement,
  getSettlements,
} from '../controllers/expense.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { validateBody } from '../middlewares/validate.middleware.js';
import {
  createExpenseSchema,
  createSettlementSchema,
} from '../schemas/expense.schema.js';

const router = Router();

router.use(requireAuth);

// Expenses
router.get('/group/:groupId', getExpenses);
router.post('/', validateBody(createExpenseSchema), createExpense);
router.delete('/:id', deleteExpense);

// Balances & Settlements
router.get('/group/:groupId/balances', getGroupBalances);
router.get('/group/:groupId/settlements', getSettlements);
router.post('/settlements', validateBody(createSettlementSchema), createSettlement);

export default router;
