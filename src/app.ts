import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { ENV } from './config/env.js';
import apiRouter from './routes/index.js';
import { errorHandler } from './middlewares/error.middleware.js';

export const createApp = (): Express => {
  const app = express();

  // CORS Configuration for Frontend
  app.use(
    cors({
      origin: [ENV.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  // Body parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      service: 'splitty-backend',
      timestamp: new Date().toISOString(),
    });
  });

  // Main API Router
  app.use('/api', apiRouter);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `Routa non trovata: ${req.method} ${req.originalUrl}`,
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};

