import { Router } from 'express';
import authRoutes from './auth.routes.js';
import groupRoutes from './group.routes.js';
import expenseRoutes from './expense.routes.js';
import infoRoutes from './info.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/groups', groupRoutes);
apiRouter.use('/expenses', expenseRoutes);
apiRouter.use('/info', infoRoutes);

export default apiRouter;
